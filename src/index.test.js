import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';

const mockTweet = jest.fn();
const mockTweetWithMedia = jest.fn();
const mockUploadImage = jest.fn();
const mockIsScorigami = jest.fn();
const mockInsertGame = jest.fn();
const mockCreateScorigamiCard = jest.fn();
const mockCreateWallaceWadeCard = jest.fn();

jest.unstable_mockModule('./twitterClient.js', () => ({
  tweet: mockTweet,
  tweetWithMedia: mockTweetWithMedia,
  uploadImage: mockUploadImage,
}));
jest.unstable_mockModule('./scorigami.js', () => ({
  isScorigami: mockIsScorigami,
  getLastScoreOccurrenceFromGames: (games) => games?.[0] || null,
}));
jest.unstable_mockModule('./db.js', () => ({
  claimTweet: jest.fn(),
  finalizeTweet: jest.fn(),
  recordTweetError: jest.fn(),
  insertGame: mockInsertGame,
}));
jest.unstable_mockModule('./gameApi.js', () => ({
  getDukeGames: jest.fn(),
  getDukeGame: jest.fn(),
  getGameVenue: jest.fn(),
  getNextScheduledDukeGame: jest.fn(),
}));
jest.unstable_mockModule('./scorigamiCard.js', () => ({ createScorigamiCard: mockCreateScorigamiCard }));
jest.unstable_mockModule('./wallaceWadeCard.js', () => ({ createWallaceWadeCard: mockCreateWallaceWadeCard }));
jest.unstable_mockModule('./tweetConfig.js', () => ({ HASHTAGS: ['#DukeFootball', '#DUKEFBSCORIGAMI'] }));

const { run } = await import('./index.js');

function makeGame({ id = 1, completed = false, homePoints = 24, awayPoints = 10 } = {}) {
  return {
    id,
    season: 2026,
    week: 2,
    startDate: '2026-09-05T19:30:00Z',
    completed,
    homeTeam: 'Duke',
    homeId: 150,
    homePoints,
    awayTeam: 'Virginia',
    awayId: 258,
    awayPoints,
    venueId: 1,
    city: 'Durham',
    state: 'NC',
  };
}

function createAdapters({ games = [], nextGame = null, scorigami = { isScorigami: false, occurrences: 1, games: [] }, failPublish = false, failFinalize = false } = {}) {
  const state = new Map();
  const calls = { tweet: [], tweetWithMedia: [], uploadImage: [], wallaceCards: [], scorigamiCards: [], claim: [], finalize: [], errors: [], venues: 0 };
  let tokenCounter = 0;
  const adapters = {
    state,
    calls,
    getGames: async () => games,
    getGame: async (_date, availableGames) => availableGames.find((game) => game.id === games[0]?.id) || null,
    getNextScheduledGame: async () => nextGame,
    getGameVenue: async () => {
      calls.venues += 1;
      return { name: 'Wallace Wade Stadium', city: 'Durham', state: 'NC' };
    },
    getRecentCompletedGames: () => [],
    isScorigami: async () => scorigami,
    insertGame: mockInsertGame,
    claimTweet: async ({ gameId, scoreKey }) => {
      calls.claim.push({ gameId, scoreKey });
      const key = `${gameId}:${scoreKey}`;
      if (state.has(key)) return { claimed: false, claimToken: null, status: state.get(key).status };
      const claimToken = `claim-${++tokenCounter}`;
      state.set(key, { status: 'claimed', claimToken });
      return { claimed: true, claimToken, status: 'claimed' };
    },
    finalizeTweet: async ({ gameId, scoreKey, claimToken, ...metadata }) => {
      calls.finalize.push({ gameId, scoreKey, claimToken, metadata });
      if (failFinalize) throw new Error('finalize failed');
      const row = state.get(`${gameId}:${scoreKey}`);
      if (!row || row.claimToken !== claimToken) return false;
      state.set(`${gameId}:${scoreKey}`, { ...row, status: 'posted', ...metadata });
      return true;
    },
    recordTweetError: async ({ gameId, scoreKey, claimToken, error }) => {
      calls.errors.push({ gameId, scoreKey, claimToken, error: error.message });
      const row = state.get(`${gameId}:${scoreKey}`);
      if (row?.claimToken === claimToken) state.set(`${gameId}:${scoreKey}`, { ...row, status: 'uncertain', error: error.message });
      return true;
    },
    tweet: async (text) => {
      calls.tweet.push(text);
      if (failPublish) throw new Error('provider timeout');
      return `tweet-${calls.tweet.length}`;
    },
    tweetWithMedia: async (text, mediaId) => {
      calls.tweetWithMedia.push({ text, mediaId });
      return `media-tweet-${calls.tweetWithMedia.length}`;
    },
    uploadImage: async (image) => {
      calls.uploadImage.push(image);
      return 'media-1';
    },
    createWallaceWadeCard: async (input) => {
      calls.wallaceCards.push(input);
      return Buffer.from('wallace');
    },
    createScorigamiCard: async (input) => {
      calls.scorigamiCards.push(input);
      return Buffer.from('fallback');
    },
  };
  return adapters;
}

