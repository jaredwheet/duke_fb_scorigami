import { buildMasterGameObject } from './ingestionEngine.js';

test('normalizes a CFBData game into a stable master game object', () => {
  const masterGame = buildMasterGameObject({
    cfbDataGame: {
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
    },
  });

  expect(masterGame.canonicalKey).toContain('football:2026:');
  expect(masterGame.status).toBe('final');
  expect(masterGame.participants).toMatchObject([
    { role: 'home', score: 17, team: { slug: 'duke' } },
    { role: 'away', score: 3, team: { slug: 'tulane' } },
  ]);
  expect(masterGame.sourceRecords[0]).toMatchObject({
    provider: 'cfbdata',
    externalGameId: '401858209',
  });
});
