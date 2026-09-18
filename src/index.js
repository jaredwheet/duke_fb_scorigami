import 'dotenv/config';
import { trimTweet } from './tweetUtils.js';
import { getDukeGame, getDukeGames, getGameVenue, getNextScheduledDukeGame } from './gameApi.js';
import { isScorigami, getLastScoreOccurrenceFromGames } from './scorigami.js';
import { claimTweet, finalizeTweet, recordTweetError, insertGame } from './db.js';
import { tweet, tweetWithMedia, uploadImage } from './twitterClient.js';
import { DEFAULT_BACKFILL_DAYS, getDukeScoreDetails, getRecentCompletedDukeGames, getWinsipediaSeasonUrl } from './gameUtils.js';
import { HASHTAGS } from './tweetConfig.js';
import { createScorigamiCard } from './scorigamiCard.js';
import { createWallaceWadeCard } from './wallaceWadeCard.js';

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

    const dateValue = process.env.FAKE_DATE;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        throw new Error(`Invalid FAKE_DATE: ${dateValue}`);
    }
    const utcNoon = new Date(`${dateValue}T12:00:00Z`);
    const parts = dateValue.split('-').map(Number);
    if (utcNoon.getUTCFullYear() !== parts[0]
        || utcNoon.getUTCMonth() + 1 !== parts[1]
        || utcNoon.getUTCDate() !== parts[2]) {
        throw new Error(`Invalid FAKE_DATE: ${dateValue}`);
    }
    const fakeDate = new Date(utcNoon.getTime() + (12 - getHour(utcNoon, 'America/Chicago')) * 60 * 60 * 1000);
    if (Number.isNaN(fakeDate.getTime())) {
        throw new Error(`Invalid FAKE_DATE: ${process.env.FAKE_DATE}`);
    }
    console.log(`Using FAKE_DATE: ${process.env.FAKE_DATE}`);
    return fakeDate;
}

function getBackfillDays() {
    const rawValue = process.env.BACKFILL_DAYS;
    if (rawValue == null || rawValue.trim() === '') return DEFAULT_BACKFILL_DAYS;
    const requestedDays = Number(rawValue);
    return Number.isFinite(requestedDays) && requestedDays >= 0
        ? Math.min(requestedDays, 365)
        : DEFAULT_BACKFILL_DAYS;
}

function getFootballSeason(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: 'numeric',
    }).formatToParts(date);
    const year = Number(parts.find(({ type }) => type === 'year')?.value);
    const month = Number(parts.find(({ type }) => type === 'month')?.value);
    return month <= 2 ? year - 1 : year;
}

function isCompleteScore(value) {
    if (value == null || value === '') return false;
    const numeric = Number(value);
    return Number.isFinite(numeric) && Number.isInteger(numeric) && numeric >= 0;
}

function defaultAdapters() {
    return {
        getGames: getDukeGames,
        getGame: getDukeGame,
        getNextScheduledGame: getNextScheduledDukeGame,
        getGameVenue,
        isScorigami,
        claimTweet,
        finalizeTweet,
        recordTweetError,
        insertGame,
        getRecentCompletedGames: getRecentCompletedDukeGames,
        tweet,
        tweetWithMedia,
        uploadImage,
        createScorigamiCard,
        createWallaceWadeCard,
    };
}

async function publishWithClaim({ gameId, scoreKey, publish, adapters, claim: providedClaim = null }) {
    const claim = providedClaim || await adapters.claimTweet({ gameId, scoreKey });
    if (!claim.claimed) return null;

    try {
        const { tweetId, contentType } = await publish();
        const finalized = await adapters.finalizeTweet({
            gameId,
            scoreKey,
            claimToken: claim.claimToken,
            tweetId,
            tweetUrl: getTweetUrl(tweetId),
            contentType,
            templateVersion: TEMPLATE_VERSION,
        });
        if (!finalized) throw new Error(`Unable to finalize publication claim for ${gameId}:${scoreKey}`);
        return tweetId;
    } catch (error) {
        try {
            await adapters.recordTweetError({ gameId, scoreKey, claimToken: claim.claimToken, error });
        } catch (recordError) {
            console.error('Unable to record publication error:', recordError);
        }
        throw error;
    }
}

