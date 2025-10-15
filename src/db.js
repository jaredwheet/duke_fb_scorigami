import supabase from './supabaseClient.js';

export async function alreadyTweeted(gameId, scoreKey) {
  const { data } = await supabase
    .from('tweeted_scores')
    .select('*')
    .eq('game_id', gameId)
    .eq('score_key', scoreKey);
    console.log('Already tweeted check:', data);
  return data && data.length > 0;
}

export async function markTweeted(gameId, scoreKey) {
  await supabase.from('tweeted_scores').insert({ game_id: gameId, score_key: scoreKey });
}

export async function insertGame(game, venue, dukeIsHome) {
  await supabase.from('duke_football_games').insert({
    date: game.startDate,
    season: game.season,
    week: game.week,
    teamAScore: dukeIsHome ? game.homePoints : game.awayPoints,
    teamBScore: dukeIsHome ? game.awayPoints : game.homePoints,
    neutralSite: game.neutralSite,
    city: venue && venue.city ? venue.city : null,
    state: venue && venue.state ? venue.state : null,
    notes: game.notes,
    teamA: {
      id: game.homeId,
      name: game.homeTeam,
      conference: game.homeConference,
      classification: game.homeClassification,
      pregameElo: game.homePregameElo,
      postgameElo: game.homePostgameElo
    },
    teamB: {
      id: game.awayId,
      name: game.awayTeam,
      conference: game.awayConference,
      classification: game.awayClassification,
      pregameElo: game.awayPregameElo,
      postgameElo: game.awayPostgameElo
    },
    // Add forfeited, vacated, bowl if available
  }).catch(() => {}); // ignore duplicates
}
