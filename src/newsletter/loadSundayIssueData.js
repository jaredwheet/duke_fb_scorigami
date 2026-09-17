import supabase from '../supabaseClient.js';
import { normalizeOpponentSlug } from '../mediaGuide/guideFacts.js';
import { loadMediaGuide } from '../mediaGuide/loadGuide.js';
import {
  fetchCfbDataLines,
  fetchCfbDataPregameWinProbabilities,
  fetchCfbDataSeasonStats,
  fetchCfbDataTeamGameStats,
  fetchCfbDataTeamRecords,
  fetchCfbDataPlayerSeasonStats,
} from '../ingestion/providers/cfbData.js';
import { fetchOddsApiSnapshot } from '../ingestion/providers/enrichments.js';
import { loadAccContext } from './accData.js';
import { buildGuideContext } from './guideContext.js';
import { buildSundayIssueData } from './issueData.js';
import { findUpcomingOdds } from './odds.js';
import { buildBulletinContext, findCfbDataOdds } from './bulletinData.js';
import { loadWatercoolerContext } from './watercoolerData.js';
import { isDukeTeam } from '../teamUtils.js';

async function loadParticipants(client, gameId) {
  const [{ data: participants, error: participantError }, { data: teams, error: teamError }] = await Promise.all([
    client.from('game_participants').select('team_id, participant_role, score').eq('game_id', gameId),
    client.from('teams').select('id, slug, name'),
  ]);
  if (participantError) throw participantError;
  if (teamError) throw teamError;

  const teamsById = new Map((teams || []).map((team) => [team.id, team]));
  return (participants || []).map((participant) => ({
    role: participant.participant_role,
    score: participant.score,
    team: teamsById.get(participant.team_id),
  }));
}

async function fetchPagedRows(client, table, columns, configure, pageSize = 500) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = client.from(table).select(columns);
    query = configure(query);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

