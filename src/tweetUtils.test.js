import { trimTweet } from './tweetUtils.js';

test('respects a custom length limit', () => {
  const trimmed = trimTweet('A long message that needs to be shortened for a reserved link.', 30);

  expect(trimmed.length).toBeLessThanOrEqual(30);
  expect(trimmed.endsWith('…')).toBe(true);
});

test('preserves 280 characters and trims 281 characters', () => {
  const exact = 'x'.repeat(280);
  const over = `${'x'.repeat(280)}y`;

  expect(trimTweet(exact)).toBe(exact);
  expect(trimTweet(over)).toHaveLength(280);
  expect(trimTweet(over).endsWith('…')).toBe(true);
});
