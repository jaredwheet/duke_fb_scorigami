import 'dotenv/config';
import { Resend } from 'resend';
import supabase from '../supabaseClient.js';
import { loadLatestSundayIssueData } from './loadSundayIssueData.js';
import { prepareNewsletter } from './newsletterEmail.js';
import {
  DEFAULT_PUBLICATION_KEY,
  claimNewsletterDelivery,
  completeNewsletterDelivery,
  failNewsletterDelivery,
  saveNewsletterIssue,
} from './newsletterPersistence.js';

const apiKey = process.env.RESEND_API_KEY;
const recipient = process.env.NEWSLETTER_TO || process.env.NEWSLETTER_TEST_TO;
const publicationKey = process.env.NEWSLETTER_PUBLICATION_KEY || DEFAULT_PUBLICATION_KEY;

if (!apiKey) throw new Error('RESEND_API_KEY is required');
if (!recipient) throw new Error('NEWSLETTER_TO or NEWSLETTER_TEST_TO is required');

async function loadIssueData() {
  try {
    return await loadLatestSundayIssueData();
  } catch (error) {
    if (error.message === 'No completed canonical game is available for a Sunday issue') {
      console.log('No completed canonical game is available; skipping newsletter run.');
      return null;
    }
    throw error;
  }
}

function isIssueReady(issueData) {
  const hasPlayData = issueData.win_expectancy?.snapshots?.length > 2 || issueData.scoring_plays?.length > 0;
  return Boolean(issueData.game_id && issueData.issue_date_key && issueData.source_payload && hasPlayData);
}

async function sendNewsletter() {
  const deterministicIssueData = await loadIssueData();
  if (!deterministicIssueData) return;
  if (!isIssueReady(deterministicIssueData)) {
    console.log(`Latest completed game ${deterministicIssueData.game_id || 'unknown'} is not fully ingested; skipping newsletter run.`);
    return;
  }

  const claim = await claimNewsletterDelivery(supabase, {
    email: recipient,
    publicationKey,
    issueDate: deterministicIssueData.issue_date_key,
    gameId: deterministicIssueData.game_id,
    subject: deterministicIssueData.subject,
    previewText: deterministicIssueData.preview_text,
  });
  if (claim.alreadySent) {
    console.log(`Newsletter already sent for game ${deterministicIssueData.game_id}; skipping.`);
    return;
  }

  try {
    const { issueData, html, chartBuffer, editorialResult } = await prepareNewsletter(deterministicIssueData);
    if (editorialResult) console.log(`Editorial pipeline: ${editorialResult.mode}; validation=${editorialResult.validation.approved}`);
    console.log(`Deterministic moment: ${deterministicIssueData.guide_context?.editorialMoment || deterministicIssueData.turning_point?.description || 'none'}`);
    console.log(`Rendered moment: ${issueData.guide_context?.editorialMoment || 'none'}`);

    await saveNewsletterIssue(supabase, claim.issue.id, {
      subject: issueData.subject,
      previewText: issueData.preview_text,
      html,
    });

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Duke Football Scorigami <onboarding@resend.dev>',
      to: [recipient],
      subject: issueData.subject,
      html,
      attachments: chartBuffer ? [{ filename: 'duke-win-expectancy.png', content: chartBuffer, contentId: 'duke-win-expectancy' }] : undefined,
      tags: [{ name: 'environment', value: 'automation' }, { name: 'publication', value: publicationKey }],
      headers: { 'X-Entity-Ref-ID': `duke-scorigami-${publicationKey}-${deterministicIssueData.game_id}-${claim.subscriber.id}` },
    });
    if (error) throw error;

    await completeNewsletterDelivery(supabase, {
      issueId: claim.issue.id,
      deliveryId: claim.delivery.id,
      providerMessageId: data.id,
    });
    console.log(`Automated newsletter sent for game ${deterministicIssueData.game_id}: ${data.id}`);
  } catch (error) {
    try {
      await failNewsletterDelivery(supabase, {
        issueId: claim.issue.id,
        deliveryId: claim.delivery.id,
        error,
      });
    } catch (persistenceError) {
      console.error(`Unable to record newsletter failure: ${persistenceError.message}`);
    }
    throw error;
  }
}

sendNewsletter().catch((error) => {
  console.error('Automated newsletter failed:', error);
  process.exitCode = 1;
});
