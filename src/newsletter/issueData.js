import { calculateWinExpectancySnapshots, findLargestWinExpectancySwing } from './winExpectancy.js';

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
  const hasPlayData = sortedPlays.length > 0;
  let previousDuke = 0;
  let previousOpponent = 0;
  const quarters = [1, 2, 3, 4].map((period) => {
    const periodPlays = sortedPlays.filter((play) => play.period === period);
    const snapshots = periodPlays
      .map((play) => getPlayScore(play, dukeName, opponentName))
      .filter(Boolean);
    const snapshot = snapshots.at(-1);
    if (!snapshot) return hasPlayData ? { duke: 0, opponent: 0 } : { duke: null, opponent: null };
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

function formatPlayerName(value) {
  const name = String(value || '')
    .replace(/^#\d+\s+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\(.*$/, '')
    .trim();
  if (!name) return null;
  const initialsAndSurname = name.match(/^[A-Za-z]\.([A-Za-z][A-Za-z'-]*)$/);
  const normalizedName = initialsAndSurname?.[1] || name;
  if (normalizedName === normalizedName.toUpperCase() || normalizedName === normalizedName.toLowerCase()) {
    return normalizedName.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  }
  return normalizedName;
}

function playerField(play, fields) {
  for (const field of fields) {
    const value = play[field];
    const name = typeof value === 'object' ? value?.name : value;
    const formatted = formatPlayerName(name);
    if (formatted) return formatted;
  }
  return null;
}

function compactScoringDescription(play) {
  const text = play.playText || '';
  const fieldGoalYards = text.match(/field goal attempt from (\d+) yards/i)?.[1];
  const fieldGoalPlayerMatch = text.match(/(?:^|\s)(?:#\d+\s+)?([A-Za-z]\.[A-Za-z][A-Za-z'-]*|[A-Za-z][A-Za-z'-]*)\s+field goal attempt from\s+(\d+)\s+yards/i);
  const guideFieldGoal = text.match(/(?:^|\s)(?:#\d+\s+)?([A-Za-z]\.[A-Za-z][A-Za-z'-]*|[A-Za-z][A-Za-z'-]*)\s+(\d+)\s*Yd\s+Field Goal/i);
  const fieldGoalPlayer = formatPlayerName(fieldGoalPlayerMatch?.[1] || guideFieldGoal?.[1]) || playerField(play, ['kicker', 'kickerName', 'scorer', 'player', 'athlete']);
  if (fieldGoalYards || fieldGoalPlayerMatch || guideFieldGoal) {
    const yards = fieldGoalYards || fieldGoalPlayerMatch?.[2] || guideFieldGoal?.[2];
    return fieldGoalPlayer ? `${fieldGoalPlayer}, ${yards}-yard field goal` : `Field goal, ${yards} yards`;
  }

  const passTouchdown = text.match(/(?:^|\s)(?:#\d+\s+)?([A-Za-z]\.[A-Za-z][A-Za-z'-]*|[A-Za-z][A-Za-z'-]*)\s+pass(?:es|ed)?\s+[^,]*?\s+to\s+(?:#\d+\s+)?([A-Za-z]\.[A-Za-z][A-Za-z'-]*|[A-Za-z][A-Za-z'-]*).*?\bfor\s+(\d+)\s+yards?.*touchdown/i);
  const guidePassTouchdown = text.match(/(?:^|\s)(?:#\d+\s+)?([A-Za-z]\.[A-Za-z][A-Za-z'-]*|[A-Za-z][A-Za-z'-]*)\s+(\d+)\s*Yd\s+Pass from\s+([A-Za-z]\.[A-Za-z][A-Za-z'-]*|[A-Za-z][A-Za-z'-]*)/i);
  if (passTouchdown || guidePassTouchdown) {
    const receiver = formatPlayerName(passTouchdown?.[2] || guidePassTouchdown?.[1]);
    const passer = formatPlayerName(passTouchdown?.[1] || guidePassTouchdown?.[3]);
    const yards = passTouchdown?.[3] || guidePassTouchdown?.[2];
    if (passer && receiver) return `${passer} to ${receiver}, ${yards}-yard touchdown`;
  }

  const rushTouchdown = text.match(/(?:^|\s)(?:#\d+\s+)?([A-Za-z]\.[A-Za-z][A-Za-z'-]*|[A-Za-z][A-Za-z'-]*)\s+(\d+)\s*Yd\s+(?:Rush|Run)/i)
    || text.match(/(?:^|\s)(?:#\d+\s+)?([A-Za-z]\.[A-Za-z][A-Za-z'-]*)\s+(?:rush|runs?)(?:\s+[A-Za-z-]+)*\s+for\s+(\d+)\s+yards?.*touchdown/i);
  if (rushTouchdown) {
    const rusher = formatPlayerName(rushTouchdown[1]) || playerField(play, ['rusher', 'scorer', 'player', 'athlete']);
    const yards = rushTouchdown[2];
    if (rusher) return `${rusher}, ${yards}-yard touchdown run`;
  }

  const touchdownYards = text.match(/for (\d+) yards.*?touchdown/i)?.[1];
  if (touchdownYards) {
    const type = /\brush\b/i.test(text) ? 'run' : 'pass';
    return `${touchdownYards}-yard touchdown ${type}`;
  }

  return play.playType || 'Scoring play';
}

function getScoringRows(plays, dukeName) {
  return (plays || [])
    .filter((play) => play.scoring)
    .slice()
    .sort((a, b) => {
      const periodDifference = (a.period || 0) - (b.period || 0);
      if (periodDifference !== 0) return periodDifference;
      const aSeconds = (a.clock?.minutes || 0) * 60 + (a.clock?.seconds || 0);
      const bSeconds = (b.clock?.minutes || 0) * 60 + (b.clock?.seconds || 0);
      return bSeconds - aSeconds;
    })
    .map((play) => ({
      team: play.offense === dukeName ? 'DUKE' : (play.offense || 'OPP').slice(0, 3).toUpperCase(),
      quarter: play.period || null,
      period: `${String(play.clock?.minutes ?? 0).padStart(2, '0')}:${String(play.clock?.seconds ?? 0).padStart(2, '0')}`,
      description: compactScoringDescription(play),
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
    detail: `Turnovers: Duke ${dukeTurnovers}, ${opponent} ${opponentTurnovers}.`,
    dukeTurnovers,
    opponentTurnovers,
  };
}

function parseMadeAttempts(value) {
  const [made, attempts] = String(value ?? '').split('-').map(Number);
  if (!Number.isFinite(made) || !Number.isFinite(attempts)) return null;
  return { made, attempts };
}

function getFourthDownNumber(detailsPayload, dukeName, opponent) {
  const teamBoxes = getTeamBoxes(detailsPayload);
  const dukeStats = getTeamStats(teamBoxes.find((team) => team.team === dukeName));
  const opponentStats = getTeamStats(teamBoxes.find((team) => team.team === opponent));
  const dukeFourthDown = parseMadeAttempts(dukeStats.fourthDownEff);
  const opponentFourthDown = parseMadeAttempts(opponentStats.fourthDownEff);
  if (!dukeFourthDown || !opponentFourthDown) return null;

  return {
    value: `${dukeFourthDown.made}-${dukeFourthDown.attempts}`,
    label: 'FOURTH-DOWN CONVERSIONS',
    detail: `Duke converted ${dukeFourthDown.made} of ${dukeFourthDown.attempts} fourth downs; ${opponent} converted ${opponentFourthDown.made} of ${opponentFourthDown.attempts}.`,
  };
}

function getTotalOffenseNumber(detailsPayload, dukeName, opponent) {
  const teamBoxes = getTeamBoxes(detailsPayload);
  const dukeYards = numericStat(getTeamStats(teamBoxes.find((team) => team.team === dukeName)).totalYards);
  const opponentYards = numericStat(getTeamStats(teamBoxes.find((team) => team.team === opponent)).totalYards);
  if (dukeYards == null || opponentYards == null) return null;

  return {
    value: dukeYards,
    label: 'TOTAL OFFENSE',
    detail: `Duke totaled ${dukeYards} yards; ${opponent} totaled ${opponentYards}.`,
  };
}

function getTurningPoint(plays, dukeName, opponentName, playerNames = [], largestSwing = null) {
  const ordered = (plays || []).slice().sort((left, right) => {
    const periodDifference = Number(left.period || 0) - Number(right.period || 0);
    if (periodDifference !== 0) return periodDifference;
    const leftClock = (Number(left.clock?.minutes || 0) * 60) + Number(left.clock?.seconds || 0);
    const rightClock = (Number(right.clock?.minutes || 0) * 60) + Number(right.clock?.seconds || 0);
    return rightClock - leftClock;
  });
  const dukePlays = ordered.filter((play) => play.offense === dukeName);
  const resolvePlayer = (value) => {
    const token = value?.match(/#\d+\s+[A-Za-z]\.([A-Za-z][A-Za-z'-]*)/)?.[1] || value;
    if (!token) return null;
    const surname = token.match(/^[A-Za-z]\.([A-Za-z][A-Za-z'-]*)$/)?.[1] || token;
    return playerNames.find((name) => name.toLowerCase().endsWith(` ${surname.toLowerCase()}`)) || surname;
  };
  const player = (play) => resolvePlayer(play.playText);
  const time = (play) => `${String(play.clock?.minutes ?? 0).padStart(2, '0')}:${String(play.clock?.seconds ?? 0).padStart(2, '0')}`;
  const quarter = (play) => ['first', 'second', 'third', 'fourth'][Number(play.period) - 1] || 'overtime';
  const scoresFor = (play) => {
    const offenseScore = Number(play.offenseScore);
    const defenseScore = Number(play.defenseScore);
    if (!Number.isFinite(offenseScore) || !Number.isFinite(defenseScore)) return null;
    if (play.offense === dukeName) return { duke: offenseScore, opponent: defenseScore };
    if (play.defense === dukeName) return { duke: defenseScore, opponent: offenseScore };
    return null;
  };
  let previousScores = null;
  const scoreContext = new Map();
  for (const play of ordered) {
    const after = scoresFor(play);
    scoreContext.set(play, { before: previousScores, after });
    if (after) previousScores = after;
  }
  const situation = (play, context = scoreContext.get(play)) => {
    const timeText = Number(play.period) >= 5
      ? 'in overtime'
      : `with ${time(play)} left in the ${quarter(play)} quarter`;
    const after = context?.after;
    const scoreText = after ? `Duke ${after.duke}, ${opponentName} ${after.opponent}` : null;
    return `${timeText}${scoreText ? ` (${scoreText})` : ''}`;
  };
  const describePlay = (play) => {
    const text = play?.playText || '';
    const pass = text.match(/#\d+\s+([A-Za-z]\.\S+)\s+pass.*?to\s+#\d+\s+([A-Za-z]\.\S+).*?for\s+(\d+)\s+yards?/i);
    if (pass) return `${resolvePlayer(pass[1])} found ${resolvePlayer(pass[2])} for ${pass[3]} yards and a touchdown`;
    const rush = text.match(/#\d+\s+([A-Za-z]\.\S+)\s+rush.*?for\s+(\d+)\s+yards?/i);
    if (rush) return `${resolvePlayer(rush[1])} rushed for ${rush[2]} yards and a touchdown`;
    const fieldGoal = text.match(/#\d+\s+([A-Za-z]\.\S+)\s+field goal attempt from\s+(\d+)/i);
    if (fieldGoal) return `${resolvePlayer(fieldGoal[1])} hit a ${fieldGoal[2]}-yard field goal`;
    const compact = compactScoringDescription({ playText: text, playType: play?.playType });
    if (compact && compact !== play?.playType && compact !== 'Scoring play') {
      return playerNames.reduce((description, name) => {
        const surname = name.split(' ').at(-1);
        if (description.toLowerCase().includes(name.toLowerCase())) return description;
        return description.replace(new RegExp(`\\b${surname}\\b`, 'i'), name);
      }, compact);
    }
    return null;
  };
  if (largestSwing?.delta >= 8 && largestSwing.playText && !/field goal/i.test(largestSwing.playText)) {
    const swingQuarter = ['first', 'second', 'third', 'fourth'][Number(largestSwing.period) - 1] || 'overtime';
    const swingTime = Number(largestSwing.period) >= 5
      ? 'in overtime'
      : `with ${largestSwing.time} left in the ${swingQuarter} quarter`;
    const swingScore = largestSwing.dukeScore != null
      ? ` (Duke ${largestSwing.dukeScore}, ${opponentName} ${largestSwing.opponentScore})`
      : '';
    const playDescription = describePlay(largestSwing.play || largestSwing) || largestSwing.playText || 'a verified Duke play';
    return {
      type: 'win_probability_swing',
      period: largestSwing.period,
      time: largestSwing.time,
      delta: largestSwing.delta,
      beforeExpectancy: largestSwing.beforeExpectancy,
      afterExpectancy: largestSwing.afterExpectancy,
      description: `Duke's win expectancy jumped ${largestSwing.delta} points when ${playDescription} ${swingTime}${swingScore}.`,
      playText: largestSwing.playText,
      factsUsed: ['game.win_expectancy', 'game.scoring_plays'],
    };
  }
  const fakePunt = dukePlays.find((play) => /fake punt|punt fake|fake field goal/i.test(play.playText || ''));
  if (fakePunt) {
    return {
      type: 'fake_punt',
      period: fakePunt.period,
      time: time(fakePunt),
      description: player(fakePunt)
        ? `${player(fakePunt)} caught ${opponentName} napping on a fake punt ${situation(fakePunt)}.`
        : `Duke caught ${opponentName} napping on a fake punt ${situation(fakePunt)}.`,
      playText: fakePunt.playText,
      factsUsed: ['game.scoring_plays'],
    };
  }

  const fourthDownStop = ordered.find((play) => play.offense !== dukeName
    && Number(play.down) === 4
    && /turnover on downs|fourth down|4th down/i.test(play.playText || ''));
  if (fourthDownStop) {
    return {
      type: 'fourth_down_stop',
      period: fourthDownStop.period,
      time: time(fourthDownStop),
      description: `Duke got a fourth-down stop when ${opponentName} needed to keep the drive alive ${situation(fourthDownStop)}.`,
      playText: fourthDownStop.playText,
      factsUsed: ['game.scoring_plays'],
    };
  }

  const touchdown = dukePlays.find((play) => Number(play.period) >= 3 && play.scoring && /touchdown/i.test(play.playType || play.playText || ''));
  if (touchdown) {
    const touchdownPass = touchdown.playText?.match(/#\d+\s+([A-Za-z]\.\S+)\s+pass.*?to\s+#\d+\s+([A-Za-z]\.\S+)/i);
    const passer = resolvePlayer(touchdownPass?.[1]);
    const receiver = resolvePlayer(touchdownPass?.[2]);
    const rusher = player(touchdown);
    const context = scoreContext.get(touchdown);
    const leadText = context?.after?.duke > context?.after?.opponent
      && context?.before?.duke <= context?.before?.opponent
      ? `, putting Duke ahead ${context.after.duke}-${context.after.opponent}`
      : '';
    const description = passer && receiver
      ? `${passer} found ${receiver} for a touchdown ${situation(touchdown)}${leadText}.`
      : rusher
        ? `${rusher} scored a touchdown ${situation(touchdown)}${leadText}.`
        : `Duke scored a second-half touchdown ${situation(touchdown)}${leadText}.`;
    return {
      type: 'touchdown',
      period: touchdown.period,
      time: time(touchdown),
      description,
      playText: touchdown.playText,
      factsUsed: ['game.scoring_plays'],
    };
  }

  const explosivePlay = dukePlays
    .filter((play) => Number(play.yardsGained) >= 20 && !/field goal|punt|kickoff|extra point/i.test(play.playType || play.playText || ''))
    .sort((left, right) => Number(right.yardsGained) - Number(left.yardsGained))[0];
  if (explosivePlay) {
    const name = player(explosivePlay);
    return {
      type: 'explosive_play',
      yards: Number(explosivePlay.yardsGained),
      period: explosivePlay.period,
      time: time(explosivePlay),
      description: name
        ? `${name} broke free for ${Number(explosivePlay.yardsGained)} yards ${situation(explosivePlay)}.`
        : `Duke broke free for ${Number(explosivePlay.yardsGained)} yards ${situation(explosivePlay)}.`,
      playText: explosivePlay.playText,
      factsUsed: ['game.scoring_plays'],
    };
  }

  return null;
}

function getSecondHalfPointsAllowed(quarterRows) {
  const opponentRow = quarterRows[1];
  const thirdQuarter = numericStat(opponentRow?.q3);
  const fourthQuarter = numericStat(opponentRow?.q4);
  if (thirdQuarter == null || fourthQuarter == null) return null;
  return thirdQuarter + fourthQuarter;
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

function formatHistoricalGameDate(startAt) {
  if (!startAt) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date(startAt));
}

function formatIssueDateKey(startAt) {
  const date = startAt ? new Date(startAt) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/New_York',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function buildScorigamiContext(scoreFacts, occurrences, fallbackScore) {
  const scorePair = scoreFacts.scorePair || fallbackScore;
  if (scoreFacts.isNew) return `${scorePair} had never occurred in Duke football history.`;

  const count = scoreFacts.occurrenceCount ?? occurrences.length;
  const previousGames = occurrences
    .map((occurrence) => {
      const date = formatHistoricalGameDate(occurrence.startAt);
      const location = occurrence.location ? ` at ${occurrence.location}` : '';
      return `Duke ${occurrence.dukeScore}, ${occurrence.opponent} ${occurrence.opponentScore}${date ? ` on ${date}` : ''}${location}`;
    })
    .join('; ');
  const base = `${scorePair} has occurred ${count} previous time${count === 1 ? '' : 's'} in Duke football history.`;
  return previousGames ? `${base} Previous games: ${previousGames}.` : base;
}

function formatNextDetails(nextGame, nextSchedule) {
  if (!nextGame?.start_at) return 'Schedule details are not yet available.';
  const startAt = new Date(nextGame.start_at);
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(startAt);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(startAt);
  const network = nextSchedule?.network && nextSchedule.network !== 'TBA' ? nextSchedule.network : 'TBD';
  return `${date} · ${time} ET · ${nextGame.venue_name || 'Venue TBD'} · TV: ${network}`;
}

export function buildSundayIssueData({
  game,
  participants,
  sourcePayload,
  detailsPayload,
  facts,
  directive,
  guideContext = null,
  nextGame,
  nextParticipants = [],
  nextSchedule = null,
  scorigamiHistory = [],
  accContext = null,
  odds = null,
  watercoolerContext = null,
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
  const secondHalfPointsAllowed = getSecondHalfPointsAllowed(quarterRows);
  const scoreFacts = facts?.scorigami || {};
  const turnoverNumber = getTurnoverNumber(detailsPayload, dukeName, scores.opponent);
  const teamNumber = getFourthDownNumber(detailsPayload, dukeName, scores.opponent)
    || getTotalOffenseNumber(detailsPayload, dukeName, scores.opponent);
  const playerNames = getPlayerBoxes(detailsPayload)
    .flatMap((team) => (team.categories || []).flatMap((category) => (category.types || []).flatMap((type) => (type.athletes || []).map((athlete) => athlete.name))))
    .filter(Boolean);
  const winExpectancySnapshots = calculateWinExpectancySnapshots({
    plays,
    dukeName,
    opponentName: scores.opponent,
    dukeScore: scores.dukeScore,
    opponentScore: scores.opponentScore,
  });
  const largestWinExpectancySwing = findLargestWinExpectancySwing(winExpectancySnapshots);
  const turningPoint = getTurningPoint(plays, dukeName, scores.opponent, playerNames, largestWinExpectancySwing);
  const summaryStats = getSummaryStats(detailsPayload, dukeName);
  const nextDetails = formatNextDetails(nextGame, nextSchedule);
  const nextOpponent = nextParticipants.find((participant) => !isDuke(participant.team))?.team?.name || 'Next opponent TBD';

  return {
    publication_key: 'devil-in-details',
    edition: 'sunday',
    game_id: game.id,
    issue_date_key: formatIssueDateKey(game.start_at),
    subject: `Devil in the Details: Duke ${scores.dukeScore}-${scores.opponentScore}`,
    preview_text: `Duke ${scores.dukeScore}-${scores.opponentScore} vs ${scores.opponent}.`,
    current_opponent: scores.opponent,
    current_score: `${scores.dukeScore}-${scores.opponentScore}`,
    turning_point: turningPoint,
    win_expectancy: {
      snapshots: winExpectancySnapshots,
      largest_swing: largestWinExpectancySwing,
      caption: 'Duke win expectancy model from play-by-play, score, clock, possession, and field position. The center line marks 50/50.',
    },
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
      {
        value: secondHalfPointsAllowed ?? '—',
        label: 'SECOND-HALF POINTS ALLOWED',
        detail: secondHalfPointsAllowed == null
          ? 'Duke\'s second-half defensive total.'
          : `Duke held ${scores.opponent} to ${secondHalfPointsAllowed} point${secondHalfPointsAllowed === 1 ? '' : 's'} after halftime.`,
      },
      { value: turnoverNumber?.value || '—', label: 'TURNOVER MARGIN', detail: turnoverNumber?.detail || 'Awaiting a verified team-stat feed.' },
      teamNumber || { value: '—', label: 'TEAM STAT', detail: 'Awaiting a verified team-stat feed.' },
    ],
    leaders: getLeaders(detailsPayload, dukeName),
    scorigami_status: scoreFacts.isNew ? 'NEW SCORE!' : 'FAMILIAR TERRITORY.',
    scorigami_context: buildScorigamiContext(scoreFacts, scorigamiHistory, `${scores.dukeScore}-${scores.opponentScore}`),
    guide_context: guideContext,
    acc_scores: [],
    acc_context: accContext,
    next_opponent: nextOpponent,
    next_details: nextDetails,
    next_game_id: nextGame?.id || null,
    next_game_start_at: nextGame?.start_at || null,
    next_schedule: nextSchedule,
    odds,
    watercooler_context: watercoolerContext,
    source_url: `https://www.winsipedia.com/duke/schedule/${game.season}`,
    footer_text: 'A quick read on the game, the numbers, and what comes next.',
    unsubscribe_url: 'https://example.com/unsubscribe',
    preferences_url: 'https://example.com/preferences',
    source_payload: sourcePayload,
  };
}
