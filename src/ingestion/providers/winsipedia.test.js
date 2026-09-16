import { parseWinsipediaSchedule } from './winsipedia.js';

test('parses stable Winsipedia game links from a schedule row', () => {
  const rows = parseWinsipediaSchedule(`
    <table>
      <tr>
        <td>Sep 5, 2026</td>
        <td>Tulane</td>
        <td><a href="/games/duke/vs/tulane/2026/127014">17-3</a></td>
      </tr>
    </table>
  `);

  expect(rows).toEqual([{
    url: 'https://www.winsipedia.com/games/duke/vs/tulane/2026/127014',
    text: 'Sep 5, 2026 Tulane 17-3',
    date: 'Sep 5, 2026',
    opponent: 'Tulane',
    score: '17-3',
  }]);
});
