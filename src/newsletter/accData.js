import { fetchCfbDataConferenceRecords, fetchCfbDataRankings, fetchCfbDataWeekGames } from '../ingestion/providers/cfbData.js';

function recordText(record) {
  if (!record) return '—';
  const ties = Number(record.ties || 0);
  return `${record.wins ?? 0}-${record.losses ?? 0}${ties ? `-${ties}` : ''}`;
}

function buildRankingsMap(rankings) {
  const poll = rankings
    .flatMap((week) => week.polls || [])
    .find((candidate) => candidate.poll === 'AP Top 25')
    || rankings.flatMap((week) => week.polls || [])[0];
  return new Map((poll?.ranks || []).map((rank) => [rank.school, rank.rank]));
}

function normalizeRecord(record, rankingsMap) {
  const conference = record.conferenceGames || record.conferenceRecord || {};
  const overall = record.total || {};
  return {
    team: record.team,
    rank: rankingsMap.get(record.team) || null,
    conference: record.conference || 'ACC',
    conferenceRecord: recordText(conference),
    overallRecord: recordText(overall),
    conferenceWins: Number(conference.wins || 0),
    conferenceLosses: Number(conference.losses || 0),
    overallWins: Number(overall.wins || 0),
    overallLosses: Number(overall.losses || 0),
  };
}

function isAccGame(game) {
  return game.homeConference === 'ACC' || game.awayConference === 'ACC';
}

export function normalizeAccContext({ records = [], games = [], rankings = [], currentGameId = null } = {}) {
  const rankingsMap = buildRankingsMap(rankings);
  const standings = records
    .filter((record) => record.conference === 'ACC')
    .map((record) => normalizeRecord(record, rankingsMap))
    .sort((left, right) => right.conferenceWins - left.conferenceWins
      || left.conferenceLosses - right.conferenceLosses
      || right.overallWins - left.overallWins
      || left.team.localeCompare(right.team));

  const results = games
    .filter((game) => isAccGame(game)
      && game.completed
      && game.awayPoints != null
      && game.homePoints != null
      && String(game.id) !== String(currentGameId))
    .sort((left, right) => new Date(left.startDate) - new Date(right.startDate))
    .map((game) => {
      const awayScore = Number(game.awayPoints);
      const homeScore = Number(game.homePoints);
      const homeWon = homeScore > awayScore;
      return {
        winner: homeWon ? game.homeTeam : game.awayTeam,
        loser: homeWon ? game.awayTeam : game.homeTeam,
        score: homeWon ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`,
        startDate: game.startDate,
      };
    });

  return { standings, results };
}

export async function loadAccContext({
  season,
  week,
  currentGameId,
  apiKey = process.env.CFB_DATA_KEY,
  gamesFetcher = fetchCfbDataWeekGames,
  recordsFetcher = fetchCfbDataConferenceRecords,
  rankingsFetcher = fetchCfbDataRankings,
} = {}) {
  if (!apiKey || week == null) return null;
  const [games, records, rankings] = await Promise.all([
    gamesFetcher({ year: season, week, apiKey }),
    recordsFetcher({ year: season, apiKey }),
    rankingsFetcher({ year: season, week, apiKey }),
  ]);
  return normalizeAccContext({ games, records, rankings, currentGameId });
}
