import { jest } from '@jest/globals';
import { EVENT_LOGIC_VERSION } from '../eventDetector.js';

jest.unstable_mockModule('../supabaseClient.js', () => ({ default: {} }));

const { loadLatestSundayIssueData } = await import('./loadSundayIssueData.js');

function createClient() {
  const calls = [];
  const game = {
    id: 1,
    season: 2026,
    week: 2,
    start_at: '2026-09-05T19:30:00Z',
    status: 'final',
    venue_name: 'Wallace Wade Stadium',
  };
  const participants = [
    { team_id: 1, participant_role: 'home', score: 17 },
    { team_id: 2, participant_role: 'away', score: 3 },
  ];
  const teams = [
    { id: 1, slug: 'duke', name: 'Duke' },
    { id: 2, slug: 'tulane', name: 'Tulane' },
  ];
  const factRows = [
    { logic_version: 'v1', value: { scorigami: { isNew: false, scorePair: '3-17' } } },
    { logic_version: EVENT_LOGIC_VERSION, value: { scorigami: { isNew: true, scorePair: '3-17' } } },
  ];
  const directiveRows = [
    { logic_version: 'v1', directive_key: 'old', tier: 1, priority: 100, facts: {}, issue_type: 'sunday' },
    { logic_version: EVENT_LOGIC_VERSION, directive_key: 'current', tier: 1, priority: 100, facts: {}, issue_type: 'sunday' },
  ];

  function dataFor(table, filters) {
    if (table === 'sports') return { id: 1, slug: 'football' };
    if (table === 'games') return filters.status === 'final' ? [game] : [];
    if (table === 'game_participants') return filters.game_id === game.id ? participants : [];
    if (table === 'teams') return teams;
    if (table === 'game_source_records') return [{ payload: { id: game.id } }];
    if (table === 'game_analytics') return [{ payload: {} }];
    if (table === 'game_facts') return factRows.filter((row) => row.logic_version === filters.logic_version);
    if (table === 'editorial_directives') return directiveRows.filter((row) => row.logic_version === filters.logic_version);
    return [];
  }

  return {
    calls,
    from(table) {
      const filters = {};
      const query = {
        select() {
          return query;
        },
        eq(field, value) {
          filters[field] = value;
          return query;
        },
        gt(field, value) {
          filters[field] = value;
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          return query;
        },
        then(resolve, reject) {
          calls.push({ table, filters: { ...filters } });
          return Promise.resolve({ data: dataFor(table, filters), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test('newsletter loader reads facts and directives for the current logic version', async () => {
  const client = createClient();
  const previousKey = process.env.CFB_DATA_KEY;
  delete process.env.CFB_DATA_KEY;

  try {
    await loadLatestSundayIssueData(client);
  } finally {
    if (previousKey == null) delete process.env.CFB_DATA_KEY;
    else process.env.CFB_DATA_KEY = previousKey;
  }

  expect(client.calls.find(({ table }) => table === 'game_facts').filters.logic_version)
    .toBe(EVENT_LOGIC_VERSION);
  expect(client.calls.find(({ table }) => table === 'editorial_directives').filters.logic_version)
    .toBe(EVENT_LOGIC_VERSION);
  expect(client.calls.find(({ table }) => table === 'games').filters.sport_id).toBe(1);
  expect(client.calls.find(({ table }) => table === 'teams').filters.sport_id).toBe(1);
});
