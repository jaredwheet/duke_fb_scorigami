function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statMap(rows = []) {
  return Object.fromEntries(rows.map((row) => [String(row.statName || row.category || '').toLowerCase(), number(row.statValue ?? row.stat)]));
}

function findStat(stats, names) {
  for (const name of names) {
    const value = stats[name.toLowerCase()];
    if (value != null) return value;
  }
  return null;
}

function teamEntry(game, teamName) {
  return game.teams?.find((team) => normalize(team.school) === normalize(teamName)
    || normalize(team.school).includes(normalize(teamName))
    || normalize(teamName).includes(normalize(team.school)));
}

function teamGameRows(games = [], teamName) {
  return games.flatMap((game) => {
    const team = teamEntry(game, teamName);
    if (!team) return [];
    const opponent = (game.teams || []).find((candidate) => candidate !== team);
    return [{
      team: statMap(team.stats),
      opponent: statMap(opponent?.stats),
      points: number(team.points),
      opponentPoints: number(opponent?.points),
    }];
  });
}

function average(values) {
  const usable = values.filter((value) => value != null);
  return usable.length > 0 ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function oneDecimal(value) {
  return value == null ? null : value.toFixed(1).replace(/\.0$/, '');
}

function teamSummary(teamName, seasonStats, gameStats) {
  const rows = teamGameRows(gameStats, teamName);
  const stats = statMap(seasonStats);
  const games = rows.length || findStat(stats, ['games', 'gamesPlayed']) || 0;
  const seasonPoints = findStat(stats, ['pointsPerGame', 'points']);
  const seasonTotalYards = findStat(stats, ['totalyards', 'totaloffense']);
  const seasonRushingYards = findStat(stats, ['rushingyards', 'rushing']);
  const seasonPassingYards = findStat(stats, ['passingyards', 'passing']);
  const seasonFirstDowns = findStat(stats, ['firstdowns', 'firstdowns']);
  const pointsFor = average(rows.map((row) => row.points))
    ?? (seasonPoints == null ? null : seasonPoints / Math.max(games, 1));
  const pointsAgainst = average(rows.map((row) => row.opponentPoints));
  const totalYards = average(rows.map((row) => findStat(row.team, ['totalyards', 'totaloffense'])))
    ?? (seasonTotalYards == null ? null : seasonTotalYards / Math.max(games, 1));
  const rushingYards = average(rows.map((row) => findStat(row.team, ['rushingyards', 'rushing'])))
    ?? (seasonRushingYards == null ? null : seasonRushingYards / Math.max(games, 1));
  const passingYards = average(rows.map((row) => findStat(row.team, ['passingyards', 'passing'])))
    ?? (seasonPassingYards == null ? null : seasonPassingYards / Math.max(games, 1));
  const firstDowns = average(rows.map((row) => findStat(row.team, ['firstdowns'])))
    ?? (seasonFirstDowns == null ? null : seasonFirstDowns / Math.max(games, 1));
  const yardsAllowed = average(rows.map((row) => findStat(row.opponent, ['totalyards', 'totaloffense'])));
  const wins = rows.filter((row) => row.points != null && row.opponentPoints != null && row.points > row.opponentPoints).length;
  const losses = rows.filter((row) => row.points != null && row.opponentPoints != null && row.points < row.opponentPoints).length;
  const ties = rows.filter((row) => row.points != null && row.opponentPoints != null && row.points === row.opponentPoints).length;

  return {
    teamName,
    games,
    pointsFor,
    pointsAgainst,
    totalYards,
    rushingYards,
    passingYards,
    firstDowns,
    yardsAllowed,
    record: rows.length > 0 ? `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}` : null,
  };
}

function formatTeamSummary(summary) {
  const parts = [];
  if (summary.pointsFor != null) parts.push(`${oneDecimal(summary.pointsFor)} points/game`);
  if (summary.totalYards != null) parts.push(`${oneDecimal(summary.totalYards)} total yards/game`);
  if (summary.rushingYards != null) parts.push(`${oneDecimal(summary.rushingYards)} rushing yards/game`);
  if (summary.passingYards != null) parts.push(`${oneDecimal(summary.passingYards)} passing yards/game`);
  return parts.length > 0 ? `${summary.teamName}: ${parts.join('; ')}.` : `${summary.teamName}: season totals are not available yet.`;
}

export function findCfbDataOdds(lines = [], { dukeName = 'Duke', opponentName } = {}) {
  const game = lines.find((candidate) => {
    const teams = [candidate.homeTeam, candidate.awayTeam].map(normalize);
    const has = (name) => teams.some((team) => team === normalize(name) || team.includes(normalize(name)) || normalize(name).includes(team));
    return has(dukeName) && has(opponentName);
  });
  const line = game?.lines?.[0];
  if (!game || !line) return null;
  const dukeIsHome = normalize(game.homeTeam).includes(normalize(dukeName)) || normalize(dukeName).includes(normalize(game.homeTeam));
  const dukeMoneyline = dukeIsHome ? line.homeMoneyline : line.awayMoneyline;
  const opponentMoneyline = dukeIsHome ? line.awayMoneyline : line.homeMoneyline;
  const details = [];
  if (line.formattedSpread) details.push(`spread ${line.formattedSpread}`);
  else if (line.spread != null) details.push(`spread ${line.spread}`);
  if (dukeMoneyline != null) details.push(`Duke moneyline ${dukeMoneyline > 0 ? '+' : ''}${dukeMoneyline}`);
  if (line.overUnder != null) details.push(`total ${line.overUnder}`);
  if (details.length === 0) return null;

  const dukeImplied = dukeMoneyline < 0 ? (-dukeMoneyline) / ((-dukeMoneyline) + 100) : 100 / (dukeMoneyline + 100);
  const opponentImplied = opponentMoneyline < 0 ? (-opponentMoneyline) / ((-opponentMoneyline) + 100) : 100 / (opponentMoneyline + 100);
  const noVigProbability = Number.isFinite(dukeImplied) && Number.isFinite(opponentImplied)
    ? Math.round((dukeImplied / (dukeImplied + opponentImplied)) * 100)
    : null;
  return {
    provider: line.provider || 'CollegeFootballData',
    summary: `${details.join('; ')} via ${line.provider || 'CollegeFootballData'}.`,
    lineRows: [
      line.formattedSpread || line.spread != null ? { label: 'SPREAD', value: line.formattedSpread || String(line.spread) } : null,
      dukeMoneyline != null ? { label: 'DUKE MONEYLINE', value: `${dukeMoneyline > 0 ? '+' : ''}${dukeMoneyline}` } : null,
      opponentMoneyline != null ? { label: 'OPPONENT MONEYLINE', value: `${opponentMoneyline > 0 ? '+' : ''}${opponentMoneyline}` } : null,
      line.overUnder != null ? { label: 'TOTAL', value: String(line.overUnder) } : null,
    ].filter(Boolean),
    winProbability: noVigProbability == null
      ? null
      : `Market-implied Duke win chance: ${noVigProbability}% (no-vig moneyline estimate).`,
  };
}

export function buildBulletinContext({
  dukeName = 'Duke',
  opponentName,
  dukeSeasonStats = [],
  opponentSeasonStats = [],
  dukeGameStats = [],
  opponentGameStats = [],
  lines = [],
  pregameProbabilities = [],
} = {}) {
  const duke = teamSummary(dukeName, dukeSeasonStats, dukeGameStats);
  const opponent = teamSummary(opponentName, opponentSeasonStats, opponentGameStats);
  const odds = findCfbDataOdds(lines, { dukeName, opponentName });
  const probability = pregameProbabilities.find((game) => {
    const teams = [game.homeTeam, game.awayTeam].map(normalize);
    return teams.some((team) => team.includes(normalize(dukeName)))
      && teams.some((team) => team.includes(normalize(opponentName)));
  });
  const probabilityText = probability?.homeWinProb == null
    ? odds?.winProbability || 'Pregame win probability is not available from the configured feed.'
      : `${normalize(probability.homeTeam).includes(normalize(dukeName)) ? dukeName : opponentName} pregame win probability: ${Math.round((normalize(probability.homeTeam).includes(normalize(dukeName)) ? probability.homeWinProb : 1 - probability.homeWinProb) * 100)}%.`;
  const probabilityValue = probability?.homeWinProb == null
    ? null
    : Math.round((normalize(probability.homeTeam).includes(normalize(dukeName)) ? probability.homeWinProb : 1 - probability.homeWinProb) * 100);
  const strengths = [];
  if (duke.rushingYards != null) strengths.push(`${dukeName} is averaging ${oneDecimal(duke.rushingYards)} rushing yards per game`);
  if (opponent.yardsAllowed != null) strengths.push(`${opponentName} is allowing ${oneDecimal(opponent.yardsAllowed)} total yards per game`);
  if (duke.passingYards != null) strengths.push(`${dukeName} is averaging ${oneDecimal(duke.passingYards)} passing yards per game`);
  if (opponent.rushingYards != null) strengths.push(`${opponentName} is averaging ${oneDecimal(opponent.rushingYards)} rushing yards per game`);

  const seasonRows = [
    { label: 'POINTS / GAME', duke: oneDecimal(duke.pointsFor), opponent: oneDecimal(opponent.pointsFor) },
    { label: 'RUSH YARDS / GAME', duke: oneDecimal(duke.rushingYards), opponent: oneDecimal(opponent.rushingYards) },
    { label: 'PASS YARDS / GAME', duke: oneDecimal(duke.passingYards), opponent: oneDecimal(opponent.passingYards) },
    { label: 'TOTAL YARDS / GAME', duke: oneDecimal(duke.totalYards), opponent: oneDecimal(opponent.totalYards) },
    { label: 'YARDS ALLOWED / GAME', duke: oneDecimal(duke.yardsAllowed), opponent: oneDecimal(opponent.yardsAllowed) },
  ].filter((row) => row.duke != null || row.opponent != null);
  const strengthRows = [
    duke.rushingYards != null ? { label: dukeName.toUpperCase(), value: `Averaging ${oneDecimal(duke.rushingYards)} rushing yards per game.` } : null,
    opponent.yardsAllowed != null ? { label: opponentName.toUpperCase(), value: `Allowing ${oneDecimal(opponent.yardsAllowed)} total yards per game.` } : null,
    duke.passingYards != null ? { label: `${dukeName.toUpperCase()} AIR`, value: `Averaging ${oneDecimal(duke.passingYards)} passing yards per game.` } : null,
  ].filter(Boolean);
  const lineRows = odds?.lineRows || [];
  const marketRows = [
    probabilityValue == null ? null : { label: 'CFBD PREGAME MODEL', value: `${probabilityValue}% Duke win probability` },
    odds?.winProbability ? { label: 'NO-VIG MONEYLINE', value: odds.winProbability.replace('Market-implied Duke win chance: ', '').replace(' (no-vig moneyline estimate).', '') } : null,
  ].filter(Boolean);
  const matchupRows = [
    { label: 'POINTS / GAME', duke: oneDecimal(duke.pointsFor), opponent: oneDecimal(opponent.pointsFor) },
    { label: 'RUSH YARDS / GAME', duke: oneDecimal(duke.rushingYards), opponent: oneDecimal(opponent.rushingYards) },
    { label: 'PASS YARDS / GAME', duke: oneDecimal(duke.passingYards), opponent: oneDecimal(opponent.passingYards) },
    { label: 'TOTAL YARDS / GAME', duke: oneDecimal(duke.totalYards), opponent: oneDecimal(opponent.totalYards) },
    { label: 'YARDS ALLOWED / GAME', duke: oneDecimal(duke.yardsAllowed), opponent: oneDecimal(opponent.yardsAllowed) },
  ].filter((row) => row.duke != null || row.opponent != null);

  return {
    duke,
    opponent,
    recordSummary: `${duke.record ? `${dukeName} ${duke.record}` : `${dukeName} record unavailable`}; ${opponent.record ? `${opponentName} ${opponent.record}` : `${opponentName} record unavailable`}.`,
    seasonSummary: `${formatTeamSummary(duke)} ${formatTeamSummary(opponent)}`,
    seasonRows,
    strengthRows,
    lineRows,
    marketRows,
    matchupRows,
    strengths: strengths.length > 0 ? `${strengths.join('; ')}.` : 'Season-to-date matchup strengths are not available from the configured statistics feed.',
    odds,
    winProbability: probabilityText,
  };
}
