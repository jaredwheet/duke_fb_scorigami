import 'dotenv/config';
import { Resend } from 'resend';
import supabase from '../supabaseClient.js';
import { buildVictoryBellBulletinIssueData, buildWatercoolerIssueData } from './editionData.js';
import { getDuePublications, publicationDateKey } from './cadence.js';
import { loadLatestSundayIssueData } from './loadSundayIssueData.js';
import { prepareNewsletter } from './newsletterEmail.js';
import {
  claimNewsletterDelivery,
  completeNewsletterDelivery,
  failNewsletterDelivery,
  saveNewsletterIssue,
} from './newsletterPersistence.js';

const apiKey = process.env.RESEND_API_KEY;
const recipient = process.env.NEWSLETTER_TO || process.env.NEWSLETTER_TEST_TO;

if (!apiKey) throw new Error('RESEND_API_KEY is required');
if (!recipient) throw new Error('NEWSLETTER_TO or NEWSLETTER_TEST_TO is required');

async function loadIssueData(publication, issueDate) {
  try {
    const baseIssueData = await loadLatestSundayIssueData(supabase, {
      includeOdds: publication.edition === 'bulletin',
      includeWatercooler: publication.edition === 'watercooler' || publication.edition === 'bulletin',
    });
    if (!baseIssueData) return null;
    if (publication.edition === 'bulletin') {
      if (!baseIssueData.next_game_id) {
        console.log('No upcoming scheduled game is available; skipping Victory Bell Bulletin.');
        return null;
      }
      return buildVictoryBellBulletinIssueData(baseIssueData, { issueDate, odds: baseIssueData.odds });
    }
    if (!isIssueReady(baseIssueData)) {
      console.log(`Latest completed game ${baseIssueData.game_id || 'unknown'} is not fully ingested; skipping ${publication.label}.`);
      return null;
    }
    if (publication.edition === 'watercooler') return buildWatercoolerIssueData(baseIssueData, { issueDate });
    return { ...baseIssueData, issue_date_key: issueDate };
  } catch (error) {
    if (error.message === 'No completed canonical game is available for a Sunday issue') {
      console.log(`No completed canonical game is available; skipping ${publication.label}.`);
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
  const duePublications = getDuePublications();
  if (duePublications.length === 0) {
    console.log('No newsletter edition is due.');
    return;
  }

  let failed = false;
  for (const publication of duePublications) {
    try {
      await sendPublication(publication, publicationDateKey());
    } catch (error) {
      failed = true;
      console.error(`${publication.label} failed:`, error);
    }
  }
  if (failed) process.exitCode = 1;
}

async function sendPublication(publication, issueDate) {
  const deterministicIssueData = await loadIssueData(publication, issueDate);
  if (!deterministicIssueData) return;

  const claim = await claimNewsletterDelivery(supabase, {
    email: recipient,
    publicationKey: publication.key,
    sectionKey: publication.sectionKey,
    issueDate,
    gameId: deterministicIssueData.game_id,
    subject: deterministicIssueData.subject,
    previewText: deterministicIssueData.preview_text,
  });
  if (claim.alreadySent) {
    console.log(`${publication.label} already sent for game ${deterministicIssueData.game_id}; skipping.`);
    return;
  }

  try {
    const { issueData, html, chartBuffer, editorialResult } = await prepareNewsletter(deterministicIssueData);
    if (editorialResult) console.log(`Editorial pipeline: ${editorialResult.mode}; validation=${editorialResult.validation.approved}`);
    if (publication.edition === 'sunday') {
      console.log(`Deterministic moment: ${deterministicIssueData.guide_context?.editorialMoment || deterministicIssueData.turning_point?.description || 'none'}`);
      console.log(`Rendered moment: ${issueData.guide_context?.editorialMoment || 'none'}`);
    }

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
      tags: [{ name: 'environment', value: 'automation' }, { name: 'publication', value: publication.key }],
      headers: { 'X-Entity-Ref-ID': `duke-scorigami-${publication.key}-${deterministicIssueData.game_id}-${claim.subscriber.id}` },
    });
    if (error) throw error;

    await completeNewsletterDelivery(supabase, {
      issueId: claim.issue.id,
      deliveryId: claim.delivery.id,
      providerMessageId: data.id,
    });
    console.log(`${publication.label} sent for game ${deterministicIssueData.game_id}: ${data.id}`);
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
