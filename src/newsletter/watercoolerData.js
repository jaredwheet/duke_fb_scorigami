import { buildOpponentHistory, selectHistoricalFact } from './guideContext.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function localDateParts(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
}

function localDateKey(value) {
  const parts = localDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekDateKeys(startAt) {
  const dateKey = localDateKey(startAt);
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return Array.from({ length: 7 }, (_, index) => addDays(dateKey, mondayOffset + index));
}

function isDuke(team) {
  return team?.slug === 'duke' || team?.name?.toLowerCase() === 'duke';
}

function recordLabel(dukeScore, opponentScore, opponentName = 'the opponent') {
  if (dukeScore == null || opponentScore == null) return 'score unavailable';
  return dukeScore > opponentScore ? `Duke beat ${opponentName} ${dukeScore}-${opponentScore}`
    : dukeScore < opponentScore ? `${opponentName} beat Duke ${opponentScore}-${dukeScore}`
      : `Duke tied ${dukeScore}-${opponentScore}`;
}

export function describeWinnerFirstGame(game) {
  const opponent = game.opponent || 'the opponent';
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date(game.startAt));
  const score = game.dukeScore === game.opponentScore
    ? `Duke ${game.dukeScore}, ${opponent} ${game.opponentScore}`
    : game.dukeScore > game.opponentScore
      ? `Duke ${game.dukeScore}, ${opponent} ${game.opponentScore}`
      : `${opponent} ${game.opponentScore}, Duke ${game.dukeScore}`;
  return `${dateLabel}, ${game.season}: ${score}`;
}

export function chooseWatercoolerBackstory(games = [], fallback = null) {
  const shootout = games
    .slice()
    .sort((left, right) => (right.dukeScore + right.opponentScore) - (left.dukeScore + left.opponentScore))[0];
  if (shootout && shootout.dukeScore + shootout.opponentScore >= 70) {
    const winnerFirst = describeWinnerFirstGame(shootout).replace(/, \d{4}: /, ': ');
    return `The week's wildest scoreboard belongs to ${winnerFirst}: ${shootout.dukeScore + shootout.opponentScore} combined points, and a game nobody could mistake for a defensive clinic.`;
  }
  if (games[0]) return `The archive's best footnote this week is ${describeWinnerFirstGame(games[0])}.`;
  return fallback || 'The archive is opening with a verified program-history fact rather than recycling last week\'s recap.';
}

async function fetchAllRows(client, table, columns, configure, pageSize = 500) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = client.from(table).select(columns);
    query = configure(query);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

export async function loadWatercoolerContext(client, { guide, nextGame, nextParticipants = [] } = {}) {
  if (!nextGame) return null;
  const [games, participants, teams] = await Promise.all([
    fetchAllRows(client, 'games', 'id, season, start_at, status, venue_name, city, state', (query) => query.eq('status', 'final')),
    fetchAllRows(client, 'game_participants', 'game_id, team_id, score', (query) => query),
    client.from('teams').select('id, slug, name').then(({ data, error }) => {
      if (error) throw error;
      return data || [];
    }),
  ]);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const participantsByGame = new Map();
  for (const participant of participants) {
    const list = participantsByGame.get(participant.game_id) || [];
    list.push({ ...participant, team: teamsById.get(participant.team_id) });
    participantsByGame.set(participant.game_id, list);
  }

  const historicalGames = games.flatMap((game) => {
    const gameParticipants = participantsByGame.get(game.id) || [];
    const duke = gameParticipants.find((participant) => isDuke(participant.team));
    const opponent = gameParticipants.find((participant) => !isDuke(participant.team));
    if (!duke || !opponent || duke.score == null || opponent.score == null || !game.start_at) return [];
    return [{
      gameId: game.id,
      season: game.season,
      startAt: game.start_at,
      opponent: opponent.team.name,
      opponentSlug: opponent.team.slug,
      dukeScore: Number(duke.score),
      opponentScore: Number(opponent.score),
      location: [game.venue_name, game.city, game.state].filter(Boolean).join(', '),
    }];
  });
  const upcomingOpponent = nextParticipants.find((participant) => !isDuke(participant.team));
  const upcomingOpponentName = upcomingOpponent?.team?.name || 'the next opponent';
  const upcomingOpponentSlug = upcomingOpponent?.team?.slug;
  const dateKeys = new Set(weekDateKeys(nextGame.start_at));
  const weekGames = historicalGames
    .filter((game) => dateKeys.has(localDateKey(game.startAt)))
    .sort((left, right) => new Date(right.startAt) - new Date(left.startAt));
  const opponentGames = historicalGames
    .filter((game) => game.opponentSlug === upcomingOpponentSlug && new Date(game.startAt) < new Date(nextGame.start_at))
    .sort((left, right) => new Date(right.startAt) - new Date(left.startAt));
  const series = guide
    ? buildOpponentHistory({ guide, opponent: upcomingOpponentName, season: nextGame.season })
    : null;
  const historicalFact = guide
    ? selectHistoricalFact({ guide, opponent: upcomingOpponentName })
    : null;
  const weekLabelParts = [...dateKeys].map((dateKey) => new Date(`${dateKey}T12:00:00Z`));
  const firstWeekDate = weekLabelParts[0];
  const lastWeekDate = weekLabelParts.at(-1);
  const weekLabel = firstWeekDate && lastWeekDate
    ? `${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' }).format(firstWeekDate)}-${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' }).format(lastWeekDate)}`
    : 'this week';
  const highestScoringWeekGame = weekGames
    .slice()
    .sort((left, right) => right.dukeScore - left.dukeScore)[0];
  const programFact = guide?.programRecords?.[0]?.entries?.[0]
    ? `${guide.programRecords[0].entries[0].player} owns Duke's ${guide.programRecords[0].label.toLowerCase()} mark at ${guide.programRecords[0].entries[0].value}.`
    : null;
  const fallbackFact = historicalFact?.statement
    || series?.historicalNote
    || programFact;

  return {
    weekLabel,
    weekGames: weekGames.slice(0, 5),
    weekSummary: weekGames.length > 0
      ? `${weekGames.length} Duke archive entr${weekGames.length === 1 ? 'y' : 'ies'} land on these calendar dates: ${weekGames.slice(0, 3).map(describeWinnerFirstGame).join('; ')}.`
      : programFact || 'This week\'s column is opening with the strongest verified archive fact available.',
    backstory: chooseWatercoolerBackstory(weekGames, programFact),
    opponentHistory: series?.statement || (opponentGames.length > 0
      ? `Duke is ${opponentGames.filter((game) => game.dukeScore > game.opponentScore).length}-${opponentGames.filter((game) => game.dukeScore < game.opponentScore).length} against ${upcomingOpponentName} in the indexed record.`
      : `The indexed archive has no prior Duke-${upcomingOpponentName} meeting.`),
    recentOpponentGames: opponentGames.slice(0, 3).map(describeWinnerFirstGame),
    historicalFact: fallbackFact || (highestScoringWeekGame ? `The highest Duke score in this week's indexed games was ${highestScoringWeekGame.dukeScore}, against ${highestScoringWeekGame.opponent}.` : 'The archive is opening with a verified program-history fact.'),
    nextGameFact: `${upcomingOpponentName} is next. ${recordLabel(opponentGames[0]?.dukeScore, opponentGames[0]?.opponentScore, upcomingOpponentName)}`,
  };
}
