
import supabase from './supabaseClient.js';

// Returns { isScorigami: boolean, occurrences: number, games: array }
export async function isScorigami(dukeScore, oppScore) {
  const { data, error } = await supabase
    .from('duke_football_games')
    .select('*')
    .or(`and(teamAScore.eq.${dukeScore},teamBScore.eq.${oppScore}),and(teamAScore.eq.${oppScore},teamBScore.eq.${dukeScore})`);
  if (error) throw error;
  return {
    isScorigami: data.length === 0,
    occurrences: data.length,
    games: data || []
  };
}

// Helper to find the last occurrence of a score (most recent occurrence)
export function getLastScoreOccurrenceFromGames(games) {
  if (!games || games.length === 0) return null;
  // Sort by date descending (most recent first)
  const sorted = games.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  return sorted.length > 0 ? sorted[0] : null;
}

