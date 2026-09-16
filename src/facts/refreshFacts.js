import supabase from '../supabaseClient.js';
import { detectEvents, EVENT_LOGIC_VERSION } from '../eventDetector.js';
import { calculateDukeScoreFacts } from './scoreFacts.js';

async function loadCanonicalGames(client) {
  const [{ data: games, error: gamesError }, { data: participants, error: participantsError }, { data: teams, error: teamsError }] = await Promise.all([
    client.from('games').select('id, canonical_key, season, start_at, status'),
    client.from('game_participants').select('game_id, team_id, participant_role, score'),
    client.from('teams').select('id, slug, name'),
  ]);
  if (gamesError) throw gamesError;
  if (participantsError) throw participantsError;
  if (teamsError) throw teamsError;

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

export async function refreshDukeFacts(client = supabase) {
  const games = await loadCanonicalGames(client);
  const calculatedFacts = calculateDukeScoreFacts(games);

  for (const result of calculatedFacts) {
    const { error: factError } = await client
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
        const { error: directiveError } = await client
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
