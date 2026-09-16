function isDuke(team) {
  return team?.slug === 'duke' || team?.name?.toLowerCase() === 'duke';
}

function getScoreDetails(game, participants) {
  const duke = participants.find((participant) => isDuke(participant.team));
  const opponent = participants.find((participant) => !isDuke(participant.team));
  return {
    dukeScore: duke?.score ?? null,
    opponentScore: opponent?.score ?? null,
    opponent: opponent?.team?.name || 'Opponent',
  };
}

function getPlayScore(play, dukeName, opponentName) {
  const scores = {};
  if (play.offense && play.offenseScore != null) scores[play.offense] = Number(play.offenseScore);
  if (play.defense && play.defenseScore != null) scores[play.defense] = Number(play.defenseScore);
  if (scores[dukeName] == null || scores[opponentName] == null) return null;
  return { duke: scores[dukeName], opponent: scores[opponentName] };
}

function getQuarterRows(plays, dukeName, opponentName, dukeScore, opponentScore) {
  const sortedPlays = (plays || []).slice().sort((a, b) => (a.playNumber || 0) - (b.playNumber || 0));
  let previousDuke = 0;
  let previousOpponent = 0;
  const quarters = [1, 2, 3, 4].map((period) => {
    const periodPlays = sortedPlays.filter((play) => play.period === period);
    const snapshots = periodPlays
      .map((play) => getPlayScore(play, dukeName, opponentName))
      .filter(Boolean);
    const snapshot = snapshots.at(-1);
    if (!snapshot) return { duke: null, opponent: null };
    const result = {
      duke: snapshot.duke - previousDuke,
      opponent: snapshot.opponent - previousOpponent,
    };
    previousDuke = snapshot.duke;
    previousOpponent = snapshot.opponent;
    return result;
  });

  return [
    {
      team: 'Duke',
      q1: quarters[0].duke ?? '—',
      q2: quarters[1].duke ?? '—',
      q3: quarters[2].duke ?? '—',
      q4: quarters[3].duke ?? '—',
      final: dukeScore ?? '—',
    },
    {
      team: opponentName,
      q1: quarters[0].opponent ?? '—',
      q2: quarters[1].opponent ?? '—',
      q3: quarters[2].opponent ?? '—',
      q4: quarters[3].opponent ?? '—',
      final: opponentScore ?? '—',
    },
  ];
}

function getScoringRows(plays, dukeName) {
  return (plays || [])
    .filter((play) => play.scoring)
    .map((play) => ({
      team: play.offense === dukeName ? 'DUKE' : (play.offense || 'OPP').slice(0, 5).toUpperCase(),
      period: `Q${play.period || '?'} ${String(play.clock?.minutes ?? 0).padStart(2, '0')}:${String(play.clock?.seconds ?? 0).padStart(2, '0')}`,
      description: play.playText || play.playType || 'Scoring play',
    }));
}

function getTeamBoxes(detailsPayload) {
  return (detailsPayload?.teamStats || []).flatMap((game) => game.teams || []);
}

function getPlayerBoxes(detailsPayload) {
  return (detailsPayload?.playerStats || []).flatMap((game) => game.teams || []);
}

function getTeamStats(teamBox) {
  return Object.fromEntries((teamBox?.stats || []).map((stat) => [stat.category, stat.stat]));
}

function getPlayerMetrics(teamBox, categoryName) {
  const category = (teamBox?.categories || []).find((candidate) => candidate.name?.toLowerCase() === categoryName);
  const players = new Map();
  for (const type of category?.types || []) {
    for (const athlete of type.athletes || []) {
      const metrics = players.get(athlete.name) || {};
      metrics[type.name] = athlete.stat;
      players.set(athlete.name, metrics);
    }
  }
  return [...players.entries()].map(([name, metrics]) => ({ name, metrics }));
}

