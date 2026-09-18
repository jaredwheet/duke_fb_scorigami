import 'dotenv/config';
import { Resend } from 'resend';
import { buildVictoryBellBulletinIssueData, buildWatercoolerIssueData } from './editionData.js';
import { PUBLICATIONS, publicationDateKey } from './cadence.js';
import { loadLatestSundayIssueData } from './loadSundayIssueData.js';
import { prepareNewsletter } from './newsletterEmail.js';

function validateIssueDate(value) {
  if (!value) return publicationDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('NEWSLETTER_TEST_DATE must be a valid YYYY-MM-DD date');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('NEWSLETTER_TEST_DATE must be a valid YYYY-MM-DD date');
  }
  return value;
}

export async function sendTestNewsletter() {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.NEWSLETTER_TEST_TO;
  const edition = process.env.NEWSLETTER_TEST_EDITION || 'sunday';

  if (!apiKey) throw new Error('RESEND_API_KEY is required');
  if (!recipient) throw new Error('NEWSLETTER_TEST_TO is required');
  if (!Object.hasOwn(PUBLICATIONS, edition)) {
    throw new Error('NEWSLETTER_TEST_EDITION must be one of sunday, watercooler, bulletin');
  }
  const issueDate = validateIssueDate(process.env.NEWSLETTER_TEST_DATE);

  const resend = new Resend(apiKey);
  const baseIssueData = process.env.NEWSLETTER_USE_LIVE_DATA === 'true'
    ? await loadLatestSundayIssueData(undefined, {
      includeOdds: edition === 'bulletin',
      includeWatercooler: edition === 'watercooler' || edition === 'bulletin',
      includeBulletin: edition === 'bulletin',
    })
    : {};
  const deterministicIssueData = edition === 'watercooler'
    ? buildWatercoolerIssueData(baseIssueData, { issueDate })
    : edition === 'bulletin'
      ? buildVictoryBellBulletinIssueData(baseIssueData, { issueDate, odds: baseIssueData.odds })
      : { ...baseIssueData, issue_date_key: issueDate };
  const { issueData, html, chartBuffer, editorialResult } = await prepareNewsletter(deterministicIssueData);
  console.log(`Test edition: ${issueData.edition || 'sunday'}; issue date: ${issueDate}`);
  if (editorialResult) console.log(`Editorial pipeline: ${editorialResult.mode}; validation=${editorialResult.validation.approved}`);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Duke Football Scorigami <onboarding@resend.dev>',
    to: [recipient],
    subject: `TEST: ${issueData.subject}`,
    html,
    attachments: chartBuffer ? [{ filename: 'duke-win-expectancy.png', content: chartBuffer, contentId: 'duke-win-expectancy' }] : undefined,
    tags: [{ name: 'environment', value: 'test' }, { name: 'edition', value: issueData.edition || 'sunday' }],
    headers: { 'X-Entity-Ref-ID': `duke-scorigami-test-${Date.now()}` },
  });

  if (error) throw error;
  console.log(`Test newsletter sent: ${data.id}`);
  return data;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  sendTestNewsletter().catch((error) => {
    console.error('Test newsletter failed:', error);
    process.exitCode = 1;
  });
}
