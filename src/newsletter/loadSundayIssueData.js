import supabase from '../supabaseClient.js';
import { loadMediaGuide } from '../mediaGuide/loadGuide.js';
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
    .select('id, start_at, venue_name, status')
    .eq('status', 'scheduled')
    .gt('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(1);
  if (nextError) throw nextError;
  const nextGame = nextGames?.[0] || null;
  const nextParticipants = nextGame ? await loadParticipants(client, nextGame.id) : [];

  let guideContext = null;
  try {
    guideContext = buildGuideContext({
      guide: loadMediaGuide(),
      game,
      participants,
      detailsPayload: analytics?.[0]?.payload || {},
      facts: factRows?.[0]?.value || {},
    });
  } catch (error) {
    console.warn(`Media-guide context unavailable: ${error.message}`);
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
  });
}
