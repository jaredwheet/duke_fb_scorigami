import { createScorigamiCard } from './scorigamiCard.js';

test('creates a PNG Scorigami card', async () => {
  const card = await createScorigamiCard({
    dukeScore: 24,
    oppScore: 10,
    opponent: 'Virginia & Tech',
    startDate: '2026-09-05T19:30:00Z',
  });

  expect(card.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(card.length).toBeGreaterThan(1000);
});
