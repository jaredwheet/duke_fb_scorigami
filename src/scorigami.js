import supabase from './supabaseClient.js';

export async function isScoreGami(dukeScore, oppScore) {
  // Check for either (duke_score, opponent_score) or (opponent_score, duke_score)
  const { data, error } = await supabase
    .from('duke_football_games')
    .select('*')
    .or(`and(duke_score.eq.${dukeScore},opponent_score.eq.${oppScore}),and(duke_score.eq.${oppScore},opponent_score.eq.${dukeScore})`);
  if (error) throw error;
  return data.length === 0;
}
