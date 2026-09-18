import { jest } from '@jest/globals';
import { buildMasterGameObject, persistMasterGame } from './ingestionEngine.js';
import { runIngestion } from './runDukeIngestion.js';

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

function makeMasterGame(overrides = {}, enrichments = {}) {
  return buildMasterGameObject({
    cfbDataGame: makeGame(overrides),
    enrichments,
  });
}

class FakeQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.data = null;
    this.error = null;
  }

  upsert(payload, options) {
    this.client.calls.push({ table: this.table, payload, options });
    this.error = this.client.errorFor(this.table, payload);
    if (!this.error) this.data = this.client.upsert(this.table, payload, options);
    return this;
  }

  select() {
    return this;
  }

  single() {
    return Promise.resolve({ data: this.data, error: this.error });
  }

  then(resolve, reject) {
    return Promise.resolve({ data: this.data, error: this.error }).then(resolve, reject);
  }
}

function createFakeClient({ failTable = null, failCanonicalKey = null } = {}) {
  const tables = new Map();
  const calls = [];
  let nextId = 1;
  let failureUsed = false;

  function conflictKey(table, payload, options) {
    const fields = String(options?.onConflict || 'id').split(',');
    return `${table}:${fields.map((field) => payload[field]).join('|')}`;
  }

  const client = {
    calls,
    lastError: null,
    from(table) {
      return new FakeQuery(client, table);
    },
    errorFor(table, payload) {
      const matchesTable = failTable === table;
      const matchesGame = failCanonicalKey && payload.canonical_key === failCanonicalKey;
      if ((!matchesTable && !matchesGame) || failureUsed) return null;
      failureUsed = true;
      client.lastError = new Error(`persist failed at ${table}`);
      return client.lastError;
    },
    upsert(table, payload, options) {
      const key = conflictKey(table, payload, options);
      if (!tables.has(table)) tables.set(table, new Map());
      const rows = tables.get(table);
      const existing = rows.get(key);
      const row = { ...(existing || { id: nextId++ }), ...payload };
      rows.set(key, row);
      return { id: row.id };
    },
    count(table) {
      return tables.get(table)?.size || 0;
    },
    rows(table) {
      return [...(tables.get(table)?.values() || [])];
    },
  };

  return client;
}

test('repeat persistence reuses all canonical identities', async () => {
  const client = createFakeClient();
  const masterGame = makeMasterGame({}, {
    details: {
      provider: 'details',
      metricSet: 'team',
      data: { passingYards: 200 },
    },
  });

  await persistMasterGame(masterGame, client);
  await persistMasterGame(masterGame, client);

  expect(client.count('sports')).toBe(1);
  expect(client.count('teams')).toBe(2);
  expect(client.count('games')).toBe(1);
  expect(client.count('game_participants')).toBe(2);
  expect(client.count('game_source_records')).toBe(1);
  expect(client.count('game_analytics')).toBe(1);

  const expectedConflictKeys = {
    sports: 'slug',
    teams: 'sport_id,slug',
    games: 'canonical_key',
    game_participants: 'game_id,participant_role',
    game_source_records: 'provider,external_game_id',
    game_analytics: 'game_id,provider,metric_set',
  };
  for (const [table, conflictKey] of Object.entries(expectedConflictKeys)) {
    expect(client.calls.find(({ table: calledTable }) => calledTable === table)
      .options.onConflict).toBe(conflictKey);
  }
});

test('repeat persistence updates existing game state and analytics', async () => {
  const client = createFakeClient();
  const scheduled = makeMasterGame({
    completed: false,
    started: false,
    homePoints: null,
    awayPoints: null,
  }, {
    details: { provider: 'details', metricSet: 'team', data: { passingYards: 0 } },
  });
  const final = makeMasterGame({}, {
    details: { provider: 'details', metricSet: 'team', data: { passingYards: 200 } },
  });

  await persistMasterGame(scheduled, client);
  await persistMasterGame(final, client);

  expect(client.count('games')).toBe(1);
  expect(client.count('game_analytics')).toBe(1);
  expect(client.rows('games')).toEqual([
    expect.objectContaining({ status: 'final', canonical_key: final.canonicalKey }),
  ]);
  expect(client.rows('game_participants')).toEqual(expect.arrayContaining([
    expect.objectContaining({ score: 17 }),
    expect.objectContaining({ score: 3 }),
  ]));
  expect(client.rows('game_analytics')).toEqual([
    expect.objectContaining({
      payload: expect.objectContaining({ passingYards: 200 }),
    }),
  ]);
});

test('mid-batch persistence failure rejects and can be retried', async () => {
  const client = createFakeClient({ failTable: 'game_participants' });
  const masterGame = makeMasterGame();

  await expect(persistMasterGame(masterGame, client))
    .rejects.toThrow('persist failed at game_participants');
  expect(client.lastError).toMatchObject({
    persistenceStage: 'game_participants',
    canonicalKey: masterGame.canonicalKey,
  });
  expect(client.count('sports')).toBe(1);
  expect(client.count('teams')).toBe(2);
  expect(client.count('games')).toBe(1);
  expect(client.count('game_participants')).toBe(0);

  await expect(persistMasterGame(masterGame, client)).resolves.toBeDefined();
  expect(client.count('game_participants')).toBe(2);
  expect(client.count('game_source_records')).toBe(1);
});

test.each([
  'sports',
  'teams',
  'games',
  'game_participants',
  'game_source_records',
  'game_analytics',
])('surfaces persistence failure at each write boundary: %s', async (failTable) => {
  const client = createFakeClient({ failTable });
  const masterGame = makeMasterGame({}, {
    details: {
      provider: 'details',
      metricSet: 'team',
      data: { passingYards: 200 },
    },
  });

  let caughtError;
  try {
    await persistMasterGame(masterGame, client);
  } catch (error) {
    caughtError = error;
  }
  expect(caughtError).toBe(client.lastError);
  expect(caughtError).toMatchObject({
    persistenceStage: failTable,
    canonicalKey: masterGame.canonicalKey,
  });
  const failedAt = client.calls.findIndex(({ table }) => table === failTable);
  expect(failedAt).toBeGreaterThanOrEqual(0);
  expect(client.calls.slice(failedAt + 1)).toHaveLength(0);
});

test('multi-game failure leaves earlier game reusable and retries the failed game', async () => {
  const first = makeMasterGame();
  const second = makeMasterGame({
    id: 401858210,
    startDate: '2026-09-12T19:30:00Z',
  });
  const client = createFakeClient({ failCanonicalKey: second.canonicalKey });

  const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

  try {
    await expect(runIngestion({
      season: 2026,
      ingester: async () => [first, second],
      persister: (game) => persistMasterGame(game, client),
    })).rejects.toThrow('persist failed at games');
    expect(client.lastError).toMatchObject({
      persistenceStage: 'games',
      canonicalKey: second.canonicalKey,
    });
    expect(client.count('games')).toBe(1);

    await runIngestion({
      season: 2026,
      ingester: async () => [second],
      persister: (game) => persistMasterGame(game, client),
    });
    expect(client.count('games')).toBe(2);
    expect(client.count('game_participants')).toBe(4);
    expect(client.count('game_source_records')).toBe(2);
  } finally {
    consoleLog.mockRestore();
  }
});

test('missing enrichment does not create analytics rows', async () => {
  const client = createFakeClient();

  await persistMasterGame(makeMasterGame(), client);

  expect(client.count('game_analytics')).toBe(0);
});
