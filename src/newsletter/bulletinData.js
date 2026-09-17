function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function number(value) {
  if (value == null || value === '') return null;
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
    if (team.points == null && opponent?.points == null && !(team.stats?.length || opponent?.stats?.length)) return [];
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

function whole(value) {
  return value == null ? null : Math.round(value);
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

function leaderRows(stats = [], teamName, gamesPlayed = 1) {
  const players = new Map();
  const target = normalize(teamName);
  for (const row of stats) {
    const rowTeam = normalize(row.team);
    if (!row.player || rowTeam !== target || row.stat == null || /punt|kick|field goal|long snap/i.test(row.category || '')) continue;
    const value = number(row.stat);
    if (value == null) continue;
    const player = players.get(row.playerId) || {
      player: row.player,
      games: gamesPlayed,
      passingYards: 0,
      passingTouchdowns: 0,
      rushingYards: 0,
      rushingTouchdowns: 0,
      receivingYards: 0,
      receivingTouchdowns: 0,
      tackles: 0,
      interceptions: 0,
    };
    const statType = String(row.statType || '').toLowerCase();
    const yards = /yd|yards/.test(statType);
    const touchdowns = /td|touchdown/.test(statType);
    const category = String(row.category || '').toLowerCase();
    if (category.includes('pass') && yards) player.passingYards += value;
    if (category.includes('pass') && touchdowns) player.passingTouchdowns += value;
    if (category.includes('rush') && yards) player.rushingYards += value;
    if (category.includes('rush') && touchdowns) player.rushingTouchdowns += value;
    if (category.includes('receiv') && yards) player.receivingYards += value;
    if (category.includes('receiv') && touchdowns) player.receivingTouchdowns += value;
    if (/tackle|tkl/.test(statType)) player.tackles += value;
    if (/int|interception/.test(statType)) player.interceptions += value;
    players.set(row.playerId, player);
  }
  const leaders = [
    {
      label: 'TOP RUSHER',
      field: 'rushingYards',
      touchdownField: 'rushingTouchdowns',
      metric: 'YDS/G',
    },
    {
      label: 'TOP PASSER',
      field: 'passingYards',
      touchdownField: 'passingTouchdowns',
      metric: 'YDS/G',
    },
    {
      label: 'TOP RECEIVER',
      field: 'receivingYards',
      touchdownField: 'receivingTouchdowns',
      metric: 'YDS/G',
    },
    { label: 'TOP TACKLER', field: 'tackles', metric: 'TKL/G' },
    { label: 'TOP INTERCEPTOR', field: 'interceptions', metric: 'INT' },
  ];
  return leaders.flatMap((leader) => {
    const player = [...players.values()].sort((left, right) => right[leader.field] - left[leader.field])[0];
    if (!player || player[leader.field] <= 0) return [];
    const playerGames = Math.max(player.games, 1);
    const value = leader.metric === 'INT'
      ? `${player.player} | ${oneDecimal(player[leader.field])} INT`
      : `${player.player} | ${Math.round(player[leader.field] / playerGames)} ${leader.metric}${leader.touchdownField && player[leader.touchdownField] > 0 ? `, ${oneDecimal(player[leader.touchdownField])} TD` : ''}`;
    return [{ label: leader.label, value }];
  });
}

function formatTeamSummary(summary) {
  const parts = [];
  if (summary.pointsFor != null) parts.push(`${oneDecimal(summary.pointsFor)} points/game`);
  if (summary.totalYards != null) parts.push(`${whole(summary.totalYards)} total yards/game`);
  if (summary.rushingYards != null) parts.push(`${whole(summary.rushingYards)} rushing yards/game`);
  if (summary.passingYards != null) parts.push(`${whole(summary.passingYards)} passing yards/game`);
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
  dukePlayerStats = [],
  opponentPlayerStats = [],
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
  if (duke.rushingYards != null) strengths.push(`${dukeName} is averaging ${whole(duke.rushingYards)} rushing yards per game`);
  if (opponent.yardsAllowed != null) strengths.push(`${opponentName} is allowing ${whole(opponent.yardsAllowed)} total yards per game`);
  if (duke.passingYards != null) strengths.push(`${dukeName} is averaging ${whole(duke.passingYards)} passing yards per game`);
  if (opponent.rushingYards != null) strengths.push(`${opponentName} is averaging ${whole(opponent.rushingYards)} rushing yards per game`);

  const offenseRows = [
    { label: 'POINTS / GAME', duke: oneDecimal(duke.pointsFor), opponent: oneDecimal(opponent.pointsFor) },
    { label: 'RUSH YARDS / GAME', duke: whole(duke.rushingYards), opponent: whole(opponent.rushingYards) },
    { label: 'PASS YARDS / GAME', duke: whole(duke.passingYards), opponent: whole(opponent.passingYards) },
    { label: 'TOTAL YARDS / GAME', duke: whole(duke.totalYards), opponent: whole(opponent.totalYards) },
  ].filter((row) => row.duke != null || row.opponent != null);
  const defenseRows = [
    { label: 'POINTS ALLOWED / GAME', duke: oneDecimal(duke.pointsAgainst), opponent: oneDecimal(opponent.pointsAgainst) },
    { label: 'RUSH YARDS ALLOWED / GAME', duke: whole(duke.rushYardsAllowed), opponent: whole(opponent.rushYardsAllowed) },
    { label: 'PASS YARDS ALLOWED / GAME', duke: whole(duke.passYardsAllowed), opponent: whole(opponent.passYardsAllowed) },
    { label: 'TOTAL YARDS ALLOWED / GAME', duke: whole(duke.yardsAllowed), opponent: whole(opponent.yardsAllowed) },
    { label: 'TURNOVER MARGIN / GAME', duke: oneDecimal(duke.turnoverMargin), opponent: oneDecimal(opponent.turnoverMargin) },
  ].filter((row) => row.duke != null || row.opponent != null);
  const seasonRows = [...offenseRows, ...defenseRows];
  const strengthRows = [
    duke.rushingYards != null ? { label: dukeName.toUpperCase(), value: `Averaging ${whole(duke.rushingYards)} rushing yards per game.` } : null,
    opponent.yardsAllowed != null ? { label: opponentName.toUpperCase(), value: `Allowing ${whole(opponent.yardsAllowed)} total yards per game.` } : null,
    duke.passingYards != null ? { label: `${dukeName.toUpperCase()} AIR`, value: `Averaging ${whole(duke.passingYards)} passing yards per game.` } : null,
  ].filter(Boolean);
  const lineRows = odds?.lineRows || [];
  const marketRows = [
    probabilityValue == null ? null : { label: 'CFBD PREGAME MODEL', value: `${probabilityValue}% Duke win probability` },
    odds?.winProbability ? { label: 'NO-VIG MONEYLINE', value: odds.winProbability.replace('Market-implied Duke win chance: ', '').replace(' (no-vig moneyline estimate).', '') } : null,
  ].filter(Boolean);
  const matchupRows = [
    { label: 'POINTS / GAME', duke: oneDecimal(duke.pointsFor), opponent: oneDecimal(opponent.pointsFor) },
    { label: 'RUSH YARDS / GAME', duke: whole(duke.rushingYards), opponent: whole(opponent.rushingYards) },
    { label: 'PASS YARDS / GAME', duke: whole(duke.passingYards), opponent: whole(opponent.passingYards) },
    { label: 'TOTAL YARDS / GAME', duke: whole(duke.totalYards), opponent: whole(opponent.totalYards) },
    { label: 'YARDS ALLOWED / GAME', duke: whole(duke.yardsAllowed), opponent: whole(opponent.yardsAllowed) },
  ].filter((row) => row.duke != null || row.opponent != null);

  return {
    duke,
    opponent,
    recordSummary: `${duke.record ? `${dukeName} ${duke.record}` : `${dukeName} record unavailable`}; ${opponent.record ? `${opponentName} ${opponent.record}` : `${opponentName} record unavailable`}.`,
    seasonSummary: `${formatTeamSummary(duke)} ${formatTeamSummary(opponent)}`,
    seasonRows,
    offenseRows,
    defenseRows,
    dukePlayerRows: leaderRows(dukePlayerStats, dukeName, dukeResults.length || 1),
    opponentPlayerRows: leaderRows(opponentPlayerStats, opponentName, opponentResults.length || 1),
    strengthRows,
    lineRows,
    marketRows,
    matchupRows,
    strengths: strengths.length > 0 ? `${strengths.join('; ')}.` : 'Season-to-date matchup strengths are not available from the configured statistics feed.',
    odds,
    winProbability: probabilityText,
  };
}
