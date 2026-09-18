import { jest } from '@jest/globals';
import { readFile } from 'node:fs/promises';

const resendSend = jest.fn();
const Resend = jest.fn().mockImplementation(() => ({ emails: { send: resendSend } }));
jest.unstable_mockModule('../supabaseClient.js', () => ({ default: {} }));
jest.unstable_mockModule('resend', () => ({ Resend }));

const { sendNewsletter } = await import('./sendNewsletter.js');
const { sendTestNewsletter } = await import('./sendTestNewsletter.js');

beforeEach(() => {
  resendSend.mockReset();
  Resend.mockClear();
  delete process.env.RESEND_API_KEY;
  delete process.env.NEWSLETTER_TO;
  delete process.env.NEWSLETTER_TEST_TO;
  delete process.env.NEWSLETTER_TEST_EDITION;
  delete process.env.NEWSLETTER_TEST_DATE;
  delete process.env.NEWSLETTER_UNSUBSCRIBE_URL;
  delete process.env.NEWSLETTER_PREFERENCES_URL;
});

test('production recipient required before transport construction', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.NEWSLETTER_TEST_TO = 'test@example.invalid';

  await expect(sendNewsletter()).rejects.toThrow('NEWSLETTER_TO is required for production delivery');
  expect(Resend).not.toHaveBeenCalled();
  expect(resendSend).not.toHaveBeenCalled();
});

test('test newsletter recipient uses only the explicit test address', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.NEWSLETTER_TEST_TO = 'test@example.invalid';
  resendSend.mockResolvedValue({ data: { id: 'test-message' }, error: null });

  await expect(sendTestNewsletter()).resolves.toEqual({ id: 'test-message' });
  expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({ to: ['test@example.invalid'] }));
});

test('test newsletter recipient workflow forwards edition and optional date', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/newsletter-test.yml', import.meta.url), 'utf8');

  expect(workflow).toContain('edition:');
  expect(workflow).toContain('test_date:');
  expect(workflow).toContain('NEWSLETTER_TEST_EDITION: ${{ inputs.edition || \'sunday\' }}');
  expect(workflow).toContain('NEWSLETTER_TEST_DATE: ${{ inputs.test_date || \'\' }}');
});

test('newsletter configuration fails before transport when key or recipient is absent', async () => {
  await expect(sendTestNewsletter()).rejects.toThrow('RESEND_API_KEY is required');
  process.env.RESEND_API_KEY = 'test-key';
  await expect(sendTestNewsletter()).rejects.toThrow('NEWSLETTER_TEST_TO is required');
  expect(resendSend).not.toHaveBeenCalled();
});

test('newsletter transport guard blocks invalid test inputs before Resend', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.NEWSLETTER_TEST_TO = 'test@example.invalid';
  process.env.NEWSLETTER_TEST_EDITION = 'not-an-edition';

  await expect(sendTestNewsletter()).rejects.toThrow('NEWSLETTER_TEST_EDITION must be one of');
  expect(Resend).not.toHaveBeenCalled();
  expect(resendSend).not.toHaveBeenCalled();

  process.env.NEWSLETTER_TEST_EDITION = 'sunday';
  process.env.NEWSLETTER_TEST_DATE = '2026-02-29';
  await expect(sendTestNewsletter()).rejects.toThrow('NEWSLETTER_TEST_DATE must be a valid YYYY-MM-DD date');
  expect(Resend).not.toHaveBeenCalled();
});

test('newsletter escape rejects malformed production HTTPS URLs', async () => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.NEWSLETTER_TO = 'production@example.invalid';
  process.env.NEWSLETTER_UNSUBSCRIBE_URL = 'https://';
  process.env.NEWSLETTER_PREFERENCES_URL = 'https://example.invalid/preferences';

  await expect(sendNewsletter()).rejects.toThrow('NEWSLETTER_UNSUBSCRIBE_URL must be an HTTPS URL');
  expect(Resend).not.toHaveBeenCalled();
  expect(resendSend).not.toHaveBeenCalled();
});

test('newsletter configuration workflow secrets stay separated', async () => {
  const productionWorkflow = await readFile(new URL('../../.github/workflows/newsletter.yml', import.meta.url), 'utf8');
  const testWorkflow = await readFile(new URL('../../.github/workflows/newsletter-test.yml', import.meta.url), 'utf8');

  expect(productionWorkflow).toContain('NEWSLETTER_TO: ${{ secrets.NEWSLETTER_TO }}');
  expect(productionWorkflow).not.toContain('NEWSLETTER_TEST_TO');
  expect(testWorkflow).toContain('NEWSLETTER_TEST_TO: ${{ secrets.NEWSLETTER_TEST_TO }}');
  expect(testWorkflow).not.toContain('NEWSLETTER_TO:');
});
