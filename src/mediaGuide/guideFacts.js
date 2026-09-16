function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeOpponentSlug(value) {
  const slug = normalizeText(value);
  const aliases = {
    'nc-state': 'nc-state',
    'n-c-state': 'nc-state',
    'north-carolina-state': 'nc-state',
    'north-carolina': 'north-carolina',
    'william-mary': 'william-and-mary',
    'the-citadel': 'citadel',
  };
  return aliases[slug] || slug;
}

function sameTeam(left, right) {
  return normalizeOpponentSlug(left?.slug || left?.name || left) === normalizeOpponentSlug(right?.slug || right?.name || right);
}

export function numericStat(value) {
  const number = Number.parseFloat(String(value ?? '').replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}

function playerMetrics(teamBox, categoryName) {
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

function teamPlayerBox(detailsPayload, dukeName) {
  return (detailsPayload?.playerStats || [])
    .flatMap((game) => game.teams || [])
    .find((team) => sameTeam(team.team, dukeName));
}

function findLeader(teamBox, category, metric) {
  return playerMetrics(teamBox, category)
    .filter(({ metrics }) => numericStat(metrics[metric]) != null)
    .sort((left, right) => numericStat(right.metrics[metric]) - numericStat(left.metrics[metric]))[0] || null;
}

function scoreSnapshot(play, dukeName, opponentName) {
  const offense = play.offense;
  const defense = play.defense;
  const offenseScore = numericStat(play.offenseScore);
  const defenseScore = numericStat(play.defenseScore);
  if (offenseScore == null || defenseScore == null) return null;
  if (sameTeam(offense, dukeName) && sameTeam(defense, opponentName)) {
    return { duke: offenseScore, opponent: defenseScore };
  }
  if (sameTeam(defense, dukeName) && sameTeam(offense, opponentName)) {
    return { duke: defenseScore, opponent: offenseScore };
  }
  return null;
}

function citationFor(guide, citationId) {
  const citation = guide.citations?.[citationId];
  return citation ? { edition: guide.edition, ...citation } : null;
}

export function calculateComebackFact({
  dukeName = 'Duke',
  opponentName,
  dukeScore,
  opponentScore,
  plays = [],
  guide,
}) {
  const finalDukeScore = numericStat(dukeScore);
  const finalOpponentScore = numericStat(opponentScore);
  if (finalDukeScore == null || finalOpponentScore == null || finalDukeScore <= finalOpponentScore) return null;

  let largestDeficit = 0;
  let trailingAt = null;
  for (const play of [...plays].sort((left, right) => (left.playNumber || 0) - (right.playNumber || 0))) {
    const snapshot = scoreSnapshot(play, dukeName, opponentName);
    if (!snapshot) continue;
    const deficit = snapshot.opponent - snapshot.duke;
    if (deficit > largestDeficit) {
      largestDeficit = deficit;
      const minutes = String(play.clock?.minutes ?? 0).padStart(2, '0');
      const seconds = String(play.clock?.seconds ?? 0).padStart(2, '0');
      trailingAt = `Q${play.period || 0} ${minutes}:${seconds}`;
    }
  }

  if (largestDeficit <= 0) return null;
  const historical = (guide?.comebackHistory || [])
    .filter((entry) => entry.opponentSlug === normalizeOpponentSlug(opponentName))
    .sort((left, right) => right.largestDeficit - left.largestDeficit)[0] || null;

  return {
    comeback: true,
    largestDeficit,
    trailingAt,
    source: 'cfbdata_game_details',
    confidence: 'verified',
    historicalReference: historical
      ? {
        id: historical.id,
        opponentSlug: historical.opponentSlug,
        largestDeficit: historical.largestDeficit,
        season: historical.season,
        citation: citationFor(guide, historical.citationId),
      }
      : null,
  };
}

export function calculateLateGameFact({
  dukeName = 'Duke',
  opponentName,
  dukeScore,
  opponentScore,
  plays = [],
}) {
  const finalDukeScore = numericStat(dukeScore);
  const finalOpponentScore = numericStat(opponentScore);
  if (finalDukeScore == null || finalOpponentScore == null || finalDukeScore <= finalOpponentScore) return null;

  let previousSnapshot = null;
  let winningPlay = null;
  for (const play of [...plays].sort((left, right) => (left.playNumber || 0) - (right.playNumber || 0))) {
    const snapshot = scoreSnapshot(play, dukeName, opponentName);
    if (!snapshot) continue;
    const period = numericStat(play.period);
    if (period >= 4 && snapshot.duke > snapshot.opponent && (!previousSnapshot || previousSnapshot.duke <= previousSnapshot.opponent)) {
      winningPlay = { play, period, snapshot };
    }
    previousSnapshot = snapshot;
  }

  if (!winningPlay) return null;
  return {
    lateGameWin: true,
    period: winningPlay.period,
    time: `${String(winningPlay.play.clock?.minutes ?? 0).padStart(2, '0')}:${String(winningPlay.play.clock?.seconds ?? 0).padStart(2, '0')}`,
    playText: winningPlay.play.playText || winningPlay.play.playType || null,
    source: 'cfbdata_game_details',
    confidence: 'verified',
  };
}

export function calculateRecordWatch({ detailsPayload, dukeName = 'Duke', opponentName, season, guide }) {
  const teamBox = teamPlayerBox(detailsPayload, dukeName);
  const candidates = [
    { metric: 'passingYards', category: 'passing', stat: 'YDS' },
    { metric: 'rushingYards', category: 'rushing', stat: 'YDS' },
    { metric: 'receivingYards', category: 'receiving', stat: 'YDS' },
    { metric: 'sacks', category: 'defensive', stat: 'SACKS' },
  ];

  for (const candidate of candidates) {
    const leader = findLeader(teamBox, candidate.category, candidate.stat);
    if (!leader) continue;
    const value = numericStat(leader.metrics[candidate.stat]);
    const record = guide?.programRecords?.find((entry) => entry.metric === candidate.metric);
    if (!record?.entries?.length) continue;
    const entries = record.entries.slice().sort((left, right) => right.value - left.value);
    const rank = 1 + entries.filter((entry) => entry.value > value).length;
    const lowestPublishedValue = entries.at(-1).value;
    if (value < lowestPublishedValue || rank > 5) continue;

    const topValue = entries[0].value;
    const status = value > topValue ? 'record' : value === topValue ? 'tied_record' : 'top_five';
    const recordName = record.label.replace(/^Duke\s+/i, '').toLowerCase();
    const statusText = status === 'record'
      ? `set a new Duke record for ${recordName}`
      : status === 'tied_record'
        ? `tied the Duke record for ${recordName}`
        : `ranked No. ${rank} on Duke's ${recordName} list`;

    return {
      id: record.id,
      status,
      metric: candidate.metric,
      player: leader.name,
      value,
      rank,
      opponent: opponentName,
      season,
      statement: `${leader.name} recorded ${value} ${recordName} against ${opponentName} and ${statusText}.`,
      citation: citationFor(guide, record.citationId),
    };
  }

  return null;
}
