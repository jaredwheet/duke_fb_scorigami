import supabase from './supabaseClient.js';
import { randomUUID } from 'node:crypto';

export async function claimTweet({ gameId, scoreKey, claimToken = randomUUID() } = {}) {
    const { data, error } = await supabase.rpc('claim_tweeted_score', {
        p_game_id: gameId,
        p_score_key: scoreKey,
        p_claim_token: claimToken,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return {
        claimed: result?.claimed === true,
        claimToken: result?.claimed === true ? claimToken : null,
        status: result?.status || null,
    };
}

export async function finalizeTweet({
    gameId,
    scoreKey,
    claimToken,
    tweetId = null,
    tweetUrl = null,
    contentType = null,
    templateVersion = null,
} = {}) {
    const { data, error } = await supabase.rpc('finalize_tweeted_score', {
        p_game_id: gameId,
        p_score_key: scoreKey,
        p_claim_token: claimToken,
        p_tweet_id: tweetId,
        p_tweet_url: tweetUrl,
        p_content_type: contentType,
        p_template_version: templateVersion,
    });
    if (error) throw error;
    return data === true;
}

export async function recordTweetError({ gameId, scoreKey, claimToken, error } = {}) {
    const { data, error: rpcError } = await supabase.rpc('record_tweeted_score_error', {
        p_game_id: gameId,
        p_score_key: scoreKey,
        p_claim_token: claimToken,
        p_error: String(error?.message || error || 'Unknown publication error'),
    });
    if (rpcError) throw rpcError;
    return data === true;
}

export async function alreadyTweeted(gameId, scoreKey) {
    const { data, error } = await supabase
        .from('tweeted_scores')
        .select('*')
        .eq('game_id', gameId)
        .eq('score_key', scoreKey);
    if (error) throw error;
    console.log('Already tweeted check:', data);
    return (data || []).length > 0;
}


export async function markTweeted(
  gameId,
  scoreKey,
  { tweetId = null, tweetUrl = null, contentType = null, templateVersion = null } = {},
) {
  const { error } = await supabase
    .from('tweeted_scores')
    .insert({
      game_id: gameId,
      score_key: scoreKey,
      tweet_id: tweetId,
      tweet_url: tweetUrl,
      content_type: contentType,
      template_version: templateVersion,
    });
  if (error) throw error;
}


export async function insertGame(game, venue, dukeIsHome) {
  const teamAScore = dukeIsHome ? game.homePoints : game.awayPoints;
  const teamBScore = dukeIsHome ? game.awayPoints : game.homePoints;
  const homeTeam = {
    id: game.homeId,
    name: game.homeTeam,
    conference: game.homeConference,
    classification: game.homeClassification,
    pregameElo: game.homePregameElo,
    postgameElo: game.homePostgameElo,
  };
  const awayTeam = {
    id: game.awayId,
    name: game.awayTeam,
    conference: game.awayConference,
    classification: game.awayClassification,
    pregameElo: game.awayPregameElo,
    postgameElo: game.awayPostgameElo,
  };
  const teamA = dukeIsHome ? homeTeam : awayTeam;
  const teamB = dukeIsHome ? awayTeam : homeTeam;
  const { data: existingGames, error: lookupError } = await supabase
    .from('duke_football_games')
    .select('date, season, week, teamAScore, teamBScore')
    .eq('season', game.season);
  if (lookupError) throw lookupError;

  const gameDate = new Date(game.startDate);
  const gameDateKey = Number.isNaN(gameDate.getTime()) ? null : gameDate.toISOString().slice(0, 10);
  const alreadyStored = (existingGames || []).some((existingGame) => {
    const existingDate = new Date(existingGame.date);
    const existingDateKey = Number.isNaN(existingDate.getTime())
      ? null
      : existingDate.toISOString().slice(0, 10);
    return existingDateKey === gameDateKey &&
      (existingGame.week == null || game.week == null || existingGame.week === game.week) &&
      Number(existingGame.teamAScore) === Number(teamAScore) &&
      Number(existingGame.teamBScore) === Number(teamBScore);
  });
  if (alreadyStored) return;

  const { error } = await supabase.from('duke_football_games').insert({
    date: game.startDate,
    external_game_id: game.id,
    season: game.season,
    week: game.week,
    teamAScore,
    teamBScore,
    neutralSite: game.neutralSite,
    city: venue && venue.city ? venue.city : null,
    state: venue && venue.state ? venue.state : null,
    notes: game.notes,
    teamA,
    teamB,
  });
  if (error) throw error;
}
