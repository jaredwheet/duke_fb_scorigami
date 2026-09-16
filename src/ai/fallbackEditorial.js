function extractPlayerFromPlay(playText) {
  return String(playText || '').match(/#\d+\s+[A-Za-z]\.([A-Za-z][A-Za-z'-]*)/)?.[1] || null;
}

export function buildDeterministicEditorialFallback(issueData = {}) {
  const opponent = issueData.current_opponent || 'the opponent';
  const dukeScore = issueData.quarters?.[0]?.final;
  const opponentScore = issueData.quarters?.[1]?.final;
  const won = dukeScore != null && opponentScore != null && dukeScore > opponentScore;
  const turningPoint = issueData.turning_point;
  const fourthDown = issueData.numbers?.find((number) => number.label === 'FOURTH-DOWN CONVERSIONS');
  const comeback = issueData.guide_context?.comeback;

  let flourish = won
    ? `Duke made ${opponent} a problem.`
    : `The scoreboard was not in a forgiving mood.`;
  if (turningPoint?.type === 'fake_punt') {
    const player = extractPlayerFromPlay(turningPoint.playText);
    flourish = player
      ? `${opponent} saw a punt team. Duke saw an opportunity. ${player} saw open grass.`
      : `${opponent} saw a punt team. Duke saw an opportunity.`;
  } else if (turningPoint?.type === 'explosive_play') {
    flourish = `Duke found ${turningPoint.yards} yards when it needed them, and ${opponent} found out the afternoon was not over. It was worse than that.`;
  } else if (fourthDown) {
    flourish = `Duke went ${fourthDown.value} on fourth down because apparently three downs were not enough.`;
  } else if (comeback?.comeback) {
    flourish = `Duke trailed by ${comeback.largestDeficit} and responded by making the ending everybody else's problem.`;
  }

  return {
    recap: {
      headline: won ? `DUKE MAKES ${opponent.toUpperCase()} A PROBLEM` : issueData.headline || `DUKE FALLS TO ${opponent.toUpperCase()}`,
      subheadline: issueData.subheadline || '',
      narrative: [issueData.narrative, flourish].filter(Boolean).join(' '),
      factsUsed: ['game.score', 'game.numbers', 'game.leaders', 'moment'],
      warnings: ['deterministic editorial fallback'],
    },
    scorigami: {
      context: issueData.scorigami_context || '',
      factsUsed: ['scorigami'],
      warnings: [],
    },
    history: {
      context: issueData.guide_context?.opponentHistory?.statement || issueData.guide_context?.historicalFact?.statement || '',
      factsUsed: ['history'],
      warnings: [],
    },
    acc: { blurb: '', factsUsed: ['acc'], warnings: [] },
    moment: { blurb: flourish, factsUsed: ['moment'], warnings: [] },
  };
}
