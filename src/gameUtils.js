export const DEFAULT_BACKFILL_DAYS = 30;

export function getWinsipediaSeasonUrl(season) {
  return `https://www.winsipedia.com/duke/schedule/${season}`;
}

export function getDukeScoreDetails(game) {
  const dukeIsHome = game.homeTeam === 'Duke';
  const dukeScore = dukeIsHome ? game.homePoints : game.awayPoints;
  const oppScore = dukeIsHome ? game.awayPoints : game.homePoints;
  const opponent = dukeIsHome ? game.awayTeam : game.homeTeam;

  return {
    dukeIsHome,
    dukeScore,
    oppScore,
    opponent,
    scoreKey: `${dukeScore}-${oppScore}`,
  };
}

export function getRecentCompletedDukeGames(
  games,
  now = new Date(),
  backfillDays = DEFAULT_BACKFILL_DAYS,
) {
  const requestedDays = Number(backfillDays);
  const days = Number.isFinite(requestedDays) && requestedDays >= 0
    ? requestedDays
    : DEFAULT_BACKFILL_DAYS;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return (games || [])
    .filter((game) => {
      const startDate = new Date(game.startDate);
      return game.completed &&
        !Number.isNaN(startDate.getTime()) &&
        startDate >= cutoff &&
        startDate <= now &&
        game.homePoints != null &&
        game.awayPoints != null;
    })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}
