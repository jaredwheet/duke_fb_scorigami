import 'dotenv/config';
import { Resend } from 'resend';
import { runEditorialOrchestrator } from '../ai/orchestrator.js';
import { renderDevilInDetails } from './renderNewsletter.js';
import { loadLatestSundayIssueData } from './loadSundayIssueData.js';
import { renderWinExpectancyChart } from './winExpectancy.js';

const apiKey = process.env.RESEND_API_KEY;
const recipient = process.env.NEWSLETTER_TEST_TO;

if (!apiKey) throw new Error('RESEND_API_KEY is required');
if (!recipient) throw new Error('NEWSLETTER_TEST_TO is required');

const resend = new Resend(apiKey);
const deterministicIssueData = process.env.NEWSLETTER_USE_LIVE_DATA === 'true'
  ? await loadLatestSundayIssueData()
  : {};
const editorialResult = deterministicIssueData.current_score
  ? await runEditorialOrchestrator(deterministicIssueData)
  : null;
const issueData = editorialResult?.issueData || deterministicIssueData;
if (editorialResult) console.log(`Editorial pipeline: ${editorialResult.mode}; validation=${editorialResult.validation.approved}`);
const chartBuffer = issueData.win_expectancy?.snapshots?.length > 1
  ? await renderWinExpectancyChart(issueData.win_expectancy.snapshots)
  : null;
const html = await renderDevilInDetails({
  ...issueData,
  win_expectancy: chartBuffer
    ? { ...issueData.win_expectancy, imageSource: 'cid:duke-win-expectancy' }
    : null,
});
const { data, error } = await resend.emails.send({
  from: process.env.RESEND_FROM_EMAIL || 'Duke Football Scorigami <onboarding@resend.dev>',
  to: [recipient],
  subject: 'TEST: Devil in the Details',
  html,
  attachments: chartBuffer ? [{ filename: 'duke-win-expectancy.png', content: chartBuffer, contentId: 'duke-win-expectancy' }] : undefined,
  tags: [{ name: 'environment', value: 'test' }],
  headers: { 'X-Entity-Ref-ID': `duke-scorigami-test-${Date.now()}` },
});

if (error) {
  console.error('Resend error:', error);
  process.exitCode = 1;
} else {
  console.log(`Test newsletter sent: ${data.id}`);
}
