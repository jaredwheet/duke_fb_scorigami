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
        { team: 'Illinois', stats: [
          { category: 'turnovers', stat: '1' },
          { category: 'fourthDownEff', stat: '1-3' },
          { category: 'totalYards', stat: '382' },
        ] },
        { team: 'Duke', stats: [
          { category: 'turnovers', stat: '0' },
          { category: 'fourthDownEff', stat: '2-2' },
          { category: 'totalYards', stat: '376' },
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
        { playNumber: 1, period: 1, offense: 'Duke', defense: 'Illinois', offenseScore: 7, defenseScore: 0, scoring: true, clock: { minutes: 10, seconds: 0 }, playText: '(08:34) Shotgun #2 W.Eget pass complete short right to #20 N.Sheppard caught at ILL05, for 7 yards to the ILL00 TOUCHDOWN' },
        { playNumber: 2, period: 4, offense: 'Duke', defense: 'Illinois', offenseScore: 10, defenseScore: 3, scoring: true, clock: { minutes: 2, seconds: 0 }, playText: '(13:53) #39 C.Salas field goal attempt from 39 yards GOOD' },
        { playNumber: 3, period: 3, offense: 'Illinois', defense: 'Duke', offenseScore: 3, defenseScore: 7, scoring: true, clock: { minutes: 5, seconds: 0 }, playText: '(05:08) #37 E.Moczulski field goal attempt from 47 yards GOOD' },
      ],
    },
    facts: { scorigami: { isNew: false, scorePair: '27-31', occurrenceCount: 2 } },
    directive: { directive_key: 'comeback' },
  });

  expect(data.headline).toBe('DUKE OUTLASTS ILLINOIS');
  expect(data.subheadline).toBe('Duke ran for 170 yards in a 31-27 road win over Illinois.');
  expect(data.narrative).toBe('On the road, Duke QB threw for 250 yards and 2 touchdowns. Duke RB ran for 147 yards and a touchdown.');
  expect(data.quarters[0].final).toBe(31);
  expect(data.quarters[1].q3).toBe(3);
  expect(data.quarters[1].q4).toBe(0);
  expect(data.scoring_plays).toHaveLength(3);
  expect(data.scoring_plays[0]).toMatchObject({ description: 'Eget to Sheppard, 7-yard touchdown' });
  expect(data.scoring_plays[1]).toMatchObject({ team: 'ILL', period: '05:00', description: 'Moczulski, 47-yard field goal' });
  expect(data.scoring_plays[2]).toMatchObject({ description: 'Salas, 39-yard field goal' });
  expect(data.numbers[0]).toEqual({ value: 3, label: 'SECOND-HALF POINTS ALLOWED', detail: 'Duke held Illinois to 3 points after halftime.' });
  expect(data.numbers[1]).toEqual({ value: '+1', label: 'TURNOVER MARGIN', detail: 'Turnovers: Duke 0, Illinois 1.' });
  expect(data.numbers[2]).toEqual({ value: '2-2', label: 'FOURTH-DOWN CONVERSIONS', detail: 'Duke converted 2 of 2 fourth downs; Illinois converted 1 of 3.' });
  expect(data.leaders.passing[0]).toEqual({ name: 'Duke QB', line: '20/30, 250 YDS, 2 TD, 1 INT' });
  expect(data.scorigami_status).toBe('FAMILIAR TERRITORY.');
  expect(data.source_url).toBe('https://www.winsipedia.com/duke/schedule/2026');
});

test('keeps the rusher name in a live CFBData rushing touchdown description', () => {
  const data = buildSundayIssueData({
    game: { season: 2026 },
    participants: [
      { team: { slug: 'duke', name: 'Duke' }, score: 31 },
      { team: { slug: 'illinois', name: 'Illinois' }, score: 27 },
    ],
    detailsPayload: {
      plays: [{
        playNumber: 1,
        period: 2,
        offense: 'Duke',
        defense: 'Illinois',
        offenseScore: 14,
        defenseScore: 17,
        scoring: true,
        clock: { minutes: 7, seconds: 5 },
        playText: '(07:09) Shotgun #20 N.Sheppard rush middle for 2 yards gain to the ILL00 TOUCHDOWN',
      }],
    },
    facts: {},
  });

  expect(data.scoring_plays[0].description).toBe('Sheppard, 2-yard touchdown run');
});
