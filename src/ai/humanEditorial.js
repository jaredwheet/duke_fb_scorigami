function isWin(issueData) {
  const dukeScore = issueData.quarters?.[0]?.final;
  const opponentScore = issueData.quarters?.[1]?.final;
  return dukeScore != null && opponentScore != null && dukeScore > opponentScore;
}

export function buildHumanRecap(issueData = {}) {
  const opponent = issueData.current_opponent || 'the opponent';
  const comeback = issueData.guide_context?.comeback;
  const turningPoint = issueData.turning_point;
  const dukeScore = issueData.quarters?.[0]?.final;
  const opponentScore = issueData.quarters?.[1]?.final;
  const won = isWin(issueData);
  const outcomeKnown = dukeScore != null && opponentScore != null;

  const headline = !outcomeKnown
    ? issueData.headline || 'DUKE FOOTBALL'
    : won
      ? comeback?.comeback
        ? 'DUKE STOLE THE ENDING'
        : 'DUKE TAKES THE LAST WORD'
      : `DUKE LEAVES ${opponent.toUpperCase()} WITH THE LAST WORD`;

  const opening = comeback?.comeback
    ? `Duke let ${opponent} build a ${comeback.largestDeficit}-point lead, then took the game back.`
    : won
      ? `Duke made ${opponent} work for every minute of this one.`
      : `Duke kept ${opponent} within reach, but could not finish the job.`;
  const moment = issueData.editorial_flourish || turningPoint?.description || '';
  const narrative = [opening, moment, issueData.narrative].filter(Boolean).join(' ');

  return {
    headline,
    subheadline: issueData.subheadline || '',
    narrative: narrative.slice(0, 500),
    factsUsed: ['game.score', 'game.numbers', 'game.leaders', 'moment'],
    warnings: ['human voice fallback'],
  };
}