beforeEach(() => {
  mockTweet.mockReset();
  mockTweetWithMedia.mockReset();
  mockUploadImage.mockReset();
  mockIsScorigami.mockReset();
  mockInsertGame.mockReset();
  mockCreateScorigamiCard.mockReset();
  mockCreateWallaceWadeCard.mockReset();
  delete process.env.BACKFILL_DAYS;
  delete process.env.FAKE_DATE;
});

test('pregame identity posts at most once across repeated runs', async () => {
  const nextGame = makeGame({ id: 101 });
  const adapters = createAdapters({ nextGame });
  const now = new Date('2026-09-16T17:00:00Z');

  await run({ now, adapters });
  await run({ now, adapters });

  expect(adapters.calls.tweet).toHaveLength(1);
  expect(adapters.state.get('101:pregame')).toMatchObject({
    status: 'posted',
    tweetId: 'tweet-1',
    tweetUrl: 'https://x.com/i/web/status/tweet-1',
    contentType: 'pregame',
    templateVersion: 'v2',
  });
});

test('pregame identity no-ops outside the controlled Chicago window', async () => {
  const adapters = createAdapters({ nextGame: makeGame({ id: 101 }) });

  await run({ now: new Date('2026-09-17T17:00:00Z'), games: [], adapters });
  await run({ now: new Date('2026-09-16T16:59:00Z'), games: [], adapters });
  await run({ now: new Date('2026-09-16T18:00:00Z'), games: [], adapters });

  expect(adapters.calls.tweet).toHaveLength(0);
  expect(adapters.calls.claim).toHaveLength(0);
});

test('backfill input clamps values and defaults invalid values', async () => {
  const adapters = createAdapters();
  const recentCalls = [];
  adapters.getRecentCompletedGames = jest.fn((_games, _now, days) => {
    recentCalls.push(days);
    return [];
  });

  for (const value of ['1000', '-1', '', 'abc', 'Infinity']) {
    process.env.BACKFILL_DAYS = value;
    await run({ now: new Date('2026-09-16T17:00:00Z'), games: [], adapters });
  }

  expect(recentCalls).toEqual([365, 30, 30, 30, 30]);
});

test('Invalid FAKE_DATE fails before any adapter call', async () => {
  const adapters = createAdapters();
  adapters.getGames = jest.fn();
  process.env.FAKE_DATE = '2026-02-30';

  await expect(run({ games: [], adapters })).rejects.toThrow('Invalid FAKE_DATE: 2026-02-30');
  expect(adapters.getGames).not.toHaveBeenCalled();
  expect(adapters.calls.venues).toBe(0);
  expect(adapters.calls.claim).toHaveLength(0);
  expect(adapters.calls.tweet).toHaveLength(0);
});

test('backfill uses prior fall season for January and passes the controlled instant', async () => {
  const adapters = createAdapters();
  adapters.getGames = jest.fn().mockResolvedValue([]);
  adapters.getNextScheduledGame = jest.fn().mockResolvedValue(null);
  const now = new Date('2027-01-13T18:00:00Z');

  await run({ now, adapters });

  expect(adapters.getGames).toHaveBeenCalledWith(2026);
  expect(adapters.getNextScheduledGame).toHaveBeenCalledWith([], now);
});

