import { normalizeNewsletterEmail } from './newsletterPersistence.js';

test('normalizes the single-recipient newsletter address', () => {
  expect(normalizeNewsletterEmail('  JaredWheet@gmail.com ')).toBe('jaredwheet@gmail.com');
});

test('rejects an invalid newsletter address', () => {
  expect(() => normalizeNewsletterEmail('not-an-email')).toThrow('valid newsletter recipient');
});
