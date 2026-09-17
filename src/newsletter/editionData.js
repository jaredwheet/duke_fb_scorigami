function formatEditionDate(issueDate) {
  if (!issueDate) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date(`${issueDate}T12:00:00Z`));
}

function archiveDetail(issueData) {
  return issueData.guide_context?.opponentHistory?.statement
    || issueData.guide_context?.historicalFact?.statement
    || issueData.scorigami_context
    || 'The archive is still being indexed.';
}

export function buildWatercoolerIssueData(issueData, { issueDate } = {}) {
  const context = issueData.watercooler_context || {};
  const opponent = context.upcomingOpponent || issueData.next_opponent || 'the next opponent';
  return {
    ...issueData,
    publication_key: 'wallace-wade-watercooler',
    edition: 'watercooler',
    issue_date_key: issueDate || issueData.issue_date_key,
    issue_date: formatEditionDate(issueDate || issueData.issue_date_key),
    subject: 'The Wallace Wade Watercooler',
    preview_text: 'A mid-week trip through Duke football history, records, and statistical oddities.',
    edition_name: 'THE WALLACE WADE WATERCOOLER',
    headline: `THE OPPONENT FILE: ${opponent.toUpperCase()}`,
    subheadline: `A mid-week walk through the dates, meetings, and odd facts waiting in Duke's archive.`,
    brief_lead: `Duke's next opponent is ${opponent}. Before the weekend arrives, here is the part of the archive that makes the matchup more interesting than the schedule grid suggests.`,
    brief_sections: [
      { label: `THIS WEEK IN DUKE HISTORY (${context.weekLabel || 'THE ARCHIVE'})`, detail: context.weekSummary || 'The calendar archive is still being indexed.' },
      { label: `THE ${opponent.toUpperCase()} FILE`, detail: context.opponentHistory || archiveDetail(issueData) },
      { label: 'THE HMM FACT', detail: context.historicalFact || 'The archive is still looking for its oddest footnote.' },
      { label: 'RECENT MEETINGS', detail: context.recentOpponentGames?.join('; ') || context.nextGameFact || `Duke meets ${opponent} next.` },
    ],
  };
}

export function buildVictoryBellBulletinIssueData(issueData, { issueDate, odds = null } = {}) {
  const opponent = issueData.next_opponent || 'the next opponent';
  const oddsDetail = odds?.summary || 'Betting lines are not available from the configured odds feed.';
  const lastGameDetail = issueData.narrative || `Duke last played ${issueData.current_opponent || 'a ranked opponent'}.`;
  return {
    ...issueData,
    publication_key: 'victory-bell-bulletin',
    edition: 'bulletin',
    issue_date_key: issueDate || issueData.issue_date_key,
    issue_date: formatEditionDate(issueDate || issueData.issue_date_key),
    game_id: issueData.next_game_id,
    publication_anchor_game_id: issueData.next_game_id,
    subject: `The Victory Bell Bulletin: Duke vs ${opponent}`,
    preview_text: `The numbers, matchup, and betting board for Duke's game against ${opponent}.`,
    edition_name: 'THE VICTORY BELL BULLETIN',
    headline: `DUKE VS ${opponent.toUpperCase()}`,
    subheadline: 'The weekend primer: matchup notes, betting lines, and the numbers to know.',
    brief_lead: `Duke's next assignment is ${opponent}. ${issueData.next_details || 'Game details are still being confirmed.'}`,
    brief_sections: [
      { label: 'THE MATCHUP', detail: issueData.next_details || `Duke meets ${opponent}.` },
      { label: 'BETTING BOARD', detail: oddsDetail },
      { label: 'NUMBERS TO KNOW', detail: lastGameDetail },
    ],
    odds,
  };
}
