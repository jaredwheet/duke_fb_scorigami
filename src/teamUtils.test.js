import { isDukeTeam } from './teamUtils.js';

test('recognizes canonical Duke team aliases', () => {
  expect(isDukeTeam({ slug: 'duke', name: 'Duke' })).toBe(true);
  expect(isDukeTeam({ slug: 'duke', name: 'Duke Blue Devils' })).toBe(true);
  expect(isDukeTeam({ slug: 'stanford', name: 'Stanford Cardinal' })).toBe(false);
});
