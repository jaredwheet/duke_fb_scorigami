import { buildVictoryBellBulletinIssueData, buildWatercoolerIssueData } from './editionData.js';

const baseIssue = {
  current_opponent: 'Illinois',
  next_opponent: 'Stanford',
  next_details: 'Saturday, September 19 · 4:00 PM ET · Wallace Wade Stadium · TV: The CW',
  next_game_id: 3,
  issue_date_key: '2026-09-12',
  narrative: 'Duke won a road game and made the fourth quarter interesting.',
  scorigami_status: 'FAMILIAR TERRITORY.',
  scorigami_context: 'The score has happened before.',
  numbers: [{ value: '+1', label: 'TURNOVER MARGIN', detail: 'Duke took care of the ball.' }],
  guide_context: {
    opponentHistory: { statement: 'Duke leads the series 2-1.' },
    historicalFact: { statement: 'The archive remembers this matchup.' },
    recordWatch: { statement: 'A program record is within reach.' },
  },
};

test('builds the Wallace Wade Watercooler contract', () => {
  const issue = buildWatercoolerIssueData(baseIssue, { issueDate: '2026-09-16' });
  expect(issue).toMatchObject({
    publication_key: 'wallace-wade-watercooler',
    edition: 'watercooler',
    edition_name: 'THE WALLACE WADE WATERCOOLER',
    issue_date_key: '2026-09-16',
  });
  expect(issue.brief_sections[0].detail).toBe('Duke leads the series 2-1.');
});

test('builds the Victory Bell Bulletin without inventing betting lines', () => {
  const issue = buildVictoryBellBulletinIssueData(baseIssue, { issueDate: '2026-09-18' });
  expect(issue).toMatchObject({
    publication_key: 'victory-bell-bulletin',
    edition: 'bulletin',
    game_id: 3,
    edition_name: 'THE VICTORY BELL BULLETIN',
  });
  expect(issue.brief_sections[1].detail).toContain('not available');
});
