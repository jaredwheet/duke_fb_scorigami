
import supabase from './supabaseClient.js';

function sameGame(record, game) {
  if (!game || !record?.date || !game.startDate) return false;

  const recordDate = new Date(record.date);
  const gameDate = new Date(game.startDate);
  if (Number.isNaN(recordDate.getTime()) || Number.isNaN(gameDate.getTime())) return false;

  const sameDate = recordDate.toISOString().slice(0, 10) === gameDate.toISOString().slice(0, 10);
  const sameSeason = record.season == null || game.season == null || record.season === game.season;
  const sameWeek = record.week == null || game.week == null || record.week === game.week;
  return sameDate && sameSeason && sameWeek;
}

// Returns { isScorigami: boolean, occurrences: number, games: array }
export async function isScorigami(dukeScore, oppScore, currentGame = null) {
  const { data, error } = await supabase
    .from('duke_football_games')
    .select('*')
    .or(`and(teamAScore.eq.${dukeScore},teamBScore.eq.${oppScore}),and(teamAScore.eq.${oppScore},teamBScore.eq.${dukeScore})`);
  if (error) throw error;
  const games = (data || []).filter((game) => !sameGame(game, currentGame));
  return {
    isScorigami: games.length === 0,
    occurrences: games.length,
    games,
  };
}

// Helper to find the last occurrence of a score (most recent occurrence)
export function getLastScoreOccurrenceFromGames(games) {
  if (!games || games.length === 0) return null;
  // Sort by date descending (most recent first)
  const sorted = games.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  return sorted.length > 0 ? sorted[0] : null;
}
