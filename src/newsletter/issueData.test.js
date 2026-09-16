import { buildSundayIssueData } from './issueData.js';

test('builds Sunday content from verified game and play facts', () => {
  const data = buildSundayIssueData({
    game: { id: 1, season: 2026, start_at: '2026-09-12T19:30:00Z', venue_name: 'Memorial Stadium' },
    participants: [
      { team: { slug: 'illinois', name: 'Illinois' }, score: 27 },
      { team: { slug: 'duke', name: 'Duke' }, score: 31 },
    ],
    sourcePayload: { id: 401858217, homeTeam: 'Illinois', awayTeam: 'Duke' },
    detailsPayload: {
      plays: [
        { playNumber: 1, period: 1, offense: 'Duke', defense: 'Illinois', offenseScore: 7, defenseScore: 0, scoring: true, clock: { minutes: 10, seconds: 0 }, playText: 'Touchdown' },
        { playNumber: 2, period: 4, offense: 'Duke', defense: 'Illinois', offenseScore: 31, defenseScore: 27, scoring: true, clock: { minutes: 2, seconds: 0 }, playText: 'Touchdown' },
      ],
    },
    facts: { scorigami: { isNew: false, scorePair: '27-31', occurrenceCount: 2 } },
    directive: { directive_key: 'comeback' },
  });

  expect(data.headline).toBe('DUKE GETS THE WIN');
  expect(data.quarters[0].final).toBe(31);
  expect(data.scoring_plays).toHaveLength(2);
  expect(data.scorigami_status).toBe('FAMILIAR TERRITORY.');
  expect(data.source_url).toBe('https://www.winsipedia.com/duke/schedule/2026');
});