test('backfill workflow contract exposes deterministic manual inputs', () => {
  const workflow = readFileSync(new URL('../.github/workflows/scorigami-schedule.yml', import.meta.url), 'utf8');

  expect(workflow).toContain('fake_date:');
  expect(workflow).toContain('backfill_days:');
  expect(workflow).toContain("FAKE_DATE: ${{ inputs.fake_date || '' }}");
  expect(workflow).toContain("BACKFILL_DAYS: ${{ inputs.backfill_days || '30' }}");
});

test('tweet metadata live publishes exact text and provider metadata', async () => {
  const game = makeGame({ id: 202 });
  const adapters = createAdapters({ games: [game] });

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

  expect(adapters.calls.tweet[0]).toBe('Live score update:\nDuke 24-10 vs Virginia\nNot a new score pair yet.\n#DukeFootball #DUKEFBSCORIGAMI');
  expect(adapters.state.get('202:24-10')).toMatchObject({
    status: 'posted',
    tweetId: 'tweet-1',
    contentType: 'live',
    templateVersion: 'v2',
  });
});

test('tweet metadata live Scorigami uses the verified live payload variant', async () => {
  const game = makeGame({ id: 209 });
  const adapters = createAdapters({ games: [game], scorigami: { isScorigami: true, occurrences: 0, games: [] } });

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

  expect(adapters.calls.tweet[0]).toBe('👀 Live score watch:\nDuke 24-10 vs Virginia\nIf it holds, this would be a new score pair.\n\nWhat do you think?\n#DukeFootball #DUKEFBSCORIGAMI');
  expect(adapters.state.get('209:24-10')).toMatchObject({ contentType: 'live', status: 'posted' });
});

test('preferred media success final Scorigami uses media fallback metadata', async () => {
  const game = makeGame({ id: 203, completed: true });
  const adapters = createAdapters({
    games: [game],
    scorigami: { isScorigami: true, occurrences: 0, games: [] },
  });

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

  expect(adapters.calls.tweetWithMedia).toHaveLength(1);
  expect(adapters.calls.wallaceCards).toHaveLength(1);
  expect(adapters.calls.tweetWithMedia[0].text).toBe('🚨 DUKE SCORIGAMI 🚨\nDuke 24-10 vs Virginia\nThis final score pair had never occurred in Duke football history.\n\nWhat score will Duke produce next?\nSeason details: https://www.winsipedia.com/duke/schedule/2026\n#DukeFootball #DUKEFBSCORIGAMI');
  expect(adapters.state.get('203:24-10-final')).toMatchObject({
    status: 'posted',
    tweetId: 'media-tweet-1',
    tweetUrl: 'https://x.com/i/web/status/media-tweet-1',
    contentType: 'final_scorigami_card',
    templateVersion: 'v2',
  });
});

test('deterministic media fallback follows preferred media failure', async () => {
  const game = makeGame({ id: 216, completed: true });
  const adapters = createAdapters({ games: [game], scorigami: { isScorigami: true, occurrences: 0, games: [] } });
  adapters.createWallaceWadeCard = async () => { throw new Error('wallace failed'); };

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

  expect(adapters.calls.tweetWithMedia).toHaveLength(1);
  expect(adapters.calls.scorigamiCards).toHaveLength(1);
  expect(adapters.calls.uploadImage).toHaveLength(1);
  expect(adapters.calls.tweet).toHaveLength(0);
  expect(adapters.state.get('216:24-10-final')).toMatchObject({ contentType: 'final_scorigami_card', status: 'posted' });
});

test('deterministic media fallback follows preferred upload failure', async () => {
  const game = makeGame({ id: 218, completed: true });
  const adapters = createAdapters({ games: [game], scorigami: { isScorigami: true, occurrences: 0, games: [] } });
  let uploads = 0;
  adapters.uploadImage = async (image) => {
    adapters.calls.uploadImage.push(image);
    uploads += 1;
    if (uploads === 1) throw new Error('preferred upload failed');
    return 'fallback-media-1';
  };

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

  expect(adapters.calls.scorigamiCards).toHaveLength(1);
  expect(adapters.calls.uploadImage).toHaveLength(2);
  expect(adapters.calls.tweetWithMedia).toHaveLength(1);
});

test('duplicate identity no-ops without a second publisher call', async () => {
  const game = makeGame({ id: 204 });
  const adapters = createAdapters({ games: [game] });

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });
  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

  expect(adapters.calls.tweet).toHaveLength(1);
  expect(adapters.calls.claim).toHaveLength(2);
});

