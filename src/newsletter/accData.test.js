import { normalizeAccContext } from './accData.js';

test('normalizes ACC standings and excludes the current Duke game from results', () => {
  const context = normalizeAccContext({
    currentGameId: 10,
    records: [
      { team: 'Duke', conference: 'ACC', total: { wins: 2, losses: 0, ties: 0 }, conferenceGames: { wins: 1, losses: 0, ties: 0 } },
      { team: 'Clemson', conference: 'ACC', total: { wins: 1, losses: 1, ties: 0 }, conferenceGames: { wins: 0, losses: 1, ties: 0 } },
    ],
    rankings: [{ polls: [{ poll: 'AP Top 25', ranks: [{ rank: 12, school: 'Duke', conference: 'ACC' }] }] }],
    games: [
      { id: 10, completed: true, homeConference: 'Big Ten', awayConference: 'ACC', homeTeam: 'Illinois', awayTeam: 'Duke', homePoints: 27, awayPoints: 31, startDate: '2026-09-12T19:30:00Z' },
      { id: 11, completed: true, homeConference: 'ACC', awayConference: 'ACC', homeTeam: 'Clemson', awayTeam: 'Boston College', homePoints: 31, awayPoints: 14, startDate: '2026-09-12T16:00:00Z' },
      { id: 12, completed: true, homeConference: 'SEC', awayConference: 'Big Ten', homeTeam: 'Georgia', awayTeam: 'Michigan', homePoints: 24, awayPoints: 21, startDate: '2026-09-12T16:00:00Z' },
    ],
  });

  expect(context.standings[0]).toMatchObject({ team: 'Duke', rank: 12, conferenceRecord: '1-0', overallRecord: '2-0' });
  expect(context.results).toEqual([{ winner: 'Clemson', loser: 'Boston College', score: '31-14', startDate: '2026-09-12T16:00:00Z' }]);
});
