import { trimTweet } from './tweetUtils.js';
import 'dotenv/config';
import { getDukeGame, getGameVenue, getNextScheduledDukeGame } from './gameApi.js';
import { isScorigami, getLastScoreOccurrenceFromGames } from './scorigami.js';
import { alreadyTweeted, markTweeted, insertGame } from './db.js';
import { tweet } from './twitterClient.js';
import { TAGGED_ACCOUNTS, HASHTAGS } from './tweetConfig.js';


export async function run() {
    // Pregame reminder logic for Wednesday
    try {
        const todayDate = new Date().toISOString().split('T')[0];
        const today = new Date();
        if (today.getDay() === 3) { // 3 = Wednesday
            const nextGame = await getNextScheduledDukeGame();
            if (nextGame) {
                const pregameKey = 'pregame';
                if (await alreadyTweeted(nextGame.id, pregameKey)) {
                    console.log('Pregame tweet already sent for this game. Exiting.');
                    return;
                }
                const venue = await getGameVenue(nextGame);
                const opponent = nextGame.homeTeam === 'Duke' ? nextGame.awayTeam : nextGame.homeTeam;
                const gameTime = new Date(nextGame.startDate).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                let venueStr = '';
                if (venue) {
                    venueStr = `${venue.name}, ${venue.city}, ${venue.state}`;
                } else if (nextGame.city || nextGame.state) {
                    venueStr = `${nextGame.city || ''}${nextGame.city && nextGame.state ? ', ' : ''}${nextGame.state || ''}`;
                }
                let pregameMsg = `🏈 Next Duke game Reminder! 🏈\nDuke vs ${opponent}\nWhen: ${gameTime}\nWhere: ${venueStr}\n\nDrop your score predictions in the comments! 👇`;
                // Append tagged accounts
                if (TAGGED_ACCOUNTS && TAGGED_ACCOUNTS.length > 0) {
                    pregameMsg += `\n\n${TAGGED_ACCOUNTS.join(' ')}`;
                }
                if (HASHTAGS && HASHTAGS.length > 0) {
                    pregameMsg += `\n${HASHTAGS.join(' ')}`;
                }
                const tweetResult = await tweet(trimTweet(pregameMsg));
                console.log('Tweet result:', tweetResult);
                if (tweetResult !== false && tweetResult !== null && tweetResult !== undefined) {
                    await markTweeted(nextGame.id, pregameKey);
                }
            }
        }

        let game;
        console.log('Checking Duke game...');
        game = await getDukeGame(todayDate);
        if (!game) return console.log('No Duke game today.');

        const venue = await getGameVenue(game);
        const dukeIsHome = game.homeTeam === 'Duke';
        if (venue) {
            if (dukeIsHome) {
                console.log(`Duke vs ${game.awayTeam} at ${venue.name}, ${venue.city}, ${venue.state}`);
            } else {
                console.log(`${game.homeTeam} vs Duke at ${venue.name}, ${venue.city}, ${venue.state}`);
            }
        } else {
            console.log('Venue info not found');
        }

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
            const scorigamiResult = await isScorigami(dukeScore, oppScore);
            if (!(await alreadyTweeted(game.id, scoreKey))) {
                let msg = scorigamiResult.isScorigami
                    ? `👀 In-progress update:\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nIf this holds, it'll be a #DUKEFBSCORIGAMI — a score that's NEVER happened before! 🏈\n\nWill this end up a #SCORIGAMI? Comment your guess!`
                    : `Live update:\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nNot a Scorigami yet.\n\nWill this end up a #DUKEFBSCORIGAMI? Comment your guess!`;
                if (TAGGED_ACCOUNTS && TAGGED_ACCOUNTS.length > 0) {
                    msg += `\n\n${TAGGED_ACCOUNTS.join(' ')}`;
                }
                if (HASHTAGS && HASHTAGS.length > 0) {
                    msg += `\n${HASHTAGS.join(' ')}`;
                }
                const tweetResult = await tweet(trimTweet(msg));
                if (tweetResult !== false && tweetResult !== null && tweetResult !== undefined) {
                    await markTweeted(game.id, scoreKey);
                }
            }
        }

        // Final
        if (game.completed) {
            // Insert the completed game into the database
            const scorigamiResult = await isScorigami(dukeScore, oppScore);
            await insertGame(game, venue, dukeIsHome);
            if (!(await alreadyTweeted(game.id, `${scoreKey}-final`))) {
                let msg;
                if (scorigamiResult.isScorigami) {
                    msg = `🚨 FINAL SCORIGAMI 🚨\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nThis score has NEVER happened before in Duke football history! 🏈\n\nWhat did you think of the game? Drop your reactions below! 👇`;
                } else {
                    // Use games array for last occurrence and count
                    const last = getLastScoreOccurrenceFromGames(scorigamiResult.games);
                    console.log('Last occurrence of this score:', last);
                    const occurrences = scorigamiResult.occurrences;
                    let lastStr = '';
                    if (last) {
                        const lastDate = last.date ? new Date(last.date).toLocaleDateString() : 'unknown date';
                        const teamA = last.teamA?.name || 'Duke';
                        const teamB = last.teamB?.name || 'Opponent';
                        let venueStr = '';
                        // Try to get venue info for the last game
                        let lastVenue = null;
                        try {
                            lastVenue = await getGameVenue(last);
                            console.log('Last venue:', lastVenue);
                        } catch { }
                        if (lastVenue) {
                            venueStr = ` at ${lastVenue.name}, ${lastVenue.city}, ${lastVenue.state}`;
                        } else if (last.city || last.state) {
                            venueStr = ` at ${last.city || ''}${last.city && last.state ? ', ' : ''}${last.state || ''}`;
                        }
                        lastStr = `\nLast time: ${teamA} ${last.teamAScore}-${last.teamBScore} ${teamB} on ${lastDate}${venueStr}`;
                    }
                    msg = `Final: Duke ${dukeScore}-${oppScore} vs ${opponent}\nNot a Scorigami — this result has happened ${occurrences} times in Duke football history.${lastStr}`;
                }
                if (TAGGED_ACCOUNTS && TAGGED_ACCOUNTS.length > 0) {
                    msg += `\n\n${TAGGED_ACCOUNTS.join(' ')}`;
                }
                if (HASHTAGS && HASHTAGS.length > 0) {
                    msg += `\n${HASHTAGS.join(' ')}`;
                }
                console.log(msg)
                const tweetResult = await tweet(trimTweet(msg));
                if (tweetResult !== false && tweetResult !== null && tweetResult !== undefined) {
                    await markTweeted(game.id, `${scoreKey}-final`);
                }
            }
        }
    } catch (err) {
        console.error('Fatal error in run():', err);
    }
}

run();

