import { getDuePublications, isPublicationDue, publicationDateKey, PUBLICATIONS } from './cadence.js';

test('uses Eastern publication windows', () => {
  const wednesdayNoon = new Date('2026-09-16T16:00:00Z');
  expect(isPublicationDue(PUBLICATIONS.watercooler, wednesdayNoon)).toBe(true);
  expect(isPublicationDue(PUBLICATIONS.bulletin, wednesdayNoon)).toBe(false);
  expect(publicationDateKey(wednesdayNoon)).toBe('2026-09-16');
});

test('identifies the Friday bulletin and Sunday newspaper windows', () => {
  expect(getDuePublications(new Date('2026-09-18T13:00:00Z')).map(({ edition }) => edition)).toEqual(['bulletin']);
  expect(getDuePublications(new Date('2026-09-20T11:00:00Z')).map(({ edition }) => edition)).toEqual(['sunday']);
});

test('does not release an edition before its morning window', () => {
  expect(getDuePublications(new Date('2026-09-20T10:59:00Z'))).toEqual([]);
});