function appendHashtags(message, separator = '\n') {
    return HASHTAGS.length > 0 ? `${message}${separator}${HASHTAGS.join(' ')}` : message;
}

function appendSeasonLink(message, season, requiredText = null) {
    const seasonUrl = getWinsipediaSeasonUrl(season);
    const hashtags = HASHTAGS.length > 0 ? `\n${HASHTAGS.join(' ')}` : '';
    const suffix = `\nSeason details: ${seasonUrl}${hashtags}`;
    const available = 280 - suffix.length;
    if (requiredText && requiredText.length > available) {
        return trimTweet(requiredText, 280);
    }
    if (!requiredText || message.length <= available) {
        return `${trimTweet(message, available)}${suffix}`;
    }

    const requiredIndex = message.indexOf(requiredText);
    if (requiredIndex < 0) return `${trimTweet(message, available)}${suffix}`;
    const before = message.slice(0, requiredIndex);
    const after = message.slice(requiredIndex + requiredText.length);
    const remaining = available - requiredText.length;
    const beforeBudget = Math.min(before.length, Math.max(0, Math.floor((remaining - 1) / 2)));
    const afterBudget = Math.max(0, remaining - beforeBudget - (before.length > beforeBudget ? 1 : 0));
    const beforeText = before.length > beforeBudget ? `${before.slice(0, beforeBudget)}…` : before;
    return `${beforeText}${requiredText}${after.slice(0, afterBudget)}${suffix}`;
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

async function sendPregameReminder(games, now, adapters) {
    if (getDatePart(now, 'America/Chicago', 'weekday') !== 'Wednesday') return;
    if (getHour(now, 'America/Chicago') !== 12) {
        console.log('It is Wednesday, but not between noon and 1pm CST. Pregame tweet will not be sent.');
        return;
    }

    const nextGame = await adapters.getNextScheduledGame(games, now);
    if (!nextGame) return;

    const venue = await adapters.getGameVenue(nextGame);
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

    const tweetId = await publishWithClaim({
        gameId: nextGame.id,
        scoreKey: 'pregame',
        adapters,
        publish: async () => ({
            tweetId: await adapters.tweet(trimTweet(pregameMsg)),
            contentType: 'pregame',
        }),
    });
    if (tweetId) console.log('Tweet result:', tweetId);
}

async function processLiveGame(game, adapters) {
    const { dukeScore, oppScore, opponent, scoreKey } = getDukeScoreDetails(game);
    if (!isCompleteScore(dukeScore) || !isCompleteScore(oppScore)) {
        console.log('Game not started yet.');
        return;
    }

    const scorigamiResult = await adapters.isScorigami(dukeScore, oppScore, game);
    const message = scorigamiResult.isScorigami
        ? `👀 Live score watch:\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nIf it holds, this would be a new score pair.\n\nWhat do you think?`
        : `Live score update:\nDuke ${dukeScore}-${oppScore} vs ${opponent}\nNot a new score pair yet.`;

    await publishWithClaim({
        gameId: game.id,
        scoreKey,
        adapters,
        publish: async () => ({
            tweetId: await adapters.tweet(trimTweet(appendHashtags(message))),
            contentType: 'live',
        }),
    });
}

async function processCompletedGame(game, adapters) {
    const details = getDukeScoreDetails(game);
    const { dukeIsHome, dukeScore, oppScore, opponent, scoreKey } = details;
    if (!isCompleteScore(dukeScore) || !isCompleteScore(oppScore)) {
        console.log(`Skipping completed game ${game.id}: score is incomplete.`);
        return;
    }

    const finalKey = `${scoreKey}-final`;
    const claim = await adapters.claimTweet({ gameId: game.id, scoreKey: finalKey });
    if (!claim.claimed) return;

    await publishWithClaim({
        gameId: game.id,
        scoreKey: finalKey,
        claim,
        adapters,
        publish: async () => {
            const venue = await adapters.getGameVenue(game);
            logGame(game, venue, details);
            const scorigamiResult = await adapters.isScorigami(dukeScore, oppScore, game);
            await adapters.insertGame(game, venue, dukeIsHome);

            let message;
            if (scorigamiResult.isScorigami) {
                const scoreLine = `Duke ${dukeScore}-${oppScore} vs ${opponent}`;
                message = appendSeasonLink(
                    `🚨 DUKE SCORIGAMI 🚨\n${scoreLine}\nThis final score pair had never occurred in Duke football history.\n\nWhat score will Duke produce next?`,
                    game.season,
                    scoreLine,
                );
            } else {
                const last = getLastScoreOccurrenceFromGames(scorigamiResult.games);
                let lastStr = '';
                if (last) {
                    const lastDate = last.date
                        ? new Date(last.date).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
                        : 'unknown date';
                    const lastOpponent = last.teamA?.name === 'Duke'
                        ? last.teamB?.name || 'Opponent'
                        : last.teamA?.name || 'Opponent';
                    let lastVenue = null;
                    try {
                        lastVenue = await adapters.getGameVenue(last);
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
                const scoreLine = `Duke ${dukeScore}-${oppScore} vs ${opponent}`;
                message = appendSeasonLink(
                    `${scoreLine}\nNot a new score pair. This score pair has occurred ${scorigamiResult.occurrences} ${occurrenceLabel} in Duke football history.${lastStr}`,
                    game.season,
                    scoreLine,
                );
            }

            console.log(message);
            let mediaId = null;
            if (scorigamiResult.isScorigami) {
                try {
                    const card = await adapters.createWallaceWadeCard({ dukeScore, oppScore, opponent, startDate: game.startDate });
                    mediaId = await adapters.uploadImage(card);
                    if (!mediaId) throw new Error('Wallace Wade upload returned no media ID');
                } catch (error) {
                    console.warn('Wallace Wade card failed; using the deterministic fallback:', error.message);
                    try {
                        const fallbackCard = await adapters.createScorigamiCard({ dukeScore, oppScore, opponent, startDate: game.startDate });
                        mediaId = await adapters.uploadImage(fallbackCard);
                        if (!mediaId) throw new Error('Deterministic card upload returned no media ID');
                    } catch (fallbackError) {
                        console.warn('Scorigami card upload failed; posting text-only:', fallbackError.message);
                    }
                }
            }

            if (mediaId) {
                return { tweetId: await adapters.tweetWithMedia(trimTweet(message), mediaId), contentType: 'final_scorigami_card' };
            }
            return {
                tweetId: await adapters.tweet(trimTweet(message)),
                contentType: scorigamiResult.isScorigami ? 'final_scorigami' : 'final',
            };
        },
    });
}

export async function run({ now = getReferenceDate(), games: suppliedGames = null, adapters: providedAdapters = {} } = {}) {
    try {
        const adapters = { ...defaultAdapters(), ...providedAdapters };
        const season = getFootballSeason(now);
        const todayDate = getDateKey(now, 'America/Chicago');
        const games = suppliedGames || await adapters.getGames(season);

        await sendPregameReminder(games, now, adapters);

        const backfillDays = getBackfillDays();
        const recentCompletedGames = adapters.getRecentCompletedGames(games, now, backfillDays);
        console.log(`Checking ${recentCompletedGames.length} completed game(s) from the last ${backfillDays} day(s).`);
        for (const completedGame of recentCompletedGames) {
            await processCompletedGame(completedGame, adapters);
        }

        const game = await adapters.getGame(todayDate, games);
        if (!game) return console.log('No Duke game today.');

        const details = getDukeScoreDetails(game);
        if (!isCompleteScore(details.dukeScore) || !isCompleteScore(details.oppScore)) {
            console.log('Game not started yet.');
            return;
        }

        if (game.completed) {
            await processCompletedGame(game, adapters);
        } else {
            const venue = await adapters.getGameVenue(game);
            logGame(game, venue, details);
            await processLiveGame(game, adapters);
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
