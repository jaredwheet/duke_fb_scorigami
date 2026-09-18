import { getDukeGame, getNextScheduledDukeGame } from './gameApi.js';

test('next scheduled game uses the supplied reference instant', async () => {
  const games = [
    { id: 1, completed: false, startDate: '2026-09-16T16:59:59Z' },
    { id: 2, completed: false, startDate: '2026-09-16T17:00:01Z' },
  ];

  await expect(getNextScheduledDukeGame(games, new Date('2026-09-16T17:00:00Z')))
    .resolves.toMatchObject({ id: 2 });
});

test('next scheduled game ignores completed games and sorts future games', async () => {
  const games = [
    { id: 1, completed: true, startDate: '2026-09-17T12:00:00Z' },
    { id: 2, completed: false, startDate: '2026-09-20T12:00:00Z' },
    { id: 3, completed: false, startDate: '2026-09-18T12:00:00Z' },
  ];

  await expect(getNextScheduledDukeGame(games, new Date('2026-09-16T12:00:00Z')))
    .resolves.toMatchObject({ id: 3 });
});

test('game lookup matches the controlled Chicago calendar date', async () => {
  const games = [{ id: 4, startDate: '2026-09-06T00:30:00Z' }];

  await expect(getDukeGame('2026-09-05', games)).resolves.toMatchObject({ id: 4 });
});
