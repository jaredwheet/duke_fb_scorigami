import { calculateDukeScoreFacts, canonicalScorePair } from './scoreFacts.js';

test('canonicalizes score pairs regardless of team order', () => {
  expect(canonicalScorePair(17, 3)).toBe('3-17');
  expect(canonicalScorePair(3, 17)).toBe('3-17');
});

test('detects the first occurrence and previous occurrence', () => {
  const results = calculateDukeScoreFacts([
    {
      id: 1,
      canonicalKey: 'old',
      status: 'final',
      startAt: '1981-09-19T00:00:00Z',
      participants: [
        { team: { slug: 'duke', name: 'Duke' }, score: 3 },
        { team: { slug: 'south-carolina', name: 'South Carolina' }, score: 17 },
      ],
    },
    {
      id: 2,
      canonicalKey: 'new',
      status: 'final',
      startAt: '2026-09-05T00:00:00Z',
      participants: [
        { team: { slug: 'duke', name: 'Duke' }, score: 17 },
        { team: { slug: 'tulane', name: 'Tulane' }, score: 3 },
      ],
    },
  ]);

  expect(results[0].facts.scorigami.isNew).toBe(true);
  expect(results[1].facts.scorigami).toMatchObject({
    isNew: false,
    scorePair: '3-17',
    occurrenceCount: 1,
    previousOccurrence: { gameId: 1, opponent: 'South Carolina' },
  });
});
