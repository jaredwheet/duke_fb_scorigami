import supabase from './supabaseClient.js';

export async function isScorigami(dukeScore, oppScore) {
  // Check for either (teamAScore, teamBScore) or (teamBScore, teamAScore)
  const { data, error } = await supabase
    .from('duke_football_games')
    .select('*')
    .or(`and(teamAScore.eq.${dukeScore},teamBScore.eq.${oppScore}),and(teamAScore.eq.${oppScore},teamBScore.eq.${dukeScore})`);
  if (error) throw error;
  return data.length === 0;
}

// Helper to find the last occurrence of a score (most recent occurrence)
export async function getLastScoreOccurrence(dukeScore, oppScore, currentGame) {
  const { data, error } = await supabase
    .from('duke_football_games')
    .select('*')
    .or(`and(teamAScore.eq.${dukeScore},teamBScore.eq.${oppScore}),and(teamAScore.eq.${oppScore},teamBScore.eq.${dukeScore})`);
  if (error || !data || data.length === 0) return null;
  // Sort by date descending (most recent first)
  const sorted = data.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    return sorted.length > 0 ? sorted[0] : null;
  }

