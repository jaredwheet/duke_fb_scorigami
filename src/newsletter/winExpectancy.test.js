import { calculateWinExpectancySnapshots, renderWinExpectancyChart, renderWinExpectancySvg } from './winExpectancy.js';

test('calculates Duke-relative expectancy snapshots around the 50/50 axis', () => {
  const snapshots = calculateWinExpectancySnapshots({
    dukeName: 'Duke',
    opponentName: 'Illinois',
    dukeScore: 31,
    opponentScore: 27,
    plays: [
      { period: 1, clock: { minutes: 15, seconds: 0 }, offense: 'Duke', offenseScore: 0, defense: 'Illinois', defenseScore: 0, wallclock: '2026-09-12T19:30:00Z' },
      { period: 2, clock: { minutes: 12, seconds: 0 }, offense: 'Illinois', offenseScore: 17, defense: 'Duke', defenseScore: 0, wallclock: '2026-09-12T20:00:00Z' },
      { period: 4, clock: { minutes: 0, seconds: 0 }, offense: 'Duke', offenseScore: 31, defense: 'Illinois', defenseScore: 27, wallclock: '2026-09-12T22:30:00Z' },
    ],
  });

  expect(snapshots[0]).toMatchObject({ progress: 0, expectancy: 0 });
  expect(snapshots.some((snapshot) => snapshot.expectancy < 0)).toBe(true);
  expect(snapshots.at(-1)).toMatchObject({ progress: 1, expectancy: 50 });
});

test('keeps snapshot progress monotonic when wall-clock order conflicts with game-clock order', () => {
  const snapshots = calculateWinExpectancySnapshots({
    dukeName: 'Duke',
    opponentName: 'Illinois',
    dukeScore: 7,
    opponentScore: 0,
    plays: [
      { period: 2, clock: { minutes: 10, seconds: 0 }, offense: 'Duke', offenseScore: 7, defense: 'Illinois', defenseScore: 0, wallclock: '2026-09-12T20:10:00Z' },
      { period: 1, clock: { minutes: 1, seconds: 0 }, offense: 'Duke', offenseScore: 0, defense: 'Illinois', defenseScore: 0, wallclock: '2026-09-12T20:00:00Z' },
    ],
  });

  expect(snapshots.every((snapshot, index) => index === 0 || snapshot.progress >= snapshots[index - 1].progress)).toBe(true);
});

test('renders a chart SVG and PNG', async () => {
  const snapshots = [{ progress: 0, expectancy: 0 }, { progress: 1, expectancy: 50 }];
  const svg = renderWinExpectancySvg(snapshots);
  const png = await renderWinExpectancyChart(snapshots);

  expect(svg).toContain('DUKE WIN EXPECTANCY');
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});
