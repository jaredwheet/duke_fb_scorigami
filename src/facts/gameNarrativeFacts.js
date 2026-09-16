import { calculateComebackFact, calculateLateGameFact, calculateRecordWatch } from '../mediaGuide/guideFacts.js';

function isDuke(participant) {
  return participant?.team?.slug === 'duke' || participant?.team?.name?.toLowerCase() === 'duke';
}

export function calculateGameNarrativeFacts({ game, detailsPayload = {}, guide }) {
  const duke = game?.participants?.find(isDuke);
  const opponent = game?.participants?.find((participant) => !isDuke(participant));
  if (!duke || !opponent) {
    return {
      historic: { isRecord: false },
      narrative: {},
      statisticalHooks: [],
    };
  }

  const recordWatch = calculateRecordWatch({
    detailsPayload,
    dukeName: duke.team.name,
    opponentName: opponent.team.name,
    season: game.season,
    guide,
  });
  const comeback = calculateComebackFact({
    dukeName: duke.team.name,
    opponentName: opponent.team.name,
    dukeScore: duke.score,
    opponentScore: opponent.score,
    plays: detailsPayload.plays || [],
    guide,
  });
  const lateGame = calculateLateGameFact({
    dukeName: duke.team.name,
    opponentName: opponent.team.name,
    dukeScore: duke.score,
    opponentScore: opponent.score,
    plays: detailsPayload.plays || [],
  });

  return {
    historic: {
      isRecord: Boolean(recordWatch),
      recordWatch,
    },
    narrative: comeback
      ? {
        comeback: true,
        largestDeficit: comeback.largestDeficit,
        trailingAt: comeback.trailingAt,
        source: comeback.source,
        confidence: comeback.confidence,
        historicalReference: comeback.historicalReference,
        ...(lateGame || {}),
      }
      : lateGame || {},
    statisticalHooks: recordWatch
      ? [{
        key: `record_watch_${recordWatch.id}`,
        priority: recordWatch.status === 'record' || recordWatch.status === 'tied_record' ? 85 : 45,
        facts: recordWatch,
        issueTypes: ['sunday', 'watercooler'],
      }]
      : [],
  };
}
