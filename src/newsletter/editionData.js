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

function numberSummary(numbers = []) {
  return numbers
    .filter((number) => number?.value && number.value !== '—')
    .map((number) => `${number.label}: ${number.value}. ${number.detail}`)
    .join(' ');
}

function archiveDetail(issueData) {
  return issueData.guide_context?.opponentHistory?.statement
    || issueData.guide_context?.historicalFact?.statement
    || issueData.scorigami_context
    || 'The archive is still being indexed.';
}

export function buildWatercoolerIssueData(issueData, { issueDate } = {}) {
  const recordDetail = issueData.guide_context?.recordWatch?.statement
    || issueData.turning_point?.description
    || 'The latest game left the archive with another score, another story, and more to investigate.';
  return {
    ...issueData,
    publication_key: 'wallace-wade-watercooler',
    edition: 'watercooler',
    issue_date_key: issueDate || issueData.issue_date_key,
    issue_date: formatEditionDate(issueDate || issueData.issue_date_key),
    subject: 'The Wallace Wade Watercooler',
    preview_text: 'A mid-week trip through Duke football history, records, and statistical oddities.',
    edition_name: 'THE WALLACE WADE WATERCOOLER',
    headline: issueData.scorigami_status === 'NEW SCORE!' ? 'THE ARCHIVES HAVE A NEW ENTRY' : 'THE ARCHIVES ARE STILL TALKING',
    subheadline: `A mid-week look back at Duke's ${issueData.current_opponent || 'latest'} game and the numbers that refuse to sit quietly.`,
    brief_lead: issueData.narrative,
    brief_sections: [
      { label: 'FROM THE ARCHIVES', detail: archiveDetail(issueData) },
      { label: 'RECORD WATCH', detail: recordDetail },
      { label: 'THE NUMBERS', detail: numberSummary(issueData.numbers) || 'The verified statistical hook is still being assembled.' },
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
