import { createHash } from 'node:crypto';

export const COLLEGE_FOOTBALL = {
  slug: 'football',
  name: 'College Football',
};

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeScore(value) {
  return value == null ? null : Number(value);
}

function normalizeTeam(name, id, metadata = {}) {
  return {
    externalId: id == null ? null : String(id),
    slug: slugify(name) || `team-${id}`,
    name: name || 'Unknown team',
    metadata,
  };
}

function getStatus(game) {
  if (game.completed) return 'final';
  if (game.started || game.status === 'in_progress') return 'in_progress';
  return 'scheduled';
}

export function getPayloadHash(payload) {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export function normalizeCfbDataGame(game) {
  if (!game?.id) throw new Error('CFBData game is missing an external id');

  const homeTeam = normalizeTeam(game.homeTeam, game.homeId, {
    conference: game.homeConference,
    classification: game.homeClassification,
    pregameElo: game.homePregameElo,
    postgameElo: game.homePostgameElo,
  });
  const awayTeam = normalizeTeam(game.awayTeam, game.awayId, {
    conference: game.awayConference,
    classification: game.awayClassification,
    pregameElo: game.awayPregameElo,
    postgameElo: game.awayPostgameElo,
  });
  const startAt = game.startDate || null;
  const season = Number(game.season || (startAt ? new Date(startAt).getUTCFullYear() : new Date().getUTCFullYear()));
  const dateKey = startAt ? new Date(startAt).toISOString() : `unknown-${game.id}`;

  return {
    canonicalKey: [
      COLLEGE_FOOTBALL.slug,
      season,
      dateKey,
      homeTeam.slug,
      awayTeam.slug,
    ].join(':'),
    sport: COLLEGE_FOOTBALL,
    season,
    week: game.week == null ? null : Number(game.week),
    startAt,
    status: getStatus(game),
    venueName: game.venue || null,
    city: game.city || null,
    state: game.state || null,
    neutralSite: game.neutralSite ?? null,
    notes: game.notes || null,
    participants: [
      {
        role: 'home',
        team: homeTeam,
        score: normalizeScore(game.homePoints),
      },
      {
        role: 'away',
        team: awayTeam,
        score: normalizeScore(game.awayPoints),
      },
    ],
    sourceRecords: [{
      provider: 'cfbdata',
      externalGameId: String(game.id),
      payload: game,
      payloadHash: getPayloadHash(game),
      sourceUpdatedAt: game.updatedAt || startAt,
    }],
  };
}
