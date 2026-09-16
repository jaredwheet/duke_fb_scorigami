export const ISSUE_PACKET_VERSION = 'v1';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

export function buildIssuePacket(issueData = {}) {
  const scoreParts = String(issueData.current_score || '').split('-').map(Number);
  const currentDukeScore = Number.isFinite(scoreParts[0]) ? scoreParts[0] : null;
  const currentOpponentScore = Number.isFinite(scoreParts[1]) ? scoreParts[1] : null;
  const packet = {
    version: ISSUE_PACKET_VERSION,
    issue: {
      headline: issueData.headline || '',
      subheadline: issueData.subheadline || '',
      narrative: issueData.narrative || '',
      currentScore: issueData.current_score || '',
      currentOpponent: issueData.current_opponent || '',
      scorigamiStatus: issueData.scorigami_status || '',
      scorigamiContext: issueData.scorigami_context || '',
      guideContext: clone(issueData.guide_context),
      accContext: clone(issueData.acc_context),
    },
    facts: {
      score: {
        duke: issueData.quarters?.[0]?.final ?? currentDukeScore,
        opponent: issueData.quarters?.[1]?.final ?? currentOpponentScore,
        opponentName: issueData.current_opponent || null,
      },
      quarters: clone(issueData.quarters || []),
      scoringPlays: clone(issueData.scoring_plays || []),
      numbers: clone(issueData.numbers || []),
      leaders: clone(issueData.leaders || {}),
      scorigami: {
        status: issueData.scorigami_status || '',
        context: issueData.scorigami_context || '',
      },
      guide: clone(issueData.guide_context || {}),
      acc: clone(issueData.acc_context || {}),
    },
    allowedFactRefs: [
      'game.score',
      'game.opponent',
      'game.location',
      'game.quarters',
      'game.scoring_plays',
      'game.numbers',
      'game.leaders',
      'scorigami',
      'history',
      'acc',
    ],
  };
  return freeze(packet);
}
