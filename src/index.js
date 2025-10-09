
import 'dotenv/config';
import { getDukeGame, getGameVenue } from './gameApi.js';
import { isScoreGami } from './scorigami.js';
import { alreadyTweeted, markTweeted, insertGame } from './db.js';
import { tweet } from './twitterClient.js';

const todayDate = new Date().toISOString().split('T')[0];

async function run() {
  console.log('Checking Duke game...');
  const game = await getDukeGame(todayDate);
  if (!game) return console.log('No Duke game today.');

  const venue = await getGameVenue(game);
  if (venue) {
    console.log(`Duke vs ${game.awayTeam} at ${venue.name}, ${venue.city}, ${venue.state}`);
  } else {
    console.log('Venue info not found');
  }

  const dukeIsHome = game.homeTeam === 'Duke';
  const dukeScore = dukeIsHome ? game.homePoints : game.awayPoints;
  const oppScore = dukeIsHome ? game.awayPoints : game.homePoints;
  const opponent = dukeIsHome ? game.awayTeam : game.homeTeam;
  const scoreKey = `${dukeScore}-${oppScore}`;

  if (dukeScore == null || oppScore == null) {
    console.log('Game not started yet.');
    return;
  }

  // In-progress
  if (!game.completed) {
    const gami = await isScoreGami(dukeScore, oppScore);
    if (!(await alreadyTweeted(game.id, scoreKey))) {
      const msg = gami
        ? `👀 In-progress update:\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nIf this holds, it'll be a #SCOREGAMI — a score that's NEVER happened before! 🏈`
        : `Live update:\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nNot a ScoreGami yet.`;
      await tweet(msg);
      await markTweeted(game.id, scoreKey);
    }
  }

  // Final
  if (game.completed) {
    const gami = await isScoreGami(dukeScore, oppScore);
    if (!(await alreadyTweeted(game.id, `${scoreKey}-final`))) {
      const msg = gami
        ? `🚨 FINAL SCOREGAMI 🚨\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nThis score has NEVER happened before in Duke football history! 🏈`
        : `Final: Duke ${dukeScore}-${oppScore} vs ${opponent}\nNot a ScoreGami — it's happened before.`;
      await tweet(msg);
      await markTweeted(game.id, `${scoreKey}-final`);
    }

    // Store game result if not already in Supabase
    await insertGame(game, venue, dukeIsHome);
  }
}

run();
