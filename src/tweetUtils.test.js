import { trimTweet } from './tweetUtils.js';

test('respects a custom length limit', () => {
  const trimmed = trimTweet('A long message that needs to be shortened for a reserved link.', 30);

  expect(trimmed.length).toBeLessThanOrEqual(30);
  expect(trimmed.endsWith('…')).toBe(true);
});