test('tweet metadata ordinary final preserves occurrence context', async () => {
  const game = makeGame({ id: 210, completed: true });
  const adapters = createAdapters({
    games: [game],
    scorigami: {
      isScorigami: false,
      occurrences: 1,
      games: [{
        date: '2025-09-05T19:30:00Z',
        teamA: { name: 'Duke' },
        teamB: { name: 'Virginia' },
        teamAScore: 24,
        teamBScore: 10,
        city: 'Durham',
        state: 'NC',
      }],
    },
  });

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

  expect(adapters.calls.tweet[0]).toBe('Duke 24-10 vs Virginia\nNot a new score pair. This score pair has occurred 1 time in Duke football history.\nPrevious: Duke 24-10 vs Virginia on 9/5/2025 at Wallace Wade Stadium, Durham, NC\nSeason details: https://www.winsipedia.com/duke/schedule/2026\n#DukeFootball #DUKEFBSCORIGAMI');
  expect(adapters.state.get('210:24-10-final')).toMatchObject({
    contentType: 'final',
    status: 'posted',
    tweetId: 'tweet-1',
    tweetUrl: 'https://x.com/i/web/status/tweet-1',
    templateVersion: 'v2',
  });
  expect(adapters.calls.wallaceCards).toHaveLength(0);
  expect(adapters.calls.scorigamiCards).toHaveLength(0);
  expect(adapters.calls.uploadImage).toHaveLength(0);
});

test('text-only media floor publishes when both media paths fail', async () => {
  const game = makeGame({ id: 211, completed: true });
  const adapters = createAdapters({ games: [game], scorigami: { isScorigami: true, occurrences: 0, games: [] } });
  adapters.createWallaceWadeCard = async () => { throw new Error('wallace failed'); };
  adapters.createScorigamiCard = async () => { throw new Error('card failed'); };

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

  expect(adapters.calls.tweet[0]).toBe('🚨 DUKE SCORIGAMI 🚨\nDuke 24-10 vs Virginia\nThis final score pair had never occurred in Duke football history.\n\nWhat score will Duke produce next?\nSeason details: https://www.winsipedia.com/duke/schedule/2026\n#DukeFootball #DUKEFBSCORIGAMI');
  expect(adapters.state.get('211:24-10-final')).toMatchObject({
    contentType: 'final_scorigami',
    status: 'posted',
    tweetId: 'tweet-1',
    tweetUrl: 'https://x.com/i/web/status/tweet-1',
    templateVersion: 'v2',
  });
});

test('text-only media floor follows deterministic upload failure', async () => {
  const game = makeGame({ id: 219, completed: true });
  const adapters = createAdapters({ games: [game], scorigami: { isScorigami: true, occurrences: 0, games: [] } });
  adapters.uploadImage = async (image) => {
    adapters.calls.uploadImage.push(image);
    throw new Error('media upload failed');
  };

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

  expect(adapters.calls.uploadImage).toHaveLength(2);
  expect(adapters.calls.tweet).toHaveLength(1);
  expect(adapters.state.get('219:24-10-final')).toMatchObject({ contentType: 'final_scorigami', status: 'posted' });
});

test('finalize failure leaves a non-retryable uncertain claim', async () => {
  const game = makeGame({ id: 212, completed: true });
  const adapters = createAdapters({ games: [game], scorigami: { isScorigami: true, occurrences: 0, games: [] }, failFinalize: true });

  await expect(run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters })).rejects.toThrow('finalize failed');
  await expect(run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters })).resolves.toBeUndefined();
  expect(adapters.calls.tweetWithMedia).toHaveLength(1);
  expect(adapters.state.get('212:24-10-final')).toMatchObject({ status: 'uncertain' });
});

test('media publisher failure leaves an uncertain claim without reposting', async () => {
  const game = makeGame({ id: 217, completed: true });
  const adapters = createAdapters({ games: [game], scorigami: { isScorigami: true, occurrences: 0, games: [] } });
  adapters.tweetWithMedia = async (text, mediaId) => {
    adapters.calls.tweetWithMedia.push({ text, mediaId });
    throw new Error('media publisher failed');
  };

  await expect(run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters })).rejects.toThrow('media publisher failed');
  await expect(run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters })).resolves.toBeUndefined();
  expect(adapters.calls.tweetWithMedia).toHaveLength(1);
  expect(adapters.state.get('217:24-10-final')).toMatchObject({ status: 'uncertain' });
});

