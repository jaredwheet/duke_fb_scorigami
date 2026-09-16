import 'dotenv/config';
import { Resend } from 'resend';
import { renderDevilInDetails } from './renderNewsletter.js';
import { loadLatestSundayIssueData } from './loadSundayIssueData.js';

const apiKey = process.env.RESEND_API_KEY;
const recipient = process.env.NEWSLETTER_TEST_TO;

if (!apiKey) throw new Error('RESEND_API_KEY is required');
if (!recipient) throw new Error('NEWSLETTER_TEST_TO is required');

const resend = new Resend(apiKey);
const issueData = process.env.NEWSLETTER_USE_LIVE_DATA === 'true'
  ? await loadLatestSundayIssueData()
  : {};
const html = await renderDevilInDetails(issueData);
const { data, error } = await resend.emails.send({
  from: process.env.RESEND_FROM_EMAIL || 'Duke Football Scorigami <onboarding@resend.dev>',
  to: [recipient],
  subject: 'TEST: Devil in the Details',
  html,
  tags: [{ name: 'environment', value: 'test' }],
  headers: { 'X-Entity-Ref-ID': `duke-scorigami-test-${Date.now()}` },
});

if (error) {
  console.error('Resend error:', error);
  process.exitCode = 1;
} else {
  console.log(`Test newsletter sent: ${data.id}`);
}
