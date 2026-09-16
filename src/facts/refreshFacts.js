import { detectEvents, EVENT_LOGIC_VERSION } from '../eventDetector.js';
import { calculateDukeScoreFacts } from './scoreFacts.js';

export async function fetchAllRows(client, table, columns, { pageSize = 500 } = {}) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function loadCanonicalGames(client) {
  const [games, participants, teams] = await Promise.all([
    fetchAllRows(client, 'games', 'id, canonical_key, season, start_at, status'),
    fetchAllRows(client, 'game_participants', 'id, game_id, team_id, participant_role, score'),
    fetchAllRows(client, 'teams', 'id, slug, name'),
  ]);

  const teamsById = new Map((teams || []).map((team) => [team.id, team]));
  const participantsByGame = new Map();
  for (const participant of participants || []) {
    const list = participantsByGame.get(participant.game_id) || [];
    list.push({
      role: participant.participant_role,
      score: participant.score,
      team: teamsById.get(participant.team_id),
    });
    participantsByGame.set(participant.game_id, list);
  }

  return (games || []).map((game) => ({
    ...game,
    participants: participantsByGame.get(game.id) || [],
  }));
}

export async function refreshDukeFacts(client = null) {
  const db = client || (await import('../supabaseClient.js')).default;
  const games = await loadCanonicalGames(db);
  const calculatedFacts = calculateDukeScoreFacts(games);

  for (const result of calculatedFacts) {
    const { error: factError } = await db
      .from('game_facts')
      .upsert({
        game_id: result.gameId,
        fact_key: 'headline_facts',
        value: result.facts,
        logic_version: EVENT_LOGIC_VERSION,
      }, { onConflict: 'game_id,fact_key,logic_version' });
    if (factError) throw factError;

    const game = games.find((candidate) => candidate.id === result.gameId);
    const detection = detectEvents({
      canonicalKey: game.canonical_key,
      facts: result.facts,
    });
    for (const directive of detection.directives) {
      for (const issueType of directive.issueTypes) {
        const { error: directiveError } = await db
          .from('editorial_directives')
          .upsert({
            game_id: result.gameId,
            issue_type: issueType,
            tier: directive.tier,
            directive_key: directive.directiveKey,
            facts: directive.facts,
            priority: directive.priority,
            logic_version: directive.logicVersion,
          }, { onConflict: 'game_id,issue_type,directive_key,logic_version' });
        if (directiveError) throw directiveError;
      }
    }
  }

  return calculatedFacts.length;
}
