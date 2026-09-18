import { jest } from '@jest/globals';

const resendSend = jest.fn();
const Resend = jest.fn().mockImplementation(() => ({ emails: { send: resendSend } }));
const claimNewsletterDelivery = jest.fn();
const completeNewsletterDelivery = jest.fn();
const failNewsletterDelivery = jest.fn();
const saveNewsletterIssue = jest.fn();
const saveNewsletterEditorialAudit = jest.fn();

jest.unstable_mockModule('../supabaseClient.js', () => ({ default: {} }));
jest.unstable_mockModule('resend', () => ({ Resend }));
jest.unstable_mockModule('./newsletterPersistence.js', () => ({
  claimNewsletterDelivery,
  completeNewsletterDelivery,
  failNewsletterDelivery,
  safeNewsletterError: (error) => error?.code || 'newsletter_delivery_failed',
  saveNewsletterEditorialAudit,
  saveNewsletterIssue,
}));
jest.unstable_mockModule('./loadSundayIssueData.js', () => ({
  loadLatestSundayIssueData: jest.fn().mockResolvedValue({
    game_id: 1,
    issue_date_key: '2026-09-20',
    source_payload: { id: 1 },
    scoring_plays: [{ playNumber: 1 }],
    subject: 'Test issue',
    preview_text: 'Preview',
  }),
}));
jest.unstable_mockModule('./newsletterEmail.js', () => ({
  prepareNewsletter: jest.fn().mockResolvedValue({
    issueData: { subject: 'Test issue', preview_text: 'Preview' },
    html: '<html>test</html>',
    chartBuffer: null,
    editorialResult: null,
  }),
}));

const { sendPublication } = await import('./sendNewsletter.js');

const publication = {
  key: 'devil-in-details',
  sectionKey: 'sunday',
  edition: 'sunday',
  label: 'Devil in the Details',
};

beforeEach(() => {
  resendSend.mockReset();
  claimNewsletterDelivery.mockReset();
  completeNewsletterDelivery.mockReset();
  failNewsletterDelivery.mockReset();
  saveNewsletterIssue.mockReset();
  saveNewsletterEditorialAudit.mockReset();
  claimNewsletterDelivery.mockResolvedValue({
    alreadySent: false,
    issue: { id: 10 },
    subscriber: { id: 20 },
    delivery: { id: 30, claim_token: 'claim-a' },
  });
  completeNewsletterDelivery.mockResolvedValue(undefined);
  failNewsletterDelivery.mockResolvedValue(undefined);
  saveNewsletterIssue.mockResolvedValue(undefined);
  saveNewsletterEditorialAudit.mockResolvedValue(undefined);
  resendSend.mockResolvedValue({ data: { id: 'resend-1' }, error: null });
});

test('sendPublication carries the claim token through completion', async () => {
  await sendPublication(publication, '2026-09-20', { apiKey: 'key', recipient: 'test@example.invalid' });

  expect(completeNewsletterDelivery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    deliveryId: 30,
    claimToken: 'claim-a',
    providerMessageId: 'resend-1',
  }));
  expect(failNewsletterDelivery).not.toHaveBeenCalled();
});

test('pre-provider failure is retryable while provider failure is uncertain', async () => {
  const error = new Error('render failed');
  const newsletterEmail = await import('./newsletterEmail.js');
  newsletterEmail.prepareNewsletter.mockRejectedValueOnce(error);
  await expect(sendPublication(publication, '2026-09-20', { apiKey: 'key', recipient: 'test@example.invalid' })).rejects.toBe(error);
  expect(failNewsletterDelivery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ claimToken: 'claim-a', uncertain: false }));

  failNewsletterDelivery.mockClear();
  newsletterEmail.prepareNewsletter.mockResolvedValueOnce({ issueData: { subject: 'Test issue', preview_text: 'Preview' }, html: '<html/>', chartBuffer: null, editorialResult: null });
  resendSend.mockRejectedValueOnce(new Error('transport uncertain'));
  await expect(sendPublication(publication, '2026-09-20', { apiKey: 'key', recipient: 'test@example.invalid' })).rejects.toThrow('transport uncertain');
  expect(failNewsletterDelivery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ claimToken: 'claim-a', uncertain: true }));
});

test('Q7 AC5 editorial audit persists before provider send and audit failure blocks send', async () => {
  const newsletterEmail = await import('./newsletterEmail.js');
  newsletterEmail.prepareNewsletter.mockResolvedValueOnce({
    issueData: { subject: 'Test issue', preview_text: 'Preview' },
    html: '<html/>',
    chartBuffer: null,
    editorialResult: {
      mode: 'multi-agent-partial-fallback',
      sectionResults: { recap: { disposition: 'fallback', rejectionReasons: ['provider_timeout'] } },
      provenance: { packetVersion: 'v1', schemaVersion: 'v1', validatorVersion: 'v1', fallbackVersion: 'v1', provider: 'openai', model: 'test-model' },
    },
  });
  await sendPublication(publication, '2026-09-20', { apiKey: 'key', recipient: 'test@example.invalid' });

  expect(saveNewsletterEditorialAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ issueId: 10, deliveryId: 30 }));
  expect(saveNewsletterEditorialAudit.mock.invocationCallOrder[0]).toBeLessThan(resendSend.mock.invocationCallOrder[0]);

  saveNewsletterEditorialAudit.mockRejectedValueOnce(Object.assign(new Error('audit row failed'), { code: 'audit_persistence_failed' }));
  resendSend.mockClear();
  await expect(sendPublication(publication, '2026-09-20', { apiKey: 'key', recipient: 'test@example.invalid' })).rejects.toThrow('audit row failed');
  expect(resendSend).not.toHaveBeenCalled();
});
