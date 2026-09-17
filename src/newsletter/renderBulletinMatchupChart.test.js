import { renderBulletinMatchupChart } from './renderBulletinMatchupChart.js';

test('renders the bulletin matchup graphic as a PNG', async () => {
  const png = await renderBulletinMatchupChart({
    opponentName: 'Stanford',
    rows: [{ label: 'POINTS / GAME', duke: '29', opponent: '22' }],
  });
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});