function numericStat(value) {
  const number = Number.parseFloat(String(value ?? '').replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}

function getTopPlayer(teamBox, categoryName, primaryStat) {
  return getPlayerMetrics(teamBox, categoryName)
    .filter(({ metrics }) => numericStat(metrics[primaryStat]) != null)
    .sort((a, b) => numericStat(b.metrics[primaryStat]) - numericStat(a.metrics[primaryStat]))[0] || null;
}

function leaderRow(teamBox, categoryName, primaryStat, fields) {
  const leader = getTopPlayer(teamBox, categoryName, primaryStat);
  if (!leader) return null;

  const line = fields
    .map(([key, label]) => leader.metrics[key] == null || leader.metrics[key] === '--'
      ? null
      : `${leader.metrics[key]}${label ? ` ${label}` : ''}`)
    .filter(Boolean)
    .join(', ');
  return { name: leader.name, line };
}

function getLeaders(detailsPayload, dukeName) {
  const dukePlayerBox = getPlayerBoxes(detailsPayload).find((team) => team.team === dukeName);
  return {
    passing: [leaderRow(dukePlayerBox, 'passing', 'YDS', [['C/ATT', ''], ['YDS', 'YDS'], ['TD', 'TD'], ['INT', 'INT']])].filter(Boolean),
    rushing: [leaderRow(dukePlayerBox, 'rushing', 'YDS', [['CAR', 'CAR'], ['YDS', 'YDS'], ['TD', 'TD']])].filter(Boolean),
    receiving: [leaderRow(dukePlayerBox, 'receiving', 'YDS', [['REC', 'REC'], ['YDS', 'YDS'], ['TD', 'TD']])].filter(Boolean),
    defense: [leaderRow(dukePlayerBox, 'defensive', 'TOT', [['TOT', 'TKL'], ['SACKS', 'SACKS'], ['TFL', 'TFL']])].filter(Boolean),
  };
}

function getSummaryStats(detailsPayload, dukeName) {
  const dukeTeam = getTeamBoxes(detailsPayload).find((team) => team.team === dukeName);
  const dukePlayerBox = getPlayerBoxes(detailsPayload).find((team) => team.team === dukeName);
  return {
    rushingYards: getTeamStats(dukeTeam).rushingYards,
    passer: getTopPlayer(dukePlayerBox, 'passing', 'YDS'),
    rusher: getTopPlayer(dukePlayerBox, 'rushing', 'YDS'),
  };
}

function getTurnoverNumber(detailsPayload, dukeName, opponent) {
  const teamBoxes = getTeamBoxes(detailsPayload);
  const dukeStats = getTeamStats(teamBoxes.find((team) => team.team === dukeName));
  const opponentStats = getTeamStats(teamBoxes.find((team) => team.team === opponent));
  const dukeTurnovers = numericStat(dukeStats.turnovers);
  const opponentTurnovers = numericStat(opponentStats.turnovers);
  if (dukeTurnovers == null || opponentTurnovers == null) return null;

  const margin = opponentTurnovers - dukeTurnovers;
  return {
    value: margin > 0 ? `+${margin}` : String(margin),
    detail: `Duke ${dukeTurnovers}, ${opponent} ${opponentTurnovers}.`,
    dukeTurnovers,
    opponentTurnovers,
  };
}

function buildLeadCopy({ dukeScore, opponentScore, opponent, dukeRole, turnoverNumber, summaryStats }) {
  const score = `${dukeScore}-${opponentScore}`;
  const won = dukeScore > opponentScore;
  const setting = dukeRole === 'away' ? 'road' : dukeRole === 'home' ? 'home' : 'neutral-site';
  const turnoverMargin = turnoverNumber
    ? turnoverNumber.opponentTurnovers - turnoverNumber.dukeTurnovers
    : null;
  const turnoverScore = turnoverNumber
    ? `${turnoverNumber.opponentTurnovers}-${turnoverNumber.dukeTurnovers}`
    : null;
  const teamRushingYards = numericStat(summaryStats?.rushingYards);
  const passingYards = summaryStats?.passer?.metrics?.YDS;
  const passingTouchdowns = numericStat(summaryStats?.passer?.metrics?.TD);
  const rushingYards = summaryStats?.rusher?.metrics?.YDS;
  const rushingTouchdowns = numericStat(summaryStats?.rusher?.metrics?.TD);
  const passingTouchdownLabel = passingTouchdowns === 1 ? 'a touchdown' : `${passingTouchdowns} touchdowns`;
  const rushingTouchdownLabel = rushingTouchdowns === 1 ? 'a touchdown' : `${rushingTouchdowns} touchdowns`;
  const rushingSentence = summaryStats?.rusher && rushingYards != null && rushingTouchdowns != null
    ? `${summaryStats.rusher.name} ran for ${rushingYards} yards and ${rushingTouchdownLabel}.`
    : null;

  const playerSentences = [
    summaryStats?.passer && passingYards != null && passingTouchdowns != null
      ? `${summaryStats.passer.name} threw for ${passingYards} yards and ${passingTouchdownLabel}.`
      : null,
    rushingSentence,
  ].filter(Boolean);
  const summarySentences = playerSentences.length > 0
    ? [`${setting === 'road' ? 'On the road, ' : ''}${playerSentences[0]}`, ...playerSentences.slice(1)]
    : [];
  if (summarySentences.length === 0) {
    if (turnoverMargin > 0) summarySentences.push(`Duke won the turnover battle ${turnoverScore}.`);
    if (teamRushingYards != null) summarySentences.push(`The Blue Devils ran for ${teamRushingYards} yards as a team.`);
  }

  return {
    headline: won ? `DUKE OUTLASTS ${opponent.toUpperCase()}` : `DUKE FALLS SHORT AGAINST ${opponent.toUpperCase()}`,
    subheadline: teamRushingYards != null
      ? `Duke ran for ${teamRushingYards} yards in a ${score} ${setting} ${won ? 'win' : 'loss'} over ${opponent}.`
      : `The Blue Devils ${won ? 'outlast' : 'fall to'} ${opponent}, ${score}.`,
    narrative: summarySentences.join(' '),
  };
}

export function buildSundayIssueData({
  game,
  participants,
  sourcePayload,
  detailsPayload,
  facts,
  directive,
  nextGame,
  nextParticipants = [],
}) {
  const scores = getScoreDetails(game, participants);
  const dukeName = participants.find((participant) => isDuke(participant.team))?.team?.name || 'Duke';
  const plays = detailsPayload?.plays || [];
  const quarterRows = getQuarterRows(
    plays,
    dukeName,
    scores.opponent,
    scores.dukeScore,
    scores.opponentScore,
  );
  const scoringRows = getScoringRows(plays, dukeName);
  const fourthQuarterPoints = quarterRows[0]?.q4;
  const scoreFacts = facts?.scorigami || {};
  const turnoverNumber = getTurnoverNumber(detailsPayload, dukeName, scores.opponent);
  const summaryStats = getSummaryStats(detailsPayload, dukeName);
  const nextDetails = nextGame
    ? `${new Date(nextGame.start_at).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${nextGame.venue_name || 'Venue TBD'} · TV: TBD`
    : 'Schedule details are not yet available.';
  const nextOpponent = nextParticipants.find((participant) => !isDuke(participant.team))?.team?.name || 'Next opponent TBD';

  return {
    subject: `Devil in the Details: Duke ${scores.dukeScore}-${scores.opponentScore}`,
    preview_text: `Duke ${scores.dukeScore}-${scores.opponentScore} vs ${scores.opponent}.`,
    issue_date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    issue_number: String(game.season),
    ...buildLeadCopy({
      ...scores,
      dukeRole: participants.find((participant) => isDuke(participant.team))?.role,
      turnoverNumber,
      summaryStats,
    }),
    quarters: quarterRows,
    scoring_plays: scoringRows,
    numbers: [
      { value: fourthQuarterPoints ?? '—', label: 'FOURTH-QUARTER POINTS', detail: 'Derived from verified play-by-play.' },
      { value: turnoverNumber?.value || '—', label: 'TURNOVER MARGIN', detail: turnoverNumber?.detail || 'Awaiting a verified team-stat feed.' },
      { value: plays.length || '—', label: 'RECORDED PLAYS', detail: 'CFBData play-by-play records.' },
    ],
    leaders: getLeaders(detailsPayload, dukeName),
    scorigami_status: scoreFacts.isNew ? 'NEW SCORE!' : 'FAMILIAR TERRITORY.',
    scorigami_context: scoreFacts.isNew
      ? `${scoreFacts.scorePair || `${scores.dukeScore}-${scores.opponentScore}`} had never occurred in Duke football history.`
      : `${scoreFacts.scorePair || `${scores.dukeScore}-${scores.opponentScore}`} has occurred ${scoreFacts.occurrenceCount ?? 0} previous time${scoreFacts.occurrenceCount === 1 ? '' : 's'} in Duke football history.`,
    acc_scores: [],
    next_opponent: nextOpponent,
    next_details: nextDetails,
    source_url: `https://www.winsipedia.com/duke/schedule/${game.season}`,
    footer_text: 'A quick read on the game, the numbers, and what comes next.',
    unsubscribe_url: 'https://example.com/unsubscribe',
    preferences_url: 'https://example.com/preferences',
    source_payload: sourcePayload,
  };
}
