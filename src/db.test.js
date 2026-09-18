import { jest } from '@jest/globals';

const rpc = jest.fn();
jest.unstable_mockModule('./supabaseClient.js', () => ({ default: { rpc } }));

const { claimTweet, finalizeTweet, recordTweetError } = await import('./db.js');

beforeEach(() => {
  rpc.mockReset();
});

test('claimTweet generates a token and returns the winning claim', async () => {
  rpc.mockResolvedValue({ data: [{ claimed: true, claim_token: 'ignored', status: 'claimed' }], error: null });

  const result = await claimTweet({ gameId: 42, scoreKey: '24-10' });

  expect(result).toMatchObject({ claimed: true, status: 'claimed' });
  expect(result.claimToken).toEqual(expect.any(String));
  expect(result.claimToken.length).toBeGreaterThan(10);
  expect(rpc).toHaveBeenCalledWith('claim_tweeted_score', expect.objectContaining({
    p_game_id: 42,
    p_score_key: '24-10',
    p_claim_token: result.claimToken,
  }));
});

test('claimTweet returns a safe no-op on a competing identity', async () => {
  rpc.mockResolvedValue({ data: [{ claimed: false, claim_token: null, status: 'posted' }], error: null });

  await expect(claimTweet({ gameId: 42, scoreKey: '24-10', claimToken: 'claim-a' })).resolves.toEqual({
    claimed: false,
    claimToken: null,
    status: 'posted',
  });
});

test('finalizeTweet and recordTweetError pass the claim token to owned RPCs', async () => {
  rpc
    .mockResolvedValueOnce({ data: true, error: null })
    .mockResolvedValueOnce({ data: true, error: null });

  await expect(finalizeTweet({ gameId: 42, scoreKey: '24-10', claimToken: 'claim-a',
    tweetId: 'tweet-1',
    tweetUrl: 'https://x.com/i/web/status/tweet-1',
    contentType: 'live',
    templateVersion: 'v2',
  })).resolves.toBe(true);
  await expect(recordTweetError({ gameId: 42, scoreKey: '24-10', claimToken: 'claim-a', error: new Error('provider timeout') })).resolves.toBe(true);

  expect(rpc).toHaveBeenNthCalledWith(1, 'finalize_tweeted_score', {
    p_game_id: 42,
    p_score_key: '24-10',
    p_claim_token: 'claim-a',
    p_tweet_id: 'tweet-1',
    p_tweet_url: 'https://x.com/i/web/status/tweet-1',
    p_content_type: 'live',
    p_template_version: 'v2',
  });
  expect(rpc).toHaveBeenNthCalledWith(2, 'record_tweeted_score_error', {
    p_game_id: 42,
    p_score_key: '24-10',
    p_claim_token: 'claim-a',
    p_error: 'provider timeout',
  });
});

test('finalizeTweet propagates an RPC error', async () => {
  const error = new Error('claim owner mismatch');
  rpc.mockResolvedValue({ data: false, error });

  await expect(finalizeTweet({ gameId: 42, scoreKey: '24-10', claimToken: 'wrong-token' })).rejects.toBe(error);
});
