import { loadMediaGuide } from '../mediaGuide/loadGuide.js';
import { calculateGameNarrativeFacts } from './gameNarrativeFacts.js';

test('combines guide-backed record and play-by-play comeback facts', () => {
  const facts = calculateGameNarrativeFacts({
    guide: loadMediaGuide(),
    game: {
      season: 2026,
      participants: [
        { team: { slug: 'duke', name: 'Duke' }, score: 31 },
        { team: { slug: 'north-carolina', name: 'North Carolina' }, score: 27 },
      ],
    },
    detailsPayload: {
      playerStats: [{ teams: [{
        team: 'Duke',
        categories: [{
          name: 'passing',
          types: [{ name: 'YDS', athletes: [{ name: 'Duke QB', stat: '500' }] }],
        }],
      }] }],
      plays: [
        { playNumber: 1, period: 2, offense: 'North Carolina', defense: 'Duke', offenseScore: 14, defenseScore: 0, clock: { minutes: 4, seconds: 0 } },
        { playNumber: 2, period: 4, offense: 'Duke', defense: 'North Carolina', offenseScore: 31, defenseScore: 27, clock: { minutes: 0, seconds: 0 } },
      ],
    },
  });

  expect(facts.historic).toMatchObject({ isRecord: true, recordWatch: { status: 'record' } });
  expect(facts.narrative).toMatchObject({ comeback: true, largestDeficit: 14, confidence: 'verified' });
  expect(facts.narrative).toMatchObject({ lateGameWin: true, period: 4, time: '00:00' });
  expect(facts.statisticalHooks[0].key).toBe('record_watch_single-game-passing-yards');
});

test('does not invent a comeback without a verified scoring progression', () => {
  const facts = calculateGameNarrativeFacts({
    guide: loadMediaGuide(),
    game: {
      season: 2026,
      participants: [
        { team: { slug: 'duke', name: 'Duke' }, score: 21 },
        { team: { slug: 'Virginia', name: 'Virginia' }, score: 17 },
      ],
    },
  });

  expect(facts.narrative).toEqual({});
});
