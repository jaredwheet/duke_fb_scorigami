import { EVENT_LOGIC_VERSION } from '../eventDetector.js';
import { fetchAllRows, refreshDukeFacts } from './refreshFacts.js';

function pagedClient(pages, calls = []) {
  return {
    from() {
      return {
        select() {
          return this;
        },
        order() {
          return this;
        },
        range(offset) {
          calls.push(offset);
          return Promise.resolve({ data: pages[offset] || [], error: null });
        },
      };
    },
  };
}

function makeCanonicalRows(count = 1001) {
  const games = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    canonical_key: `football:history:${index + 1}`,
    season: 1900 + Math.floor(index / 365),
    start_at: new Date(Date.UTC(1900, 0, index + 1)).toISOString(),
    status: 'final',
  }));
  const participants = games.flatMap((game) => [
    { id: game.id * 2, game_id: game.id, team_id: 1, participant_role: 'home', score: 17 },
    { id: game.id * 2 + 1, game_id: game.id, team_id: 2, participant_role: 'away', score: 3 },
  ]);
  return {
    games,
    game_participants: participants,
    teams: [
      { id: 1, slug: 'duke', name: 'Duke' },
      { id: 2, slug: 'opponent', name: 'Opponent' },
    ],
    game_analytics: [],
  };
}

function refreshClient({ rows, failAt = null } = {}) {
  const calls = [];
  const writes = [];
  const state = new Map();
  const conflictFields = (options) => String(options?.onConflict || 'id').split(',');
  const keyFor = (table, payload, options) => `${table}:${conflictFields(options).map((field) => payload[field]).join('|')}`;
  const client = {
    calls,
    writes,
    state,
    from(table) {
      const query = {
        select() {
          return query;
        },
        order() {
          return query;
        },
        range(offset, end) {
          calls.push({ table, offset, end });
          if (failAt?.table === table && failAt.offset === offset) {
            return Promise.resolve({ data: null, error: failAt.error });
          }
          const data = rows[table].slice(offset, end + 1);
          return Promise.resolve({ data, error: null });
        },
        upsert(payload, options) {
          const row = { table, payload, options };
          writes.push(row);
          state.set(keyFor(table, payload, options), payload);
          return Promise.resolve({ error: null });
        },
        delete() {
          query.deleteMode = true;
          query.filters = {};
          return query;
        },
        eq(field, value) {
          if (!query.deleteMode) return query;
          query.filters[field] = value;
          return query;
        },
        then(resolve, reject) {
          if (!query.deleteMode) return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          writes.push({ table, operation: 'delete', filters: query.filters });
          for (const [key, payload] of state.entries()) {
            if (key.startsWith(`${table}:`)
              && Object.entries(query.filters).every(([field, value]) => payload[field] === value)) {
              state.delete(key);
            }
          }
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return client;
}

test('fetches every page when canonical tables exceed the API page size', async () => {
  const rows = await fetchAllRows(pagedClient({
    0: [{ id: 1 }, { id: 2 }],
    2: [{ id: 3 }],
  }), 'games', 'id', { pageSize: 2 });

  expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
});

test('pagination refresh includes every canonical page beyond 500 rows', async () => {
  const rows = makeCanonicalRows();
  const client = refreshClient({ rows });

  await expect(refreshDukeFacts(client)).resolves.toBe(1001);

  expect(client.calls.filter(({ table }) => table === 'games').map(({ offset }) => offset))
    .toEqual([0, 500, 1000]);
  expect(client.calls.filter(({ table }) => table === 'game_participants').map(({ offset }) => offset))
    .toEqual([0, 500, 1000, 1500, 2000]);
  expect(client.writes.filter(({ table, operation }) => table === 'game_facts' && operation !== 'delete'))
    .toHaveLength(1001);
  expect(client.writes.find(({ payload }) => payload?.game_id === 1001)).toBeDefined();
});

test('pagination exact multiple requests one empty page and terminates', async () => {
  const rows = Array.from({ length: 500 }, (_, index) => ({ id: index + 1 }));
  const calls = [];
  const client = pagedClient({ 0: rows }, calls);

  await expect(fetchAllRows(client, 'games', 'id')).resolves.toHaveLength(500);
  expect(calls).toEqual([0, 500]);
});

test('pagination empty history returns zero without fact or directive writes', async () => {
  const client = refreshClient({
    rows: { games: [], game_participants: [], teams: [], game_analytics: [] },
  });

  await expect(refreshDukeFacts(client)).resolves.toBe(0);
  expect(client.writes).toHaveLength(0);
});

test('pagination page failure rejects before any persistence write', async () => {
  const rows = makeCanonicalRows();
  const error = new Error('game page unavailable');
  const client = refreshClient({ rows, failAt: { table: 'games', offset: 500, error } });

  await expect(refreshDukeFacts(client)).rejects.toBe(error);
  expect(client.writes).toHaveLength(0);
});

test('directive refresh persists only the primary directive for a game', async () => {
  const rows = makeCanonicalRows(1);
  rows.game_analytics = [{
    id: 1,
    game_id: 1,
    provider: 'cfbdata',
    metric_set: 'game_details',
    payload: {
      playerStats: [{ teams: [{
        team: 'Duke',
        categories: [{ name: 'passing', types: [{ name: 'YDS', athletes: [{ name: 'Duke QB', stat: '500' }] }] }],
      }] }],
      plays: [
        { playNumber: 1, period: 2, offense: 'Opponent', defense: 'Duke', offenseScore: 14, defenseScore: 0, clock: { minutes: 4, seconds: 0 } },
        { playNumber: 2, period: 4, offense: 'Duke', defense: 'Opponent', offenseScore: 31, defenseScore: 27, clock: { minutes: 0, seconds: 0 } },
      ],
    },
  }];
  const client = refreshClient({ rows });

  await refreshDukeFacts(client);

  const directives = client.writes.filter(({ table, operation }) => table === 'editorial_directives' && operation !== 'delete');
  expect(directives).toHaveLength(2);
  expect(new Set(directives.map(({ payload }) => payload.directive_key))).toEqual(new Set(['scorigami_final']));
});

test('directive refresh separates changed logic versions and reuses a repeated version', async () => {
  const rows = makeCanonicalRows(1);
  const client = refreshClient({ rows });

  await refreshDukeFacts(client);
  await refreshDukeFacts(client, { logicVersion: 'v3' });
  await refreshDukeFacts(client, { logicVersion: 'v3' });

  const facts = client.writes.filter(({ table, operation }) => table === 'game_facts' && operation !== 'delete');
  const directives = client.writes.filter(({ table, operation }) => table === 'editorial_directives' && operation !== 'delete');
  expect(facts[0].payload.logic_version).toBe(EVENT_LOGIC_VERSION);
  expect(new Set(facts.map(({ payload }) => payload.logic_version))).toEqual(new Set([EVENT_LOGIC_VERSION, 'v3']));
  expect(new Set(directives.map(({ payload }) => payload.logic_version))).toEqual(new Set([EVENT_LOGIC_VERSION, 'v3']));
  expect(client.state.size).toBe(6);
});

test('safeguard refresh clears stale unsupported facts and directives', async () => {
  const rows = makeCanonicalRows(1);
  const client = refreshClient({ rows });

  await refreshDukeFacts(client);
  rows.game_participants[0].score = null;
  await refreshDukeFacts(client);

  expect([...client.state.keys()].some((key) => key.startsWith('game_facts:'))).toBe(false);
  expect([...client.state.keys()].some((key) => key.startsWith('editorial_directives:'))).toBe(false);
});
