import { buildHumanRecap } from './humanEditorial.js';

function extractPlayerFromPlay(playText) {
  return String(playText || '').match(/#\d+\s+[A-Za-z]\.([A-Za-z][A-Za-z'-]*)/)?.[1] || null;
}

export function buildDeterministicEditorialFallback(issueData = {}) {
  const opponent = issueData.current_opponent || 'the opponent';
  const dukeScore = issueData.quarters?.[0]?.final;
  const opponentScore = issueData.quarters?.[1]?.final;
  const turningPoint = issueData.turning_point;
  const fourthDown = issueData.numbers?.find((number) => number.label === 'FOURTH-DOWN CONVERSIONS');
  const comeback = issueData.guide_context?.comeback;

  let flourish = 'Duke made the scoreboard do the talking and added unnecessary drama.';
  if (turningPoint?.type === 'fake_punt') {
    const player = extractPlayerFromPlay(turningPoint.playText);
    flourish = player
      ? `${opponent} saw a punt team. Duke saw an opportunity. ${player} saw open grass.`
      : `${opponent} saw a punt team. Duke saw an opportunity.`;
  } else if (turningPoint?.type === 'explosive_play') {
    flourish = turningPoint.description || `Duke found ${turningPoint.yards} yards and made the afternoon considerably less relaxing.`;
  } else if (turningPoint?.description) {
    flourish = turningPoint.description;
  } else if (fourthDown) {
    flourish = `Duke went ${fourthDown.value} on fourth down because apparently three downs were not enough.`;
  } else if (comeback?.comeback) {
    flourish = `Duke trailed by ${comeback.largestDeficit} and turned the ending into a Duke production.`;
  }

  return {
    recap: {
      ...buildHumanRecap({
        ...issueData,
        subheadline: dukeScore != null && opponentScore != null
          ? `Duke ${dukeScore}-${opponentScore} vs ${opponent}.`
          : 'Duke football update.',
        turning_point: turningPoint,
        editorial_flourish: flourish,
      }),
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
