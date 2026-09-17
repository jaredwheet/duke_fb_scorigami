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
  let issue = await loadIssueForGame(client, gameId, sectionKey);
  if (!issue) issue = await loadIssue(client, publicationKey, issueDate);
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
  let delivery = await loadDelivery(client, issue.id, subscriber.id);
  if (!delivery) {
    const { data, error } = await client
      .from('newsletter_deliveries')
      .insert({ issue_id: issue.id, subscriber_id: subscriber.id, status: 'queued' })
      .select('id, status, provider_message_id')
      .single();
    if (error && !isUniqueViolation(error)) throw error;
    delivery = data || await loadDelivery(client, issue.id, subscriber.id);
  }
  if (!delivery) throw new Error(`Unable to create newsletter delivery for issue ${issue.id}`);
  if (delivery.status === 'sent' || delivery.status === 'delivered') {
    return { alreadySent: true, issue, subscriber, delivery };
  }

  const { data: queuedDelivery, error: queueError } = await client
    .from('newsletter_deliveries')
    .update({ status: 'queued', error: null })
    .eq('id', delivery.id)
    .select('id, status, provider_message_id')
    .single();
  if (queueError) throw queueError;

  return { alreadySent: false, issue, subscriber, delivery: queuedDelivery };
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

export async function completeNewsletterDelivery(client, {
  issueId,
  deliveryId,
  providerMessageId,
} = {}) {
  const sentAt = new Date().toISOString();
  const { error: deliveryError } = await client
    .from('newsletter_deliveries')
    .update({ status: 'sent', provider_message_id: providerMessageId, sent_at: sentAt, error: null })
    .eq('id', deliveryId);
  if (deliveryError) throw deliveryError;
  const { error: issueError } = await client
    .from('newsletter_issues')
    .update({ status: 'sent', sent_at: sentAt })
    .eq('id', issueId);
  if (issueError) throw issueError;
}

export async function failNewsletterDelivery(client, {
  issueId,
  deliveryId,
  error,
} = {}) {
  const message = String(error?.message || error || 'Unknown newsletter delivery error').slice(0, 2000);
  const { error: deliveryError } = await client
    .from('newsletter_deliveries')
    .update({ status: 'failed', error: message })
    .eq('id', deliveryId);
  if (deliveryError) throw deliveryError;
  const { error: issueError } = await client
    .from('newsletter_issues')
    .update({ status: 'failed' })
    .eq('id', issueId);
  if (issueError) throw issueError;
}
