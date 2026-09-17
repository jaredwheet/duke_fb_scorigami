import 'dotenv/config';
import { Resend } from 'resend';
import { buildVictoryBellBulletinIssueData, buildWatercoolerIssueData } from './editionData.js';
import { publicationDateKey } from './cadence.js';
import { loadLatestSundayIssueData } from './loadSundayIssueData.js';
import { prepareNewsletter } from './newsletterEmail.js';

const apiKey = process.env.RESEND_API_KEY;
const recipient = process.env.NEWSLETTER_TEST_TO;
const edition = process.env.NEWSLETTER_TEST_EDITION || 'sunday';
const issueDate = process.env.NEWSLETTER_TEST_DATE || publicationDateKey();

if (!apiKey) throw new Error('RESEND_API_KEY is required');
if (!recipient) throw new Error('NEWSLETTER_TEST_TO is required');

const resend = new Resend(apiKey);
const baseIssueData = process.env.NEWSLETTER_USE_LIVE_DATA === 'true'
  ? await loadLatestSundayIssueData(undefined, {
    includeOdds: edition === 'bulletin',
    includeWatercooler: edition === 'watercooler' || edition === 'bulletin',
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
if (edition === 'sunday') {
  console.log(`Deterministic moment: ${deterministicIssueData.guide_context?.editorialMoment || deterministicIssueData.turning_point?.description || 'none'}`);
  console.log(`Rendered moment: ${issueData.guide_context?.editorialMoment || 'none'}`);
}
const { data, error } = await resend.emails.send({
  from: process.env.RESEND_FROM_EMAIL || 'Duke Football Scorigami <onboarding@resend.dev>',
  to: [recipient],
  subject: `TEST: ${issueData.subject}`,
  html,
  attachments: chartBuffer ? [{ filename: 'duke-win-expectancy.png', content: chartBuffer, contentId: 'duke-win-expectancy' }] : undefined,
  tags: [{ name: 'environment', value: 'test' }, { name: 'edition', value: issueData.edition || 'sunday' }],
  headers: { 'X-Entity-Ref-ID': `duke-scorigami-test-${Date.now()}` },
});

if (error) {
  console.error('Resend error:', error);
  process.exitCode = 1;
} else {
  console.log(`Test newsletter sent: ${data.id}`);
}
