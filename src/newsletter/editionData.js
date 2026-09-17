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
  return {
    ...issueData,
    publication_key: 'wallace-wade-watercooler',
    edition: 'watercooler',
    issue_date_key: issueDate || issueData.issue_date_key,
    issue_date: formatEditionDate(issueDate || issueData.issue_date_key),
    subject: 'The Wallace Wade Watercooler',
    preview_text: 'A mid-week trip through Duke football history, records, and statistical oddities.',
    edition_name: 'THE WALLACE WADE WATERCOOLER',
    headline: 'THE ARCHIVE GETS WEIRD',
    subheadline: 'A mid-week walk through the dates, scoreboards, and stories that refuse to stay buried.',
    brief_lead: context.backstory || 'Before the weekend arrives, here is the part of the archive that makes Duke football more interesting than the schedule grid suggests.',
    brief_sections: [
      { label: `THIS WEEK IN DUKE HISTORY (${context.weekLabel || 'THE ARCHIVE'})`, detail: context.weekSummary || 'The calendar archive is still being indexed.' },
      { label: 'THE BACKSTORY', detail: context.backstory || 'The archive is still looking for its oddest footnote.' },
      { label: 'THE HMM FACT', detail: context.archiveFact || context.backstory || archiveDetail(issueData) },
    ],
  };
}

export function buildVictoryBellBulletinIssueData(issueData, { issueDate, odds = null } = {}) {
  const opponent = issueData.next_opponent || 'the next opponent';
  const context = issueData.bulletin_context || {};
  const oddsDetail = context.odds?.summary || odds?.summary || 'Published lines are not available from the configured free odds feed.';
  const marketDetail = context.winProbability || odds?.winProbability || 'Market-implied win probability is not available from the configured feed.';
  const seriesHistory = issueData.watercooler_context?.opponentHistory || `Duke meets ${opponent} next.`;
  const matchupDetail = `${context.recordSummary || 'Current records are unavailable.'} ${issueData.next_details || `Duke meets ${opponent}.`}`;
  return {
    ...issueData,
    publication_key: 'victory-bell-bulletin',
    edition: 'bulletin',
    issue_date_key: issueDate || issueData.issue_date_key,
    issue_date: formatEditionDate(issueDate || issueData.issue_date_key),
    game_id: issueData.next_game_id,
    publication_anchor_game_id: issueData.next_game_id,
    subject: `The Victory Bell Bulletin: Duke vs ${opponent}`,
    preview_text: `The matchup, series history, season numbers, and market view for Duke's game against ${opponent}.`,
    edition_name: 'THE VICTORY BELL BULLETIN',
    headline: `DUKE VS ${opponent.toUpperCase()}`,
    subheadline: 'The weekend primer: series history, season-long strengths, the line, and the market view.',
    brief_lead: '',
    brief_sections: [
      { label: 'THE MATCHUP', detail: matchupDetail },
      { label: 'SERIES HISTORY', detail: seriesHistory },
      { label: 'THE LINE', detail: oddsDetail, rows: context.lineRows },
      { label: 'OFFENSE', detail: context.seasonSummary || 'Season-to-date offensive numbers are not available from the configured statistics feed.', rows: context.offenseRows },
      { label: 'DEFENSE', detail: 'The defensive side of the season-to-date comparison.', rows: context.defenseRows },
      { label: 'STRENGTHS & PRESSURE POINTS', detail: context.strengths || 'The matchup strengths are still being assembled from the season feed.', rows: context.strengthRows },
      { label: 'DUKE KEY PLAYERS', detail: 'Season leaders from Duke.', rows: context.dukePlayerRows },
      { label: `${opponent.toUpperCase()} KEY PLAYERS`, detail: `Season leaders from ${opponent}.`, rows: context.opponentPlayerRows },
      { label: 'MARKET VIEW', detail: marketDetail, rows: context.marketRows },
    ],
    odds,
  };
}
