import { buildSundayIssueData } from './issueData.js';

test('builds Sunday content from verified game and play facts', () => {
  const data = buildSundayIssueData({
    game: { id: 1, season: 2026, start_at: '2026-09-12T19:30:00Z', venue_name: 'Memorial Stadium' },
    participants: [
      { team: { slug: 'illinois', name: 'Illinois' }, role: 'home', score: 27 },
      { team: { slug: 'duke', name: 'Duke' }, role: 'away', score: 31 },
    ],
    sourcePayload: { id: 401858217, homeTeam: 'Illinois', awayTeam: 'Duke' },
    detailsPayload: {
      teamStats: [{ teams: [
        { team: 'Illinois', stats: [{ category: 'turnovers', stat: '1' }] },
        { team: 'Duke', stats: [
          { category: 'turnovers', stat: '0' },
          { category: 'rushingYards', stat: '170' },
        ] },
      ] }],
      playerStats: [{ teams: [{
        team: 'Duke',
        categories: [
          { name: 'passing', types: [
            { name: 'C/ATT', athletes: [{ name: 'Duke QB', stat: '20/30' }] },
            { name: 'YDS', athletes: [{ name: 'Duke QB', stat: '250' }] },
            { name: 'TD', athletes: [{ name: 'Duke QB', stat: '2' }] },
            { name: 'INT', athletes: [{ name: 'Duke QB', stat: '1' }] },
          ] },
          { name: 'rushing', types: [
            { name: 'YDS', athletes: [{ name: 'Duke RB', stat: '147' }] },
            { name: 'TD', athletes: [{ name: 'Duke RB', stat: '1' }] },
          ] },
        ],
      }] }],
      plays: [
        { playNumber: 1, period: 1, offense: 'Duke', defense: 'Illinois', offenseScore: 7, defenseScore: 0, scoring: true, clock: { minutes: 10, seconds: 0 }, playText: 'Touchdown' },
        { playNumber: 2, period: 4, offense: 'Duke', defense: 'Illinois', offenseScore: 31, defenseScore: 27, scoring: true, clock: { minutes: 2, seconds: 0 }, playText: 'Touchdown' },
      ],
    },
    facts: { scorigami: { isNew: false, scorePair: '27-31', occurrenceCount: 2 } },
    directive: { directive_key: 'comeback' },
  });

  expect(data.headline).toBe('DUKE OUTLASTS ILLINOIS');
  expect(data.subheadline).toBe('The Blue Devils won the turnover battle 1-0 and ran for 170 yards in a 31-27 road win.');
  expect(data.narrative).toBe('On the road, Duke QB threw for 250 yards and 2 touchdowns. Duke RB ran for 147 yards and a touchdown.');
  expect(data.quarters[0].final).toBe(31);
  expect(data.scoring_plays).toHaveLength(2);
  expect(data.numbers[1]).toEqual({ value: '+1', label: 'TURNOVER MARGIN', detail: 'Duke 0, Illinois 1.' });
  expect(data.leaders.passing[0]).toEqual({ name: 'Duke QB', line: '20/30, 250 YDS, 2 TD, 1 INT' });
  expect(data.scorigami_status).toBe('FAMILIAR TERRITORY.');
  expect(data.source_url).toBe('https://www.winsipedia.com/duke/schedule/2026');
});
