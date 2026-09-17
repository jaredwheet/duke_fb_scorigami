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
  watercooler_context: {
    upcomingOpponent: 'Stanford',
    weekLabel: 'September 14-20',
    weekSummary: 'Duke has 2 archived games on these calendar dates.',
    backstory: 'Pittsburgh 58, Duke 55: a 113-point September shootout.',
    opponentHistory: 'Duke trails the Stanford series 1-3.',
    historicalFact: 'Duke last beat Stanford in 1971.',
    recentOpponentGames: ['September 20, 2025: Duke 21-24 vs Stanford'],
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
  expect(issue.brief_sections[0].detail).toBe('Duke has 2 archived games on these calendar dates.');
  expect(issue.brief_sections[1].detail).toBe('Pittsburgh 58, Duke 55: a 113-point September shootout.');
  expect(issue.headline).not.toContain('STANFORD');
  expect(issue.brief_lead).not.toContain('Duke won a road game');
});

test('builds the Victory Bell Bulletin without inventing betting lines', () => {
  const issue = buildVictoryBellBulletinIssueData(baseIssue, { issueDate: '2026-09-18' });
  expect(issue).toMatchObject({
    publication_key: 'victory-bell-bulletin',
    edition: 'bulletin',
    game_id: 3,
    edition_name: 'THE VICTORY BELL BULLETIN',
  });
  expect(issue.brief_sections[2].detail).toContain('not available');
});
