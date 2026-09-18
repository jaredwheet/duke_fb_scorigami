import { fetchCfbDataGameDetails, fetchCfbDataGames } from './providers/cfbData.js';
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
  const configuredEnrichers = enrichers.length > 0
    ? enrichers
    : process.env.INGEST_DETAILS === 'true'
      ? [fetchCfbDataGameDetails]
      : [];
  const masterGames = [];
  for (const game of rawGames) {
    const masterGame = buildMasterGameObject({ cfbDataGame: game });
    const enrichmentResults = await Promise.all(
      configuredEnrichers.map((enricher) => enricher(masterGame)),
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

async function withPersistenceContext(stage, canonicalKey, operation) {
  try {
    return await operation();
  } catch (error) {
    if (error && typeof error === 'object') {
      error.persistenceStage = stage;
      error.canonicalKey = canonicalKey;
    }
    throw error;
  }
}

async function upsertTeam(client, sportId, team, canonicalKey) {
  return withPersistenceContext('teams', canonicalKey, async () => {
    const { data, error } = await client
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
  });
}

export async function persistMasterGame(masterGame, client = null) {
  const db = client || (await import('../supabaseClient.js')).default;
  const { canonicalKey } = masterGame;
  const sport = await withPersistenceContext('sports', canonicalKey, async () => {
    const { data, error } = await db
      .from('sports')
      .upsert(masterGame.sport, { onConflict: 'slug' })
      .select('id')
      .single();
    if (error) throw error;
    return data;
  });

  const participants = [];
  for (const participant of masterGame.participants) {
    participants.push({
      ...participant,
      teamId: await upsertTeam(db, sport.id, participant.team, canonicalKey),
    });
  }

  const game = await withPersistenceContext('games', canonicalKey, async () => {
    const { data, error } = await db
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
    if (error) throw error;
    return data;
  });

  for (const participant of participants) {
    await withPersistenceContext('game_participants', canonicalKey, async () => {
      const { error } = await db
        .from('game_participants')
        .upsert({
          game_id: game.id,
          team_id: participant.teamId,
          participant_role: participant.role,
          score: participant.score,
          metadata: participant.team.metadata,
        }, { onConflict: 'game_id,participant_role' });
      if (error) throw error;
    });
  }

  for (const source of masterGame.sourceRecords) {
    await withPersistenceContext('game_source_records', canonicalKey, async () => {
      const { error } = await db
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
    });
  }

  for (const enrichment of Object.values(masterGame.enrichments || {})) {
    if (!enrichment?.data) continue;
    const payload = {
      ...enrichment.data,
      _meta: {
        status: enrichment.status || 'ok',
        errors: enrichment.errors || {},
      },
    };
    await withPersistenceContext('game_analytics', canonicalKey, async () => {
      const { error } = await db
        .from('game_analytics')
        .upsert({
          game_id: game.id,
          provider: enrichment.provider,
          metric_set: enrichment.metricSet || 'enrichment',
          payload,
        }, { onConflict: 'game_id,provider,metric_set' });
      if (error) throw error;
    });
  }

  return game.id;
}
