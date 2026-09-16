function isDuke(team) {
  return team?.slug === 'duke' || team?.name?.toLowerCase() === 'duke';
}

export function canonicalScorePair(scoreA, scoreB) {
  if (scoreA == null || scoreB == null) return null;
  return [Number(scoreA), Number(scoreB)].sort((a, b) => a - b).join('-');
}

function getDukeParticipants(game) {
  const participants = game.participants || [];
  const duke = participants.find((participant) => isDuke(participant.team));
  const opponent = participants.find((participant) => !isDuke(participant.team));
  if (!duke || !opponent || duke.score == null || opponent.score == null) return null;
  return { duke, opponent };
}

export function calculateDukeScoreFacts(games) {
  const completedGames = (games || [])
    .filter((game) => game.status === 'final')
    .map((game) => ({ ...game, scores: getDukeParticipants(game) }))
    .filter((game) => game.scores);

  return completedGames.map((game) => {
    const { duke, opponent } = game.scores;
    const scorePair = canonicalScorePair(duke.score, opponent.score);
    const gameTime = new Date(game.startAt).getTime();
    const previous = completedGames
      .filter((candidate) => {
        if (candidate.id === game.id || candidate.scores == null) return false;
        const candidateTime = new Date(candidate.startAt).getTime();
        return canonicalScorePair(candidate.scores.duke.score, candidate.scores.opponent.score) === scorePair &&
          (Number.isNaN(gameTime) || Number.isNaN(candidateTime) || candidateTime < gameTime);
      })
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt))[0] || null;

    return {
      gameId: game.id,
      canonicalKey: game.canonicalKey,
      facts: {
        scorigami: {
          isNew: previous == null,
          scorePair,
          dukeScore: duke.score,
          opponentScore: opponent.score,
          opponent: opponent.team.name,
          occurrenceCount: previous ? completedGames.filter((candidate) => (
            candidate.id !== game.id &&
            canonicalScorePair(candidate.scores.duke.score, candidate.scores.opponent.score) === scorePair &&
            (Number.isNaN(gameTime) || new Date(candidate.startAt).getTime() < gameTime)
          )).length : 0,
          previousOccurrence: previous
            ? {
              gameId: previous.id,
              startAt: previous.startAt,
              opponent: previous.scores.opponent.team.name,
              dukeScore: previous.scores.duke.score,
              opponentScore: previous.scores.opponent.score,
            }
            : null,
        },
        historic: { isRecord: false },
        narrative: {},
        statisticalHooks: [],
      },
    };
  });
}
