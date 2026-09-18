import { randomUUID } from 'node:crypto';

export const DEFAULT_PUBLICATION_KEY = 'devil-in-details';
const DEFAULT_SECTION_KEY = 'sunday';
const TEMPLATE_VERSION = 'v1';

function isUniqueViolation(error) {
  return error?.code === '23505';
}

export function normalizeNewsletterEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) throw new Error('A valid newsletter recipient is required');
  return normalized;
}

export function safeNewsletterError(error) {
  const code = error?.code || error?.fallbackReason;
  if (['provider_not_configured', 'malformed_response', 'provider_error', 'provider_timeout', 'audit_persistence_failed'].includes(code)) {
    return code;
  }
  return 'newsletter_delivery_failed';
}

async function loadSubscriber(client, email) {
  const { data, error } = await client
    .from('newsletter_subscribers')
    .select('id, email, status')
    .ilike('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getOrCreateSubscriber(client, email) {
  const normalizedEmail = normalizeNewsletterEmail(email);
  let subscriber = await loadSubscriber(client, normalizedEmail);
  if (!subscriber) {
    const { data, error } = await client
      .from('newsletter_subscribers')
      .insert({
        email: normalizedEmail,
        status: 'active',
        consent_source: 'single-recipient-automation',
        consented_at: new Date().toISOString(),
      })
      .select('id, email, status')
      .single();
    if (error && !isUniqueViolation(error)) throw error;
    subscriber = data || await loadSubscriber(client, normalizedEmail);
  }
  if (!subscriber) throw new Error(`Unable to create newsletter subscriber for ${normalizedEmail}`);

  if (subscriber.status !== 'active') throw new Error(`Newsletter subscriber is not active: ${subscriber.email}`);
  return subscriber;
}

async function loadIssue(client, publicationKey, issueDate) {
  const { data, error } = await client
    .from('newsletter_issues')
    .select('id, publication_key, issue_date, status')
    .eq('publication_key', publicationKey)
    .eq('issue_date', issueDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadIssueForGame(client, gameId, sectionKey) {
  const { data: links, error: linksError } = await client
    .from('newsletter_issue_games')
    .select('issue_id')
    .eq('game_id', gameId)
    .eq('section_key', sectionKey)
    .limit(1);
  if (linksError) throw linksError;
  const issueId = links?.[0]?.issue_id;
  if (!issueId) return null;

  const { data, error } = await client
    .from('newsletter_issues')
    .select('id, publication_key, issue_date, status')
    .eq('id', issueId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getOrCreateIssue(client, {
  publicationKey,
  sectionKey,
  issueDate,
  gameId,
  subject,
  previewText,
}) {
  let issue = await loadIssue(client, publicationKey, issueDate);
  if (!issue) {
    const { data, error } = await client
      .from('newsletter_issues')
      .insert({
        publication_key: publicationKey,
        issue_date: issueDate,
        status: 'sending',
        subject,
        preview_text: previewText,
        template_version: TEMPLATE_VERSION,
      })
      .select('id, publication_key, issue_date, status')
      .single();
    if (error && !isUniqueViolation(error)) throw error;
    issue = data || await loadIssue(client, publicationKey, issueDate);
  }
  if (!issue) throw new Error(`Unable to create newsletter issue for ${issueDate}`);

  const { data: linkedGames, error: linkedGamesError } = await client
    .from('newsletter_issue_games')
    .select('game_id')
    .eq('issue_id', issue.id)
    .eq('section_key', sectionKey);
  if (linkedGamesError) throw linkedGamesError;
  if (linkedGames?.some((row) => Number(row.game_id) !== Number(gameId))) {
    throw new Error(`Newsletter issue date collision: ${publicationKey}/${issueDate}`);
  }

  const { error: linkError } = await client
    .from('newsletter_issue_games')
    .upsert({ issue_id: issue.id, game_id: gameId, section_key: sectionKey, position: 0 }, {
      onConflict: 'issue_id,game_id,section_key',
    });
  if (linkError) throw linkError;

  if (issue.status === 'sent') return issue;

  const { data: updatedIssue, error: updateError } = await client
    .from('newsletter_issues')
    .update({ status: 'sending', subject, preview_text: previewText, template_version: TEMPLATE_VERSION })
    .eq('id', issue.id)
    .select('id, publication_key, issue_date, status')
    .single();
  if (updateError) throw updateError;
  return updatedIssue;
}

async function loadDelivery(client, issueId, subscriberId) {
  const { data, error } = await client
    .from('newsletter_deliveries')
    .select('id, status, provider_message_id')
    .eq('issue_id', issueId)
    .eq('subscriber_id', subscriberId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function claimNewsletterDelivery(client, {
  email,
  publicationKey = DEFAULT_PUBLICATION_KEY,
  sectionKey = DEFAULT_SECTION_KEY,
  issueDate,
  gameId,
  subject,
  previewText,
} = {}) {
  if (!issueDate) throw new Error('An issue date is required to claim a newsletter delivery');
  if (!gameId) throw new Error('A game id is required to claim a newsletter delivery');

  const subscriber = await getOrCreateSubscriber(client, email);
  const issue = await getOrCreateIssue(client, {
    publicationKey,
    sectionKey,
    issueDate,
    gameId,
    subject,
    previewText,
  });
  const claimToken = randomUUID();
  const { data, error } = await client.rpc('claim_newsletter_delivery', {
    p_issue_id: issue.id,
    p_subscriber_id: subscriber.id,
    p_claim_token: claimToken,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error(`Unable to claim newsletter delivery for issue ${issue.id}`);
  const { data: attemptRow } = await client
    .from('newsletter_deliveries')
    .select('attempts')
    .eq('id', result.delivery_id)
    .maybeSingle();
  const delivery = {
    id: result.delivery_id,
    status: result.status,
    claim_token: result.claim_token,
    attempts: attemptRow?.attempts || null,
    provider_message_id: null,
  };
  return {
    alreadySent: !result.claimed,
    issue,
    subscriber,
    delivery,
  };
}

export async function saveNewsletterIssue(client, issueId, {
  subject,
  previewText,
  html,
} = {}) {
  const { error } = await client
    .from('newsletter_issues')
    .update({
      subject,
      preview_text: previewText,
      html_body: html,
      template_version: TEMPLATE_VERSION,
    })
    .eq('id', issueId);
  if (error) throw error;
}

export async function saveNewsletterEditorialAudit(client, {
  issueId,
  deliveryId = null,
  attempt = 1,
  editorialResult = {},
} = {}) {
  const provenance = editorialResult.provenance || {};
  const { error } = await client.from('newsletter_editorial_audits').insert({
    issue_id: issueId,
    delivery_id: deliveryId,
    attempt,
    mode: editorialResult.mode || 'unknown',
    provider: provenance.provider || null,
    model: provenance.model || null,
    packet_version: provenance.packetVersion || 'unknown',
    schema_version: provenance.schemaVersion || 'unknown',
    validator_version: provenance.validatorVersion || 'unknown',
    fallback_version: provenance.fallbackVersion || 'unknown',
    section_results: editorialResult.sectionResults || {},
    discovery_warnings: provenance.discoveryWarnings || [],
  });
  if (error) {
    const wrapped = new Error('audit_persistence_failed');
    wrapped.code = 'audit_persistence_failed';
    wrapped.cause = error;
    throw wrapped;
  }
}

export async function completeNewsletterDelivery(client, {
  issueId,
  deliveryId,
  claimToken,
  providerMessageId,
} = {}) {
  const sentAt = new Date().toISOString();
  const { data: completed, error: deliveryError } = await client.rpc('complete_newsletter_delivery', {
    p_delivery_id: deliveryId,
    p_claim_token: claimToken,
    p_provider_message_id: providerMessageId,
  });
  if (deliveryError) throw deliveryError;
  if (completed !== true) throw new Error(`Unable to complete newsletter delivery ${deliveryId}`);
  const { error: issueError } = await client
    .from('newsletter_issues')
    .update({ status: 'sent', sent_at: sentAt })
    .eq('id', issueId);
  if (issueError) throw issueError;
}

export async function failNewsletterDelivery(client, {
  issueId,
  deliveryId,
  claimToken,
  error,
  uncertain = false,
} = {}) {
  const message = String(error?.message || error || 'Unknown newsletter delivery error').slice(0, 2000);
  const { data: failed, error: deliveryError } = await client.rpc('fail_newsletter_delivery', {
    p_delivery_id: deliveryId,
    p_claim_token: claimToken,
    p_error: message,
    p_uncertain: uncertain,
  });
  if (deliveryError) throw deliveryError;
  if (failed !== true) throw new Error(`Unable to record newsletter delivery ${deliveryId}`);
  const { error: issueError } = await client
    .from('newsletter_issues')
    .update({ status: 'failed' })
    .eq('id', issueId);
  if (issueError) throw issueError;
}
