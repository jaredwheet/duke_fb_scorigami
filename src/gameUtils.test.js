import {
  getDukeScoreDetails,
  getRecentCompletedDukeGames,
  getWinsipediaSeasonUrl,
} from './gameUtils.js';

test('builds a stable Winsipedia season URL', () => {
  expect(getWinsipediaSeasonUrl(2026)).toBe('https://www.winsipedia.com/duke/schedule/2026');
});

describe('getDukeScoreDetails', () => {
  test('uses Duke home and away scores correctly', () => {
    expect(getDukeScoreDetails({
      homeTeam: 'Duke',
      awayTeam: 'Virginia',
      homePoints: 28,
      awayPoints: 17,
    })).toMatchObject({
      dukeIsHome: true,
      dukeScore: 28,
      oppScore: 17,
      opponent: 'Virginia',
      scoreKey: '28-17',
    });

    expect(getDukeScoreDetails({
      homeTeam: 'Virginia',
      awayTeam: 'Duke',
      homePoints: 17,
      awayPoints: 28,
    })).toMatchObject({
      dukeIsHome: false,
      dukeScore: 28,
      oppScore: 17,
      opponent: 'Virginia',
      scoreKey: '28-17',
    });
  });
});

describe('getRecentCompletedDukeGames', () => {
  test('returns completed games in chronological order within the recovery window', () => {
    const now = new Date('2026-09-14T12:00:00Z');
    const games = [
      { id: 3, startDate: '2026-09-10T23:00:00Z', completed: true, homePoints: 21, awayPoints: 14 },
      { id: 1, startDate: '2026-09-01T23:00:00Z', completed: true, homePoints: 21, awayPoints: 14 },
      { id: 2, startDate: '2026-09-05T23:00:00Z', completed: false, homePoints: null, awayPoints: null },
    ];

    expect(getRecentCompletedDukeGames(games, now, 14).map((game) => game.id)).toEqual([1, 3]);
  });
});
