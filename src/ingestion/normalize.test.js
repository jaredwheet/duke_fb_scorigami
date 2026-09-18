import { buildMasterGameObject } from './ingestionEngine.js';
import { getPayloadHash, slugify } from './normalize.js';

function makeGame(overrides = {}) {
  return {
    id: 401858209,
    season: 2026,
    week: 2,
    startDate: '2026-09-05T19:30:00Z',
    completed: true,
    homeTeam: 'Duke',
    homeId: 150,
    homePoints: 17,
    awayTeam: 'Tulane',
    awayId: 2655,
    awayPoints: 3,
    neutralSite: false,
    ...overrides,
  };
}

test('normalizes a CFBData game into a stable master game object', () => {
  const masterGame = buildMasterGameObject({
    cfbDataGame: makeGame(),
  });

  expect(masterGame.canonicalKey)
    .toBe('football:2026:2026-09-05T19:30:00.000Z:duke:tulane');
  expect(masterGame.sport).toEqual({
    slug: 'football',
    name: 'College Football',
  });
  expect(masterGame.season).toBe(2026);
  expect(masterGame.week).toBe(2);
  expect(masterGame.startAt).toBe('2026-09-05T19:30:00Z');
  expect(masterGame.status).toBe('final');
  expect(masterGame.participants).toMatchObject([
    { role: 'home', score: 17, team: { slug: 'duke' } },
    { role: 'away', score: 3, team: { slug: 'tulane' } },
  ]);
  expect(masterGame.sourceRecords[0]).toMatchObject({
    provider: 'cfbdata',
    externalGameId: '401858209',
    payloadHash: getPayloadHash(makeGame()),
  });
});

test('keeps canonical identity stable for repeated payloads', () => {
  const firstInput = Object.freeze(makeGame());
  const secondInput = Object.freeze(makeGame());

  const first = buildMasterGameObject({ cfbDataGame: firstInput });
  const second = buildMasterGameObject({ cfbDataGame: secondInput });

  expect(second).toEqual(first);
  expect(first.sourceRecords[0].payloadHash).toBe(getPayloadHash(firstInput));
  expect(second.sourceRecords[0].payloadHash).toMatch(/^[0-9a-f]{64}$/);
  expect(firstInput).toEqual(makeGame());
  expect(secondInput).toEqual(makeGame());
});

test('preserves authoritative fields when optional enrichment is absent', () => {
  const masterGame = buildMasterGameObject({ cfbDataGame: makeGame() });

  expect(masterGame).toMatchObject({
    canonicalKey: 'football:2026:2026-09-05T19:30:00.000Z:duke:tulane',
    season: 2026,
    week: 2,
    startAt: '2026-09-05T19:30:00Z',
    status: 'final',
  });
  expect(masterGame.participants).toMatchObject([
    { role: 'home', score: 17 },
    { role: 'away', score: 3 },
  ]);
  expect(masterGame.enrichments).toEqual({});
  expect(masterGame.sourceRecords[0]).toMatchObject({
    provider: 'cfbdata',
    externalGameId: '401858209',
  });
});

test('rejects a provider payload without an external game id', () => {
  expect(() => buildMasterGameObject({ cfbDataGame: {} }))
    .toThrow(new Error('CFBData game is missing an external id'));
});

test('maps scheduled and in-progress provider states', () => {
  expect(buildMasterGameObject({
    cfbDataGame: makeGame({ completed: false, started: false }),
  }).status).toBe('scheduled');
  expect(buildMasterGameObject({
    cfbDataGame: makeGame({ completed: false, started: true }),
  }).status).toBe('in_progress');
  expect(buildMasterGameObject({
    cfbDataGame: makeGame({ completed: false, status: 'in_progress' }),
  }).status).toBe('in_progress');
});

test('uses stable fallback identity when a team name is missing', () => {
  const masterGame = buildMasterGameObject({
    cfbDataGame: makeGame({ homeTeam: '', homeId: 150 }),
  });

  expect(masterGame.participants[0].team).toMatchObject({
    externalId: '150',
    slug: 'team-150',
    name: 'Unknown team',
  });
});

test('uses a deterministic date key when startDate is missing', () => {
  const masterGame = buildMasterGameObject({
    cfbDataGame: makeGame({ startDate: null }),
  });

  expect(masterGame.startAt).toBeNull();
  expect(masterGame.canonicalKey).toContain('unknown-401858209');
});

test('keeps null and absent scores as null', () => {
  const masterGame = buildMasterGameObject({
    cfbDataGame: makeGame({ homePoints: null, awayPoints: undefined }),
  });

  expect(masterGame.participants).toMatchObject([
    { role: 'home', score: null },
    { role: 'away', score: null },
  ]);
});

test('slugifies non-ASCII names and punctuation deterministically', () => {
  expect(slugify('École & State!')).toBe('ecole-and-state');
});

test('reuses team identity across different games', () => {
  const first = buildMasterGameObject({ cfbDataGame: makeGame() });
  const second = buildMasterGameObject({
    cfbDataGame: makeGame({
      id: 401858210,
      startDate: '2026-09-12T19:30:00Z',
    }),
  });

  expect(second.participants[0].team).toEqual(first.participants[0].team);
  expect(second.participants[1].team).toEqual(first.participants[1].team);
  expect(second.canonicalKey).not.toBe(first.canonicalKey);
});

test('changes the payload hash when payload content changes', () => {
  const original = makeGame();
  const sameContent = JSON.parse(JSON.stringify(original));
  const changedContent = { ...original, week: 3 };

  expect(getPayloadHash(sameContent)).toBe(getPayloadHash(original));
  expect(getPayloadHash(changedContent)).not.toBe(getPayloadHash(original));
});
