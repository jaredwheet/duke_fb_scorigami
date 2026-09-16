import { fetchCfbDataGames } from './providers/cfbData.js';
import { normalizeCfbDataGame } from './normalize.js';

export function buildMasterGameObject({
  cfbDataGame,
  enrichments = {},
  facts = {},
} = {}) {
  const normalized = normalizeCfbDataGame(cfbDataGame);
  return {
    ...normalized,
    enrichments,
    facts,
  };
}

export async function ingestDukeSeason({
  year = new Date().getFullYear(),
  cfbDataFetcher = fetchCfbDataGames,
  enrichers = [],
} = {}) {
  const rawGames = await cfbDataFetcher({ year, team: 'Duke' });
  const masterGames = [];
  for (const game of rawGames) {
    const masterGame = buildMasterGameObject({ cfbDataGame: game });
    const enrichmentResults = await Promise.all(
      enrichers.map((enricher) => enricher(masterGame)),
    );
    masterGame.enrichments = Object.fromEntries(
      enrichmentResults
        .filter(Boolean)
        .map((result) => [result.provider, result]),
    );
    masterGames.push(masterGame);
  }
  return masterGames;
}

async function upsertTeam(sportId, team) {
  const { data, error } = await supabase
    .from('teams')
    .upsert({
      sport_id: sportId,
      slug: team.slug,
      name: team.name,
      short_name: team.name,
      metadata: {
        ...team.metadata,
        externalId: team.externalId,
      },
    }, { onConflict: 'sport_id,slug' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function persistMasterGame(masterGame, client = null) {
  const supabase = client || (await import('../supabaseClient.js')).default;
  const { data: sport, error: sportError } = await supabase
    .from('sports')
    .upsert(masterGame.sport, { onConflict: 'slug' })
    .select('id')
    .single();
  if (sportError) throw sportError;

  const participants = [];
  for (const participant of masterGame.participants) {
    participants.push({
      ...participant,
      teamId: await upsertTeam(sport.id, participant.team),
    });
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .upsert({
      sport_id: sport.id,
      canonical_key: masterGame.canonicalKey,
      season: masterGame.season,
      week: masterGame.week,
      start_at: masterGame.startAt,
      status: masterGame.status,
      venue_name: masterGame.venueName,
      city: masterGame.city,
      state: masterGame.state,
      neutral_site: masterGame.neutralSite,
      notes: masterGame.notes,
    }, { onConflict: 'canonical_key' })
    .select('id')
    .single();
  if (gameError) throw gameError;

  for (const participant of participants) {
    const { error } = await supabase
      .from('game_participants')
      .upsert({
        game_id: game.id,
        team_id: participant.teamId,
        participant_role: participant.role,
        score: participant.score,
        metadata: participant.team.metadata,
      }, { onConflict: 'game_id,participant_role' });
    if (error) throw error;
  }

  for (const source of masterGame.sourceRecords) {
    const { error } = await supabase
      .from('game_source_records')
      .upsert({
        game_id: game.id,
        provider: source.provider,
        external_game_id: source.externalGameId,
        payload: source.payload,
        payload_hash: source.payloadHash,
        source_updated_at: source.sourceUpdatedAt,
      }, { onConflict: 'provider,external_game_id' });
    if (error) throw error;
  }

  return game.id;
}
