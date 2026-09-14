import 'dotenv/config';
import { trimTweet } from './tweetUtils.js';
import { getDukeGame, getDukeGames, getGameVenue, getNextScheduledDukeGame } from './gameApi.js';
import { isScorigami, getLastScoreOccurrenceFromGames } from './scorigami.js';
import { alreadyTweeted, markTweeted, insertGame } from './db.js';
import { tweet } from './twitterClient.js';
import { DEFAULT_BACKFILL_DAYS, getDukeScoreDetails, getRecentCompletedDukeGames, getWinsipediaSeasonUrl } from './gameUtils.js';
import { HASHTAGS } from './tweetConfig.js';

const TEMPLATE_VERSION = 'v2';

function getTweetUrl(tweetId) {
    return `https://x.com/i/web/status/${tweetId}`;
}

function getDatePart(date, timeZone, type) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone,
        [type]: type === 'weekday' ? 'long' : '2-digit',
    }).format(date);
}

function getDateKey(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function getHour(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        hour12: false,
    }).formatToParts(date);
    return Number(parts.find(({ type }) => type === 'hour')?.value);
}

function getReferenceDate() {
    if (!process.env.FAKE_DATE) return new Date();

    const fakeDate = new Date(`${process.env.FAKE_DATE}T12:00:00Z`);
    if (Number.isNaN(fakeDate.getTime())) {
        throw new Error(`Invalid FAKE_DATE: ${process.env.FAKE_DATE}`);
    }
    console.log(`Using FAKE_DATE: ${process.env.FAKE_DATE}`);
    return fakeDate;
}

function getBackfillDays() {
    const requestedDays = Number(process.env.BACKFILL_DAYS);
    return Number.isFinite(requestedDays) && requestedDays >= 0
        ? requestedDays
        : DEFAULT_BACKFILL_DAYS;
}

function appendHashtags(message, separator = '\n') {
    return HASHTAGS.length > 0 ? `${message}${separator}${HASHTAGS.join(' ')}` : message;
}

function appendSeasonLink(message, season) {
    const seasonUrl = getWinsipediaSeasonUrl(season);
    const hashtags = HASHTAGS.length > 0 ? `\n${HASHTAGS.join(' ')}` : '';
    const suffix = `\nSeason details: ${seasonUrl}${hashtags}`;
    return `${trimTweet(message, 280 - suffix.length)}${suffix}`;
}

function formatVenue(venue, game) {
    if (venue) return `${venue.name}, ${venue.city}, ${venue.state}`;
    if (game.city || game.state) {
        return `${game.city || ''}${game.city && game.state ? ', ' : ''}${game.state || ''}`;
    }
    return '';
}

function logGame(game, venue, { dukeIsHome }) {
    if (venue) {
        if (dukeIsHome) {
            console.log(`Duke vs ${game.awayTeam} at ${venue.name}, ${venue.city}, ${venue.state}`);
        } else {
            console.log(`${game.homeTeam} vs Duke at ${venue.name}, ${venue.city}, ${venue.state}`);
        }
    } else {
        console.log('Venue info not found');
    }
}

async function sendPregameReminder(games, now) {
    if (getDatePart(now, 'America/New_York', 'weekday') !== 'Wednesday') return;
    if (getHour(now, 'America/Chicago') !== 12) {
        console.log('It is Wednesday, but not between noon and 1pm CST. Pregame tweet will not be sent.');
        return;
    }

    const nextGame = await getNextScheduledDukeGame(games);
    if (!nextGame || await alreadyTweeted(nextGame.id, 'pregame')) return;

    const venue = await getGameVenue(nextGame);
    const opponent = nextGame.homeTeam === 'Duke' ? nextGame.awayTeam : nextGame.homeTeam;
    const gameTime = new Date(nextGame.startDate).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    const pregameMsg = appendHashtags(
        `🏈 Reminder, Duke's next game is coming up!! 🏈\nDuke vs ${opponent}\nWhen: ${gameTime}\nWhere: ${formatVenue(venue, nextGame)}\n\nDrop your score predictions in the comments! 👇`,
    );

    const tweetId = await tweet(trimTweet(pregameMsg));
    console.log('Tweet result:', tweetId);
    await markTweeted(nextGame.id, 'pregame', {
        tweetId,
        tweetUrl: getTweetUrl(tweetId),
        contentType: 'pregame',
        templateVersion: TEMPLATE_VERSION,
    });
}

