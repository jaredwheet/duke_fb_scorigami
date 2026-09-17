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

function teamSummary(teamName, seasonStats, gameStats, recordOverride = null, canonical = null) {
  const rows = teamGameRows(gameStats, teamName);
  const stats = statMap(seasonStats);
  const games = rows.length || findStat(stats, ['games', 'gamesPlayed']) || 0;
  const seasonPoints = findStat(stats, ['pointsPerGame', 'points']);
  const seasonTotalYards = findStat(stats, ['totalyards', 'totaloffense']);
  const seasonRushingYards = findStat(stats, ['rushingyards', 'rushing']);
  const seasonPassingYards = findStat(stats, ['passingyards', 'passing']);
  const seasonFirstDowns = findStat(stats, ['firstdowns', 'firstdowns']);
  const pointsFor = canonical?.pointsFor
    ?? average(rows.map((row) => row.points))
    ?? (seasonPoints == null ? null : seasonPoints / Math.max(games, 1));
  const pointsAgainst = canonical?.pointsAgainst ?? average(rows.map((row) => row.opponentPoints));
  const totalYards = average(rows.map((row) => findStat(row.team, ['totalyards', 'totaloffense'])))
    ?? (seasonTotalYards == null ? null : seasonTotalYards / Math.max(games, 1));
  const rushingYards = average(rows.map((row) => findStat(row.team, ['rushingyards', 'rushing'])))
    ?? (seasonRushingYards == null ? null : seasonRushingYards / Math.max(games, 1));
  const passingYards = average(rows.map((row) => findStat(row.team, ['passingyards', 'passing'])))
    ?? (seasonPassingYards == null ? null : seasonPassingYards / Math.max(games, 1));
  const firstDowns = average(rows.map((row) => findStat(row.team, ['firstdowns'])))
    ?? (seasonFirstDowns == null ? null : seasonFirstDowns / Math.max(games, 1));
  const yardsAllowed = average(rows.map((row) => findStat(row.opponent, ['totalyards', 'totaloffense'])));
  const rushYardsAllowed = average(rows.map((row) => findStat(row.opponent, ['rushingyards', 'rushing'])));
  const passYardsAllowed = average(rows.map((row) => findStat(row.opponent, ['passingyards', 'passing'])));
  const turnoverMargin = average(rows.map((row) => {
    const teamTurnovers = findStat(row.team, ['turnovers', 'turnover']);
    const opponentTurnovers = findStat(row.opponent, ['turnovers', 'turnover']);
    return teamTurnovers == null || opponentTurnovers == null ? null : opponentTurnovers - teamTurnovers;
  }));
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
    rushYardsAllowed,
    passYardsAllowed,
    turnoverMargin,
    record: canonical?.record || recordOverride || (rows.length > 0 ? `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}` : null),
  };
}

function recordFromApi(records, teamName) {
  const row = (records || []).find((record) => {
    const team = normalize(record.team);
    const target = normalize(teamName);
    return team === target || team.includes(target) || target.includes(team);
  });
  const total = row?.total;
  if (!total || total.wins == null || total.losses == null) return null;
  return `${total.wins}-${total.losses}${total.ties > 0 ? `-${total.ties}` : ''}`;
}

function completedGameResults(games = [], teamName) {
  return games.flatMap((game) => {
    const home = normalize(game.homeTeam);
    const away = normalize(game.awayTeam);
    const target = normalize(teamName);
    const isHome = home === target || home.includes(target) || target.includes(home);
    const isAway = away === target || away.includes(target) || target.includes(away);
    const teamScore = isHome ? number(game.homePoints) : isAway ? number(game.awayPoints) : null;
    const opponentScore = isHome ? number(game.awayPoints) : isAway ? number(game.homePoints) : null;
    if (teamScore == null || opponentScore == null) return [];
    return [{ teamScore, opponentScore }];
  });
}

function playerGameRows(games = [], teamName) {
  const target = normalize(teamName);
  return games.flatMap((game) => {
    const team = game.teams?.find((candidate) => {
      const school = normalize(candidate.school?.name || candidate.school);
      return school === target || school.includes(target) || target.includes(school);
    });
    if (!team) return [];
    return (team.categories || []).flatMap((category) => (category.types || []).flatMap((type) => (type.athletes || []).map((athlete) => ({
      gameId: game.id,
      player: athlete.name,
      playerId: athlete.id || athlete.name,
      category: String(category.name || '').toLowerCase(),
      statType: String(type.name || '').toLowerCase(),
      value: number(athlete.stat),
    }))));
  });
}

