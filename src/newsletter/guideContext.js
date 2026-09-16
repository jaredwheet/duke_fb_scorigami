import { calculateComebackFact, calculateLateGameFact, calculateRecordWatch, normalizeOpponentSlug } from '../mediaGuide/guideFacts.js';

function isDuke(participant) {
  return participant?.team?.slug === 'duke' || participant?.team?.name?.toLowerCase() === 'duke';
}

function scoreDetails(participants = []) {
  const duke = participants.find(isDuke);
  const opponent = participants.find((participant) => !isDuke(participant));
  return {
    dukeScore: duke?.score ?? null,
    opponentScore: opponent?.score ?? null,
    opponent: opponent?.team?.name || 'Opponent',
    opponentSlug: opponent?.team?.slug || normalizeOpponentSlug(opponent?.team?.name),
  };
}

function recordLabel(wins, losses, ties) {
  if (ties > 0) return `${wins}-${losses}-${ties}`;
  return `${wins}-${losses}`;
}

function applyCurrentMeeting(series, { season, dukeScore, opponentScore }) {
  if (!series || season == null || season <= series.throughSeason || dukeScore == null || opponentScore == null) return series;
  const result = dukeScore > opponentScore ? 'win' : dukeScore < opponentScore ? 'loss' : 'tie';
  return {
    ...series,
    throughSeason: season,
    dukeWins: series.dukeWins + (result === 'win' ? 1 : 0),
    dukeLosses: series.dukeLosses + (result === 'loss' ? 1 : 0),
    ties: series.ties + (result === 'tie' ? 1 : 0),
  };
}

export function buildOpponentHistory({ guide, opponent, season, dukeScore = null, opponentScore = null }) {
  const opponentSlug = normalizeOpponentSlug(opponent);
  const series = guide.opponentSeries.find((entry) => entry.opponentSlug === opponentSlug);
  if (!series) return null;

  const display = applyCurrentMeeting(series, { season, dukeScore, opponentScore });
  const record = recordLabel(display.dukeWins, display.dukeLosses, display.ties);
  const lead = display.dukeWins === display.dukeLosses
    ? `The series is tied ${record}.`
    : display.dukeWins > display.dukeLosses
      ? `Duke leads the series ${record}.`
      : `Duke trails the series ${record}.`;

  return {
    opponent: series.opponent,
    record,
    throughSeason: display.throughSeason,
    guideThroughSeason: series.throughSeason,
    statement: `${lead} The guide tracks the series through ${series.throughSeason}${display.throughSeason > series.throughSeason ? `; this result brings it through ${display.throughSeason}` : ''}.`,
    citation: { edition: guide.edition, ...guide.citations[series.citationId] },
  };
}

export function selectHistoricalFact({ guide, opponent, comeback = null }) {
  const opponentSlug = normalizeOpponentSlug(opponent);
  const opponentFact = guide.historicalFacts.find((fact) => fact.opponentSlug === opponentSlug);
  if (opponentFact) {
    return {
      statement: opponentFact.statement,
      category: opponentFact.category,
      citation: { edition: guide.edition, ...guide.citations[opponentFact.citationId] },
    };
  }

  if (comeback?.historicalReference) {
    const fact = guide.historicalFacts.find((candidate) => candidate.id === comeback.historicalReference.id)
      || guide.historicalFacts.find((candidate) => candidate.opponentSlug === comeback.historicalReference.opponentSlug && candidate.category === 'comeback-history');
    if (fact) {
      return {
        statement: fact.statement,
        category: fact.category,
        citation: { edition: guide.edition, ...guide.citations[fact.citationId] },
      };
    }
  }

  return null;
}

export function buildGuideContext({ guide, game, participants, detailsPayload = {}, facts = {} }) {
  if (!guide || !game) return null;
  const scores = scoreDetails(participants);
  const comeback = calculateComebackFact({
    dukeName: participants.find(isDuke)?.team?.name || 'Duke',
    opponentName: scores.opponent,
    dukeScore: scores.dukeScore,
    opponentScore: scores.opponentScore,
    plays: detailsPayload.plays || [],
    guide,
  });
  const recordWatch = calculateRecordWatch({
    detailsPayload,
    dukeName: participants.find(isDuke)?.team?.name || 'Duke',
    opponentName: scores.opponent,
    season: game.season,
    guide,
  });
  const lateGame = calculateLateGameFact({
    dukeName: participants.find(isDuke)?.team?.name || 'Duke',
    opponentName: scores.opponent,
    dukeScore: scores.dukeScore,
    opponentScore: scores.opponentScore,
    plays: detailsPayload.plays || [],
  });

  return {
    recordWatch,
    opponentHistory: buildOpponentHistory({
      guide,
      opponent: scores.opponentSlug || scores.opponent,
      season: game.season,
      dukeScore: scores.dukeScore,
      opponentScore: scores.opponentScore,
    }),
    comeback,
    lateGame,
    historicalFact: selectHistoricalFact({ guide, opponent: scores.opponentSlug || scores.opponent, comeback }),
    scorigamiSource: facts.scorigami ? 'canonical_game_facts' : null,
  };
}

export function buildSeasonPreviewData({ guide, season = 2026 }) {
  const context = guide.seasonContext.find((entry) => entry.season === season);
  const review = guide.seasonReviews.find((entry) => entry.season === season - 1);
  if (!context) throw new Error(`No media-guide context exists for ${season}`);

  return {
    season,
    headline: `${season} DUKE FOOTBALL OUTLOOK`,
    subheadline: `Duke finished ${season - 1} at ${review?.record.wins}-${review?.record.losses} as ACC champions.`,
    previousSeason: review || null,
    context,
    schedule: context.schedule,
    featuredPlayers: context.featuredPlayers,
    positionalBreakdown: context.positionalBreakdown,
    portalAdditions: context.portalAdditions,
    historicalFacts: guide.historicalFacts.slice(0, 3).map((fact) => ({
      statement: fact.statement,
      citation: { edition: guide.edition, ...guide.citations[fact.citationId] },
    })),
    historicalPlayers: (guide.historicalPlayers || []).slice(0, 3),
    source: { edition: guide.edition, citation: { edition: guide.edition, ...guide.citations[context.citationId] } },
  };
}
