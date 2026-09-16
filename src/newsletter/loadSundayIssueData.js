import supabase from '../supabaseClient.js';
import { normalizeOpponentSlug } from '../mediaGuide/guideFacts.js';
import { loadMediaGuide } from '../mediaGuide/loadGuide.js';
import { loadAccContext } from './accData.js';
import { buildGuideContext } from './guideContext.js';
import { buildSundayIssueData } from './issueData.js';

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
    const duke = gameParticipants.find((participant) => participant.team?.slug === 'duke');
    const opponent = gameParticipants.find((participant) => participant.team?.slug !== 'duke');
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

export async function loadLatestSundayIssueData(client = supabase) {
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
    .select('id, season, start_at, venue_name, status')
    .eq('status', 'scheduled')
    .gt('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(1);
  if (nextError) throw nextError;
  const nextGame = nextGames?.[0] || null;
  const nextParticipants = nextGame ? await loadParticipants(client, nextGame.id) : [];

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
    scorigamiHistory,
    accContext,
  });
}
