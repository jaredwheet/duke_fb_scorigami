import { jest } from '@jest/globals';
import { getDuePublications, isPublicationDue, publicationDateKey, PUBLICATIONS } from './cadence.js';

test('uses Eastern publication windows', () => {
  const wednesdayNoon = new Date('2026-09-16T16:00:00Z');
  expect(isPublicationDue(PUBLICATIONS.watercooler, wednesdayNoon)).toBe(true);
  expect(isPublicationDue(PUBLICATIONS.bulletin, wednesdayNoon)).toBe(false);
  expect(publicationDateKey(wednesdayNoon)).toBe('2026-09-16');
});

test('cadence Sunday window selects Devil in the Details', () => {
  expect(getDuePublications(new Date('2026-09-20T11:00:00Z')).map(({ edition }) => edition))
    .toEqual(['sunday']);
});

test('cadence Wednesday Friday selects matching editions', () => {
  expect(getDuePublications(new Date('2026-09-16T16:00:00Z')).map(({ edition }) => edition))
    .toEqual(['watercooler']);
  expect(getDuePublications(new Date('2026-09-18T13:00:00Z')).map(({ edition }) => edition))
    .toEqual(['bulletin']);
});

test('identifies the Friday bulletin and Sunday newspaper windows', () => {
  expect(getDuePublications(new Date('2026-09-18T13:00:00Z')).map(({ edition }) => edition)).toEqual(['bulletin']);
  expect(getDuePublications(new Date('2026-09-20T11:00:00Z')).map(({ edition }) => edition)).toEqual(['sunday']);
});

test('cadence no due returns nothing before any morning window', () => {
  expect(getDuePublications(new Date('2026-09-20T10:59:00Z'))).toEqual([]);
});

test('cadence DST Sunday boundaries use both offset transitions', () => {
  expect(isPublicationDue(PUBLICATIONS.sunday, new Date('2026-03-08T10:59:00Z'))).toBe(false);
  expect(isPublicationDue(PUBLICATIONS.sunday, new Date('2026-03-08T11:00:00Z'))).toBe(true);
  expect(isPublicationDue(PUBLICATIONS.sunday, new Date('2026-11-01T11:59:00Z'))).toBe(false);
  expect(isPublicationDue(PUBLICATIONS.sunday, new Date('2026-11-01T12:00:00Z'))).toBe(true);
  expect(publicationDateKey(new Date('2026-11-01T12:00:00Z'))).toBe('2026-11-01');
});

test('cadence window boundaries and off-days remain explicit', () => {
  expect(isPublicationDue(PUBLICATIONS.sunday, new Date('2026-09-20T10:59:00Z'))).toBe(false);
  expect(isPublicationDue(PUBLICATIONS.sunday, new Date('2026-09-20T12:00:00Z'))).toBe(true);
  expect(isPublicationDue(PUBLICATIONS.watercooler, new Date('2026-09-16T15:59:00Z'))).toBe(false);
  expect(isPublicationDue(PUBLICATIONS.watercooler, new Date('2026-09-16T16:00:00Z'))).toBe(true);
  expect(isPublicationDue(PUBLICATIONS.bulletin, new Date('2026-09-18T12:59:00Z'))).toBe(false);
  expect(isPublicationDue(PUBLICATIONS.bulletin, new Date('2026-09-18T13:00:00Z'))).toBe(true);
  expect(getDuePublications(new Date('2026-09-15T12:00:00Z'))).toEqual([]);
});

test('cadence invalid reference falls back without throwing', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-20T11:00:00Z'));
  try {
    expect(getDuePublications('not-a-date').map(({ edition }) => edition)).toEqual(['sunday']);
    expect(publicationDateKey('not-a-date')).toBe('2026-09-20');
    expect(getDuePublications(null).map(({ edition }) => edition)).toEqual(['sunday']);
    expect(getDuePublications(Symbol('invalid')).map(({ edition }) => edition)).toEqual(['sunday']);
    expect(publicationDateKey(Symbol('invalid'))).toBe('2026-09-20');
  } finally {
    jest.useRealTimers();
  }
});
