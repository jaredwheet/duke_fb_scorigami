import { findUpcomingOdds } from './odds.js';

test('formats the Duke side of an upcoming odds board', () => {
  const odds = findUpcomingOdds([
    {
      id: 'game-3',
      home_team: 'Duke Blue Devils',
      away_team: 'Stanford Cardinal',
      commence_time: '2026-09-19T20:00:00Z',
      bookmakers: [{
        title: 'Example Sportsbook',
        markets: [
          { key: 'spreads', outcomes: [{ name: 'Duke Blue Devils', point: -3.5, price: -110 }] },
          { key: 'h2h', outcomes: [{ name: 'Duke Blue Devils', price: -155 }] },
          { key: 'totals', outcomes: [{ name: 'Over', point: 51.5, price: -105 }] },
        ],
      }],
    },
  ], { dukeName: 'Duke', opponentName: 'Stanford', startAt: '2026-09-19T20:00:00Z' });

  expect(odds.summary).toContain('Duke -3.5 (-110)');
  expect(odds.summary).toContain('moneyline -155');
  expect(odds.summary).toContain('total Over 51.5 (-105)');
});

test('returns no odds when the event is not available', () => {
  expect(findUpcomingOdds([], { opponentName: 'Stanford' })).toBeNull();
});