function normalizedTeam(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function loadCanonicalSeasonRecords(client, season, teamNames = []) {
  const targets = teamNames.filter(Boolean).map((name) => ({ name, key: normalizedTeam(name) }));
  const { data: games, error: gamesError } = await client
    .from('games')
    .select('id')
    .eq('season', season)
    .eq('status', 'final');
  if (gamesError) throw gamesError;
  const gameIds = (games || []).map((game) => game.id);
  if (gameIds.length === 0 || targets.length === 0) return {};
  const [{ data: participants, error: participantsError }, { data: teams, error: teamsError }] = await Promise.all([
    client.from('game_participants').select('game_id, team_id, score').in('game_id', gameIds),
    client.from('teams').select('id, slug, name'),
  ]);
  if (participantsError) throw participantsError;
  if (teamsError) throw teamsError;
  const teamsById = new Map((teams || []).map((team) => [team.id, team]));
  const summaries = Object.fromEntries(targets.map((target) => [target.key, { wins: 0, losses: 0, ties: 0, pointsFor: [], pointsAgainst: [] }]));
  const participantsByGame = new Map();
  for (const participant of participants || []) {
    const list = participantsByGame.get(participant.game_id) || [];
    list.push({ ...participant, team: teamsById.get(participant.team_id) });
    participantsByGame.set(participant.game_id, list);
  }
  for (const gameParticipants of participantsByGame.values()) {
    for (const participant of gameParticipants) {
      const participantKey = normalizedTeam(participant.team?.slug || participant.team?.name);
      const target = targets.find((candidate) => participantKey === candidate.key || participantKey.includes(candidate.key) || candidate.key.includes(participantKey));
      const opponent = gameParticipants.find((candidate) => candidate !== participant);
      if (!target || participant.score == null || opponent?.score == null) continue;
      const summary = summaries[target.key];
      const score = Number(participant.score);
      const opponentScore = Number(opponent.score);
      summary.pointsFor.push(score);
      summary.pointsAgainst.push(opponentScore);
      if (score > opponentScore) summary.wins += 1;
      else if (score < opponentScore) summary.losses += 1;
      else summary.ties += 1;
    }
  }
  return Object.fromEntries(Object.entries(summaries).filter(([, summary]) => summary.pointsFor.length > 0).map(([key, summary]) => {
    const gamesPlayed = summary.pointsFor.length;
    return [key, {
      record: `${summary.wins}-${summary.losses}${summary.ties > 0 ? `-${summary.ties}` : ''}`,
      pointsFor: gamesPlayed > 0 ? summary.pointsFor.reduce((sum, value) => sum + value, 0) / gamesPlayed : null,
      pointsAgainst: gamesPlayed > 0 ? summary.pointsAgainst.reduce((sum, value) => sum + value, 0) / gamesPlayed : null,
    }];
  }));
}

function scorePair(dukeScore, opponentScore) {
  return [Number(dukeScore), Number(opponentScore)].sort((left, right) => left - right).join('-');
}

async function loadScorigamiHistory(client, currentGame, scoreFacts) {
  if (!scoreFacts?.scorePair || scoreFacts.isNew) return [];

  const [games, participants, teams] = await Promise.all([
    fetchPagedRows(client, 'games', 'id, start_at, venue_name, city, state', (query) => {
      let configured = query.eq('status', 'final').order('start_at', { ascending: false });
      if (currentGame.start_at) configured = configured.lt('start_at', currentGame.start_at);
      return configured;
    }),
    fetchPagedRows(client, 'game_participants', 'game_id, team_id, score', (query) => query),
    client.from('teams').select('id, slug, name').then(({ data, error }) => {
      if (error) throw error;
      return data || [];
    }),
  ]);

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const participantsByGame = new Map();
  for (const participant of participants) {
    const list = participantsByGame.get(participant.game_id) || [];
    list.push({ ...participant, team: teamsById.get(participant.team_id) });
    participantsByGame.set(participant.game_id, list);
  }

  return games.flatMap((game) => {
    const gameParticipants = participantsByGame.get(game.id) || [];
    const duke = gameParticipants.find((participant) => isDukeTeam(participant.team));
    const opponent = gameParticipants.find((participant) => !isDukeTeam(participant.team));
    if (!duke || !opponent || duke.score == null || opponent.score == null) return [];
    if (scorePair(duke.score, opponent.score) !== scoreFacts.scorePair) return [];
    const cityState = [game.city, game.state].filter(Boolean).join(', ');
    return [{
      gameId: game.id,
      startAt: game.start_at,
      opponent: opponent.team.name,
      dukeScore: duke.score,
      opponentScore: opponent.score,
      location: [game.venue_name, cityState].filter(Boolean).join(', '),
    }];
  });
}

function findNextGuideSchedule(guide, nextGame, nextParticipants) {
  if (!guide || !nextGame) return null;
  const opponent = nextParticipants.find((participant) => participant.team?.slug !== 'duke');
  const seasonContext = guide.seasonContext.find((context) => context.season === nextGame.season);
  return seasonContext?.schedule.find((entry) => normalizeOpponentSlug(entry.opponent) === normalizeOpponentSlug(opponent?.team?.name));
}

export async function loadLatestSundayIssueData(client = supabase, { includeOdds = false, includeWatercooler = false, includeBulletin = false } = {}) {
  const { data: games, error: gamesError } = await client
    .from('games')
    .select('id, season, week, start_at, status, venue_name')
    .eq('status', 'final')
    .order('start_at', { ascending: false })
    .limit(1);
  if (gamesError) throw gamesError;
  const game = games?.[0];
  if (!game) throw new Error('No completed canonical game is available for a Sunday issue');

  const [participants, { data: sourceRecords, error: sourceError }, { data: analytics, error: analyticsError }, { data: factRows, error: factsError }, { data: directives, error: directivesError }] = await Promise.all([
    loadParticipants(client, game.id),
    client.from('game_source_records').select('payload').eq('game_id', game.id).eq('provider', 'cfbdata').limit(1),
    client.from('game_analytics').select('payload').eq('game_id', game.id).eq('metric_set', 'game_details').limit(1),
    client.from('game_facts').select('value').eq('game_id', game.id).eq('fact_key', 'headline_facts').limit(1),
    client.from('editorial_directives').select('directive_key, tier, priority, facts, issue_type').eq('game_id', game.id).eq('issue_type', 'sunday').order('priority', { ascending: false }).limit(1),
  ]);
  if (sourceError) throw sourceError;
  if (analyticsError) throw analyticsError;
  if (factsError) throw factsError;
  if (directivesError) throw directivesError;

  const { data: nextGames, error: nextError } = await client
    .from('games')
    .select('id, season, week, start_at, venue_name, status')
    .eq('status', 'scheduled')
    .gt('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(1);
  if (nextError) throw nextError;
  const nextGame = nextGames?.[0] || null;
  const nextParticipants = nextGame ? await loadParticipants(client, nextGame.id) : [];
  let odds = null;
  let bulletinContext = null;
  if (includeBulletin && nextGame && process.env.CFB_DATA_KEY) {
    try {
      const opponent = nextParticipants.find((participant) => !isDukeTeam(participant.team));
      const opponentName = opponent?.team?.name;
      const [lines, pregameProbabilities, dukeSeasonStats, opponentSeasonStats, dukeGameStats, opponentGameStats, dukeRecord, opponentRecord, dukePlayerStats, opponentPlayerStats, canonicalRecords] = await Promise.all([
        fetchCfbDataLines({ year: nextGame.season, week: nextGame.week, team: 'Duke' }),
        fetchCfbDataPregameWinProbabilities({ year: nextGame.season, week: nextGame.week, team: 'Duke' }),
        fetchCfbDataSeasonStats({ year: nextGame.season, team: 'Duke', endWeek: Math.max(1, nextGame.week - 1) }),
        fetchCfbDataSeasonStats({ year: nextGame.season, team: opponentName, endWeek: Math.max(1, nextGame.week - 1) }),
        fetchCfbDataTeamGameStats({ year: nextGame.season, team: 'Duke' }),
        fetchCfbDataTeamGameStats({ year: nextGame.season, team: opponentName }),
        fetchCfbDataTeamRecords({ year: nextGame.season, team: 'Duke' }),
        fetchCfbDataTeamRecords({ year: nextGame.season, team: opponentName }),
        fetchCfbDataPlayerSeasonStats({ year: nextGame.season, team: 'Duke', endWeek: Math.max(1, nextGame.week - 1) }),
        fetchCfbDataPlayerSeasonStats({ year: nextGame.season, team: opponentName, endWeek: Math.max(1, nextGame.week - 1) }),
        loadCanonicalSeasonRecords(client, nextGame.season, ['Duke', opponentName]),
      ]);
      odds = findCfbDataOdds(lines, {
        opponentName,
      });
      bulletinContext = buildBulletinContext({
        opponentName: opponent?.team?.name,
        dukeSeasonStats,
        opponentSeasonStats,
        dukeGameStats,
        opponentGameStats,
        dukeRecord,
        opponentRecord,
        dukePlayerStats,
        opponentPlayerStats,
        canonicalRecords,
        lines,
        pregameProbabilities,
      });
      if (!odds && process.env.ODDS_API_KEY) {
        const oddsSnapshot = await fetchOddsApiSnapshot(nextGame, { apiKey: process.env.ODDS_API_KEY });
        odds = findUpcomingOdds(oddsSnapshot.data || [], {
          opponentName,
          startAt: nextGame.start_at,
        });
      }
    } catch (error) {
      console.warn(`Odds data unavailable: ${error.message}`);
    }
  }

  const scoreFacts = factRows?.[0]?.value?.scorigami || {};
  let scorigamiHistory = [];
  try {
    scorigamiHistory = await loadScorigamiHistory(client, game, scoreFacts);
  } catch (error) {
    console.warn(`Scorigami history unavailable: ${error.message}`);
  }

  let guide = null;
  let guideContext = null;
  try {
    guide = loadMediaGuide();
    guideContext = buildGuideContext({
      guide,
      game,
      participants,
      detailsPayload: analytics?.[0]?.payload || {},
      facts: factRows?.[0]?.value || {},
    });
  } catch (error) {
    console.warn(`Media-guide context unavailable: ${error.message}`);
  }

  let accContext = null;
  try {
    accContext = await loadAccContext({
      season: game.season,
      week: game.week,
      currentGameId: sourceRecords?.[0]?.payload?.id,
    });
  } catch (error) {
    console.warn(`Around the ACC data unavailable: ${error.message}`);
  }

  let watercoolerContext = null;
  if (includeWatercooler && nextGame) {
    try {
      watercoolerContext = await loadWatercoolerContext(client, { guide, nextGame, nextParticipants });
    } catch (error) {
      console.warn(`Watercooler archive data unavailable: ${error.message}`);
    }
  }

  return buildSundayIssueData({
    game,
    participants,
    sourcePayload: sourceRecords?.[0]?.payload || null,
    detailsPayload: analytics?.[0]?.payload || {},
    facts: factRows?.[0]?.value || {},
    directive: directives?.[0] || null,
    guideContext,
    nextGame,
    nextParticipants,
    nextSchedule: findNextGuideSchedule(guide, nextGame, nextParticipants),
    odds,
    bulletinContext,
    watercoolerContext,
    scorigamiHistory,
    accContext,
  });
}
