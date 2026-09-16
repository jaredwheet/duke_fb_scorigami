import { buildGameDetailsParams } from './cfbData.js';

test('uses the CFBD box-score game id query parameter', () => {
  const params = buildGameDetailsParams({
    season: 2026,
    sourceRecords: [{ externalGameId: 401858217 }],
  });

  expect(params.get('year')).toBe('2026');
  expect(params.get('id')).toBe('401858217');
  expect(params.get('team')).toBe('Duke');
  expect(params.get('gameId')).toBeNull();
});