async function processLiveGame(game) {
    const { dukeScore, oppScore, opponent, scoreKey } = getDukeScoreDetails(game);
    if (dukeScore == null || oppScore == null) {
        console.log('Game not started yet.');
        return;
    }
    if (await alreadyTweeted(game.id, scoreKey)) return;

    const scorigamiResult = await isScorigami(dukeScore, oppScore, game);
    const message = scorigamiResult.isScorigami
        ? `👀 Live score watch:\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nIf it holds, this would be a new score pair.\n\nWhat do you think?`
        : `Live score update:\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nNot a new score pair yet.`;

    const tweetId = await tweet(trimTweet(appendHashtags(message)));
    await markTweeted(game.id, scoreKey, {
        tweetId,
        tweetUrl: getTweetUrl(tweetId),
        contentType: 'live',
        templateVersion: TEMPLATE_VERSION,
    });
}

async function processCompletedGame(game) {
    const details = getDukeScoreDetails(game);
    const { dukeIsHome, dukeScore, oppScore, opponent, scoreKey } = details;
    if (dukeScore == null || oppScore == null) {
        console.log(`Skipping completed game ${game.id}: score is incomplete.`);
        return;
    }
    if (await alreadyTweeted(game.id, `${scoreKey}-final`)) return;

    const venue = await getGameVenue(game);
    logGame(game, venue, details);
    const scorigamiResult = await isScorigami(dukeScore, oppScore, game);
    await insertGame(game, venue, dukeIsHome);

    let message;
    if (scorigamiResult.isScorigami) {
        message = appendSeasonLink(
            `🚨 DUKE SCORIGAMI 🚨\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nThis final score pair had never occurred in Duke football history.\n\nWhat score will Duke produce next?`,
            game.season,
        );
    } else {
        const last = getLastScoreOccurrenceFromGames(scorigamiResult.games);
        let lastStr = '';
        if (last) {
            const lastDate = last.date ? new Date(last.date).toLocaleDateString() : 'unknown date';
            const lastOpponent = last.teamA?.name === 'Duke'
                ? last.teamB?.name || 'Opponent'
                : last.teamA?.name || 'Opponent';
            let lastVenue = null;
            try {
                lastVenue = await getGameVenue(last);
                console.log('Last venue:', lastVenue);
            } catch (error) {
                console.warn('Unable to load the previous venue:', error.message);
            }
            const venueStr = lastVenue
                ? ` at ${lastVenue.name}, ${lastVenue.city}, ${lastVenue.state}`
                : last.city || last.state
                    ? ` at ${last.city || ''}${last.city && last.state ? ', ' : ''}${last.state || ''}`
                    : '';
            lastStr = `\nPrevious: Duke ${last.teamAScore}-${last.teamBScore} vs ${lastOpponent} on ${lastDate}${venueStr}`;
        }
        const occurrenceLabel = scorigamiResult.occurrences === 1 ? 'time' : 'times';
        message = appendSeasonLink(
            `Duke ${dukeScore}-${oppScore} vs ${opponent}\nNot a new score pair. This score pair has occurred ${scorigamiResult.occurrences} ${occurrenceLabel} in Duke football history.${lastStr}`,
            game.season,
        );
    }

    console.log(message);
    const tweetId = await tweet(trimTweet(message));
    await markTweeted(game.id, `${scoreKey}-final`, {
        tweetId,
        tweetUrl: getTweetUrl(tweetId),
        contentType: scorigamiResult.isScorigami ? 'final_scorigami' : 'final',
        templateVersion: TEMPLATE_VERSION,
    });
}

export async function run() {
    try {
        const now = getReferenceDate();
        const todayDate = getDateKey(now, 'America/New_York');
        const games = await getDukeGames();

        await sendPregameReminder(games, now);

        const backfillDays = getBackfillDays();
        const recentCompletedGames = getRecentCompletedDukeGames(games, now, backfillDays);
        console.log(`Checking ${recentCompletedGames.length} completed game(s) from the last ${backfillDays} day(s).`);
        for (const completedGame of recentCompletedGames) {
            await processCompletedGame(completedGame);
        }

        const game = await getDukeGame(todayDate, games);
        if (!game) return console.log('No Duke game today.');

        const details = getDukeScoreDetails(game);
        const venue = await getGameVenue(game);
        logGame(game, venue, details);

        if (details.dukeScore == null || details.oppScore == null) {
            console.log('Game not started yet.');
            return;
        }

        if (game.completed) {
            await processCompletedGame(game);
        } else {
            await processLiveGame(game);
        }
    } catch (err) {
        console.error('Fatal error in run():', err);
        throw err;
    }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
    run().catch(() => {
        process.exitCode = 1;
    });
}
