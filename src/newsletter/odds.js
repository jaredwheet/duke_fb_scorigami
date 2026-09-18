function normalized(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findOutcome(market, predicate) {
  return (market?.outcomes || []).find(predicate) || null;
}

function formatAmerican(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number > 0 ? `+${number}` : String(number);
}

export function findUpcomingOdds(events = [], { dukeName = 'Duke', opponentName, startAt } = {}) {
  const duke = normalized(dukeName);
  const opponent = normalized(opponentName);
  const targetTime = startAt ? new Date(startAt).getTime() : null;
  const event = events
    .filter((candidate) => {
      const teams = [candidate.home_team, candidate.away_team].map(normalized);
      const includesTeam = (team) => teams.some((candidateTeam) => candidateTeam === team || candidateTeam.includes(team) || team.includes(candidateTeam));
      if (!includesTeam(duke) || (opponent && !includesTeam(opponent))) return false;
      if (targetTime == null || !candidate.commence_time) return true;
      return Math.abs(new Date(candidate.commence_time).getTime() - targetTime) < 36 * 60 * 60 * 1000;
    })
    .sort((left, right) => new Date(left.commence_time || 0) - new Date(right.commence_time || 0))[0];
  if (!event) return null;

  const bookmaker = event.bookmakers?.[0];
  const markets = Object.fromEntries((bookmaker?.markets || []).map((market) => [market.key, market]));
  const isDukeOutcome = (outcome) => {
    const name = normalized(outcome.name);
    return name === duke || name.includes(duke) || duke.includes(name);
  };
  const spread = findOutcome(markets.spreads, isDukeOutcome);
  const moneyline = findOutcome(markets.h2h, isDukeOutcome);
  const total = findOutcome(markets.totals, (outcome) => /over/i.test(outcome.name));
  const details = [];
  if (spread?.point != null) details.push(`Duke ${spread.point > 0 ? '+' : ''}${spread.point} (${formatAmerican(spread.price) || 'price unavailable'})`);
  if (moneyline?.price != null) details.push(`moneyline ${formatAmerican(moneyline.price)}`);
  if (total?.point != null) details.push(`total ${total.name} ${total.point} (${formatAmerican(total.price) || 'price unavailable'})`);
  if (details.length === 0) return null;

  return {
    bookmaker: bookmaker?.title || null,
    eventId: event.id || null,
    commenceTime: event.commence_time || null,
    spread: spread ? { point: spread.point, price: spread.price } : null,
    moneyline: moneyline ? { price: moneyline.price } : null,
    total: total ? { name: total.name, point: total.point, price: total.price } : null,
    summary: `${details.join('; ')}${bookmaker?.title ? ` via ${bookmaker.title}.` : '.'}`,
  };
}