test('incomplete score rejects all publication boundaries', async () => {
  for (const value of [null, Number.NaN, -1, 10.5]) {
    const game = makeGame({ id: String(value), homePoints: value });
    const adapters = createAdapters({ games: [game] });

    await run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters });

    expect(adapters.calls.venues).toBe(0);
    expect(adapters.calls.claim).toHaveLength(0);
    expect(adapters.calls.tweet).toHaveLength(0);
  }
});

test('provider failure records uncertainty and blocks blind retry', async () => {
  const game = makeGame({ id: 205 });
  const adapters = createAdapters({ games: [game], failPublish: true });

  await expect(run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters })).rejects.toThrow('provider timeout');
  await expect(run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters })).resolves.toBeUndefined();

  expect(adapters.calls.tweet).toHaveLength(1);
  expect(adapters.state.get('205:24-10')).toMatchObject({ status: 'uncertain' });
});

test('concurrent runs produce one publisher call', async () => {
  const game = makeGame({ id: 206 });
  const adapters = createAdapters({ games: [game] });

  await Promise.all([
    run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters }),
    run({ now: new Date('2026-09-05T20:00:00Z'), games: [game], adapters }),
  ]);

  expect(adapters.calls.tweet).toHaveLength(1);
});

test('same score pair across different games claims twice', async () => {
  const first = makeGame({ id: 207 });
  const second = makeGame({ id: 208 });
  const adapters = createAdapters({ games: [first] });

  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [first], adapters });
  adapters.getGame = async () => second;
  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [second], adapters });

  expect(adapters.calls.tweet).toHaveLength(2);
  expect(adapters.state.has('207:24-10')).toBe(true);
  expect(adapters.state.has('208:24-10')).toBe(true);
});

test('outbound branches trim long text to 280 characters', async () => {
  const longOpponent = 'Virginia '.repeat(10).trim();
  const nextGame = { ...makeGame({ id: 213 }), awayTeam: longOpponent };
  const pregameAdapters = createAdapters({ nextGame });
  await run({ now: new Date('2026-09-16T17:00:00Z'), games: [], adapters: pregameAdapters });
  expect(pregameAdapters.calls.tweet[0].length).toBeLessThanOrEqual(280);

  const liveGame = { ...makeGame({ id: 214 }), awayTeam: longOpponent };
  const liveAdapters = createAdapters({ games: [liveGame] });
  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [liveGame], adapters: liveAdapters });
  expect(liveAdapters.calls.tweet[0].length).toBeLessThanOrEqual(280);

  const finalGame = { ...makeGame({ id: 215, completed: true }), awayTeam: longOpponent };
  const finalAdapters = createAdapters({ games: [finalGame], scorigami: { isScorigami: true, occurrences: 0, games: [] } });
  finalAdapters.createWallaceWadeCard = async () => { throw new Error('wallace failed'); };
  finalAdapters.createScorigamiCard = async () => { throw new Error('card failed'); };
  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [finalGame], adapters: finalAdapters });
  expect(finalAdapters.calls.tweet[0].length).toBeLessThanOrEqual(280);
  expect(finalAdapters.calls.tweet[0]).toContain('Duke 24-10');
  expect(finalAdapters.calls.tweet[0]).toContain(longOpponent);

  const boundaryOpponent = 'Virginia '.repeat(22).trim();
  const boundaryGame = { ...makeGame({ id: 218, completed: true }), awayTeam: boundaryOpponent };
  const boundaryAdapters = createAdapters({ games: [boundaryGame], scorigami: { isScorigami: true, occurrences: 0, games: [] } });
  boundaryAdapters.createWallaceWadeCard = async () => { throw new Error('wallace failed'); };
  boundaryAdapters.createScorigamiCard = async () => { throw new Error('card failed'); };
  await run({ now: new Date('2026-09-05T20:00:00Z'), games: [boundaryGame], adapters: boundaryAdapters });
  expect(boundaryAdapters.calls.tweet[0].length).toBeLessThanOrEqual(280);
  expect(boundaryAdapters.calls.tweet[0]).toContain(boundaryOpponent);
});