function keyPlayerRows(games = [], teamName) {
  const players = new Map();
  for (const row of playerGameRows(games, teamName)) {
    if (!row.player || row.value == null || /punt|kick|field goal|long snap/i.test(row.category)) continue;
    const player = players.get(row.playerId) || {
      player: row.player,
      games: new Set(),
      yards: 0,
      touchdowns: 0,
      tackles: 0,
      sacks: 0,
      role: row.category || 'football',
    };
    player.games.add(row.gameId);
    if (/yd|yards/.test(row.statType)) player.yards += row.value;
    if (/td|touchdown/.test(row.statType)) player.touchdowns += row.value;
    if (/tackle|tkl/.test(row.statType)) player.tackles += row.value;
    if (/sack/.test(row.statType)) player.sacks += row.value;
    players.set(row.playerId, player);
  }
  return [...players.values()]
    .map((player) => {
      const gamesPlayed = Math.max(player.games.size, 1);
      const parts = [];
      if (player.yards > 0) parts.push(`${oneDecimal(player.yards / gamesPlayed)} YDS/G`);
      if (player.touchdowns > 0) parts.push(`${oneDecimal(player.touchdowns)} TD`);
      if (player.tackles > 0) parts.push(`${oneDecimal(player.tackles / gamesPlayed)} TKL/G`);
      if (player.sacks > 0) parts.push(`${oneDecimal(player.sacks)} SACK`);
      return {
        label: player.player,
        value: `${player.role} | ${parts.join(', ') || 'season production pending'}`,
        score: player.yards + (player.touchdowns * 50) + (player.tackles * 2) + (player.sacks * 15),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ label, value }) => ({ label, value }));
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

  const dukeImplied = Number.isFinite(Number(dukeMoneyline))
    ? dukeMoneyline < 0 ? (-dukeMoneyline) / ((-dukeMoneyline) + 100) : 100 / (dukeMoneyline + 100)
    : null;
  const opponentImplied = Number.isFinite(Number(opponentMoneyline))
    ? opponentMoneyline < 0 ? (-opponentMoneyline) / ((-opponentMoneyline) + 100) : 100 / (opponentMoneyline + 100)
    : null;
  const noVigProbability = dukeImplied != null && opponentImplied != null
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
  dukeRecord = [],
  opponentRecord = [],
  dukePlayerGameStats = [],
  opponentPlayerGameStats = [],
  dukeGames = [],
  opponentGames = [],
  canonicalRecords = {},
  lines = [],
  pregameProbabilities = [],
} = {}) {
  const dukeResults = completedGameResults(dukeGames, dukeName);
  const opponentResults = completedGameResults(opponentGames, opponentName);
  const resultSummary = (results) => results.length === 0 ? null : {
    record: `${results.filter((result) => result.teamScore > result.opponentScore).length}-${results.filter((result) => result.teamScore < result.opponentScore).length}${results.filter((result) => result.teamScore === result.opponentScore).length > 0 ? `-${results.filter((result) => result.teamScore === result.opponentScore).length}` : ''}`,
    pointsFor: results.reduce((sum, result) => sum + result.teamScore, 0) / results.length,
    pointsAgainst: results.reduce((sum, result) => sum + result.opponentScore, 0) / results.length,
  };
  const duke = teamSummary(dukeName, dukeSeasonStats, dukeGameStats, recordFromApi(dukeRecord, dukeName), resultSummary(dukeResults) || canonicalRecords[normalize(dukeName)]);
  const opponent = teamSummary(opponentName, opponentSeasonStats, opponentGameStats, recordFromApi(opponentRecord, opponentName), resultSummary(opponentResults) || canonicalRecords[normalize(opponentName)]);
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

  const offenseRows = [
    { label: 'POINTS / GAME', duke: oneDecimal(duke.pointsFor), opponent: oneDecimal(opponent.pointsFor) },
    { label: 'RUSH YARDS / GAME', duke: oneDecimal(duke.rushingYards), opponent: oneDecimal(opponent.rushingYards) },
    { label: 'PASS YARDS / GAME', duke: oneDecimal(duke.passingYards), opponent: oneDecimal(opponent.passingYards) },
    { label: 'TOTAL YARDS / GAME', duke: oneDecimal(duke.totalYards), opponent: oneDecimal(opponent.totalYards) },
  ].filter((row) => row.duke != null || row.opponent != null);
  const defenseRows = [
    { label: 'POINTS ALLOWED / GAME', duke: oneDecimal(duke.pointsAgainst), opponent: oneDecimal(opponent.pointsAgainst) },
    { label: 'RUSH YARDS ALLOWED / GAME', duke: oneDecimal(duke.rushYardsAllowed), opponent: oneDecimal(opponent.rushYardsAllowed) },
    { label: 'PASS YARDS ALLOWED / GAME', duke: oneDecimal(duke.passYardsAllowed), opponent: oneDecimal(opponent.passYardsAllowed) },
    { label: 'TOTAL YARDS ALLOWED / GAME', duke: oneDecimal(duke.yardsAllowed), opponent: oneDecimal(opponent.yardsAllowed) },
    { label: 'TURNOVER MARGIN / GAME', duke: oneDecimal(duke.turnoverMargin), opponent: oneDecimal(opponent.turnoverMargin) },
  ].filter((row) => row.duke != null || row.opponent != null);
  const seasonRows = [...offenseRows, ...defenseRows];
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
    offenseRows,
    defenseRows,
    dukePlayerRows: keyPlayerRows(dukePlayerGameStats, dukeName),
    opponentPlayerRows: keyPlayerRows(opponentPlayerGameStats, opponentName),
    strengthRows,
    lineRows,
    marketRows,
    matchupRows,
    strengths: strengths.length > 0 ? `${strengths.join('; ')}.` : 'Season-to-date matchup strengths are not available from the configured statistics feed.',
    odds,
    winProbability: probabilityText,
  };
}
