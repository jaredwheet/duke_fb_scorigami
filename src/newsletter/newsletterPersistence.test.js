import { jest } from '@jest/globals';
import {
  claimNewsletterDelivery,
  completeNewsletterDelivery,
  failNewsletterDelivery,
  normalizeNewsletterEmail,
  saveNewsletterEditorialAudit,
} from './newsletterPersistence.js';

function persistenceClient({ issue = { id: 10, publication_key: 'devil-in-details', issue_date: '2026-09-20', status: 'sending' }, linkedGames = [] } = {}) {
  const rpc = jest.fn();
  const calls = [];
  const client = {
    rpc,
    calls,
    from(table) {
      const filters = {};
      const query = {
        select() { return query; },
        ilike(field, value) { filters[field] = value; return query; },
        eq(field, value) { filters[field] = value; return query; },
        limit() { return query; },
        upsert(payload, options) { calls.push({ table, operation: 'upsert', payload, options }); return query; },
        update(payload) { calls.push({ table, operation: 'update', payload }); return query; },
        then(resolve, reject) {
          calls.push({ table, operation: 'read', filters: { ...filters } });
          let data = [];
          if (table === 'newsletter_subscribers') data = [{ id: 1, email: 'test@example.invalid', status: 'active' }];
          if (table === 'newsletter_issues') data = [issue];
          if (table === 'newsletter_issue_games') data = linkedGames;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
        maybeSingle() {
          calls.push({ table, operation: 'read', filters: { ...filters } });
          const data = table === 'newsletter_subscribers'
            ? { id: 1, email: 'test@example.invalid', status: 'active' }
            : table === 'newsletter_issues' ? issue : null;
          return Promise.resolve({ data, error: null });
        },
        single() {
          calls.push({ table, operation: 'read', filters: { ...filters } });
          return Promise.resolve({ data: table === 'newsletter_issues' ? issue : null, error: null });
        },
      };
      return query;
    },
  };
  return client;
}

function statefulPersistenceClient() {
  const state = {
    issue: { id: 10, publication_key: 'devil-in-details', issue_date: '2026-09-20', status: 'sending' },
    linkedGames: [],
    delivery: null,
    attempts: 0,
    issueInserts: 0,
  };
  const calls = [];
  const rpc = jest.fn(async (name, params) => {
    if (name === 'claim_newsletter_delivery') {
      if (!state.delivery) {
        state.attempts = 1;
        state.delivery = { id: 20, status: 'claimed', claim_token: params.p_claim_token, provider_message_id: null };
        return { data: [{ claimed: true, delivery_id: 20, status: 'claimed', claim_token: params.p_claim_token }], error: null };
      }
      if (state.delivery.status === 'failed') {
        state.attempts += 1;
        state.delivery = { ...state.delivery, status: 'claimed', claim_token: params.p_claim_token };
        return { data: [{ claimed: true, delivery_id: 20, status: 'claimed', claim_token: params.p_claim_token }], error: null };
      }
      return { data: [{ claimed: false, delivery_id: state.delivery.id, status: state.delivery.status, claim_token: state.delivery.claim_token }], error: null };
    }
    if (name === 'complete_newsletter_delivery') {
      if (state.delivery?.status !== 'claimed' || state.delivery.claim_token !== params.p_claim_token) return { data: false, error: null };
      state.delivery = { ...state.delivery, status: 'sent', provider_message_id: params.p_provider_message_id };
      return { data: true, error: null };
    }
    if (name === 'fail_newsletter_delivery') {
      if (state.delivery?.status !== 'claimed' || state.delivery.claim_token !== params.p_claim_token) return { data: false, error: null };
      state.delivery = { ...state.delivery, status: params.p_uncertain ? 'uncertain' : 'failed', error: params.p_error };
      return { data: true, error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });

  function resultFor(table, filters) {
    if (table === 'newsletter_subscribers') return [{ id: 1, email: 'test@example.invalid', status: 'active' }];
    if (table === 'newsletter_issues') {
      const matchesId = filters.id == null || Number(filters.id) === state.issue.id;
      const matchesIdentity = filters.publication_key == null || filters.publication_key === state.issue.publication_key;
      const matchesDate = filters.issue_date == null || filters.issue_date === state.issue.issue_date;
      return matchesId && matchesIdentity && matchesDate ? [state.issue] : [];
    }
    if (table === 'newsletter_issue_games') return state.linkedGames;
    return [];
  }

  const client = {
    rpc,
    calls,
    state,
    from(table) {
      const filters = {};
      let updatePayload = null;
      let insertPayload = null;
      const query = {
        select() { return query; },
        ilike(field, value) { filters[field] = value; return query; },
        eq(field, value) { filters[field] = value; return query; },
        limit() { return query; },
        insert(payload) { insertPayload = payload; calls.push({ table, operation: 'insert', payload }); return query; },
        upsert(payload) {
          calls.push({ table, operation: 'upsert', payload });
          if (table === 'newsletter_issue_games') state.linkedGames = [payload];
          return query;
        },
        update(payload) { updatePayload = payload; calls.push({ table, operation: 'update', payload }); return query; },
        maybeSingle() {
          calls.push({ table, operation: 'read', filters: { ...filters } });
          return Promise.resolve({ data: resultFor(table, filters)[0] || null, error: null });
        },
        single() {
          calls.push({ table, operation: 'read', filters: { ...filters } });
          if (insertPayload && table === 'newsletter_issues') {
            state.issueInserts += 1;
            state.issue = { ...state.issue, ...insertPayload };
          }
          if (updatePayload && table === 'newsletter_issues') state.issue = { ...state.issue, ...updatePayload };
          return Promise.resolve({ data: resultFor(table, filters)[0] || state.issue, error: null });
        },
        then(resolve, reject) {
          calls.push({ table, operation: 'read', filters: { ...filters } });
          return Promise.resolve({ data: resultFor(table, filters), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return client;
}

test('normalizes the single-recipient newsletter address', () => {
  expect(normalizeNewsletterEmail('  JaredWheet@gmail.com ')).toBe('jaredwheet@gmail.com');
});

test('rejects an invalid newsletter address', () => {
  expect(() => normalizeNewsletterEmail('not-an-email')).toThrow('valid newsletter recipient');
});

test('newsletter issue reuse claims through the atomic delivery RPC', async () => {
  const client = persistenceClient();
  client.rpc.mockResolvedValue({ data: [{ claimed: true, delivery_id: 20, status: 'claimed', claim_token: 'claim-a' }], error: null });

  const claim = await claimNewsletterDelivery(client, {
    email: ' TEST@example.invalid ',
    issueDate: '2026-09-20',
    gameId: 42,
    subject: 'Test issue',
    previewText: 'Preview',
  });

  expect(claim).toMatchObject({ alreadySent: false, delivery: { id: 20, claim_token: 'claim-a' } });
  expect(client.rpc).toHaveBeenCalledWith('claim_newsletter_delivery', expect.objectContaining({
    p_issue_id: 10,
    p_subscriber_id: 1,
    p_claim_token: expect.any(String),
  }));
});

test('newsletter issue reuse retains one issue across a failed retry', async () => {
  const client = statefulPersistenceClient();
  const first = await claimNewsletterDelivery(client, {
    email: 'test@example.invalid', issueDate: '2026-09-20', gameId: 42, subject: 'Test', previewText: 'Preview',
  });
  await failNewsletterDelivery(client, {
    issueId: first.issue.id, deliveryId: first.delivery.id, claimToken: first.delivery.claim_token, error: new Error('render failed'),
  });
  const retry = await claimNewsletterDelivery(client, {
    email: 'test@example.invalid', issueDate: '2026-09-20', gameId: 42, subject: 'Test', previewText: 'Preview',
  });

  expect(retry.issue.id).toBe(first.issue.id);
  expect(retry.alreadySent).toBe(false);
  expect(client.state.issueInserts).toBe(0);
  expect(client.state.attempts).toBe(2);
});

test('issue publication/date identity wins over a conflicting game link', async () => {
  const client = persistenceClient({ linkedGames: [{ game_id: 999 }] });

  await expect(claimNewsletterDelivery(client, {
    email: 'test@example.invalid', issueDate: '2026-09-20', gameId: 42, subject: 'Test', previewText: 'Preview',
  })).rejects.toThrow('Newsletter issue date collision');
  expect(client.calls.findIndex(({ table }) => table === 'newsletter_issues'))
    .toBeLessThan(client.calls.findIndex(({ table }) => table === 'newsletter_issue_games'));
});

test('newsletter duplicate completed claim is a no-op', async () => {
  const client = persistenceClient();
  client.rpc.mockResolvedValue({ data: [{ claimed: false, delivery_id: 20, status: 'sent', claim_token: 'claim-a' }], error: null });

  const claim = await claimNewsletterDelivery(client, {
    email: 'test@example.invalid', issueDate: '2026-09-20', gameId: 42, subject: 'Test', previewText: 'Preview',
  });

  expect(claim.alreadySent).toBe(true);
});

test('newsletter duplicate completed delivery does not claim a second send', async () => {
  const client = statefulPersistenceClient();
  const first = await claimNewsletterDelivery(client, {
    email: 'test@example.invalid', issueDate: '2026-09-20', gameId: 42, subject: 'Test', previewText: 'Preview',
  });
  await completeNewsletterDelivery(client, {
    issueId: first.issue.id, deliveryId: first.delivery.id, claimToken: first.delivery.claim_token, providerMessageId: 'msg-1',
  });
  const retry = await claimNewsletterDelivery(client, {
    email: 'test@example.invalid', issueDate: '2026-09-20', gameId: 42, subject: 'Test', previewText: 'Preview',
  });

  expect(retry.alreadySent).toBe(true);
  expect(client.state.delivery.status).toBe('sent');
  expect(client.state.attempts).toBe(1);
});

test('newsletter delivery failure and completion carry claim ownership and uncertainty', async () => {
  const client = persistenceClient();
  client.rpc
    .mockResolvedValueOnce({ data: true, error: null })
    .mockResolvedValueOnce({ data: true, error: null });

  await expect(completeNewsletterDelivery(client, {
    issueId: 10, deliveryId: 20, claimToken: 'claim-a', providerMessageId: 'msg-1',
  })).resolves.toBeUndefined();
  await expect(failNewsletterDelivery(client, {
    issueId: 10, deliveryId: 20, claimToken: 'claim-a', error: new Error('send timeout'), uncertain: true,
  })).resolves.toBeUndefined();

  expect(client.rpc).toHaveBeenNthCalledWith(1, 'complete_newsletter_delivery', {
    p_delivery_id: 20, p_claim_token: 'claim-a', p_provider_message_id: 'msg-1',
  });
  expect(client.rpc).toHaveBeenNthCalledWith(2, 'fail_newsletter_delivery', {
    p_delivery_id: 20, p_claim_token: 'claim-a', p_error: 'send timeout', p_uncertain: true,
  });
});

test('newsletter delivery failure remains retryable while uncertain state does not', async () => {
  const client = statefulPersistenceClient();
  const first = await claimNewsletterDelivery(client, {
    email: 'test@example.invalid', issueDate: '2026-09-20', gameId: 42, subject: 'Test', previewText: 'Preview',
  });
  await failNewsletterDelivery(client, {
    issueId: first.issue.id, deliveryId: first.delivery.id, claimToken: first.delivery.claim_token, error: new Error('send failed'),
  });
  const retry = await claimNewsletterDelivery(client, {
    email: 'test@example.invalid', issueDate: '2026-09-20', gameId: 42, subject: 'Test', previewText: 'Preview',
  });
  await failNewsletterDelivery(client, {
    issueId: retry.issue.id, deliveryId: retry.delivery.id, claimToken: retry.delivery.claim_token, error: new Error('provider uncertain'), uncertain: true,
  });
  const uncertainRetry = await claimNewsletterDelivery(client, {
    email: 'test@example.invalid', issueDate: '2026-09-20', gameId: 42, subject: 'Test', previewText: 'Preview',
  });

  expect(retry.alreadySent).toBe(false);
  expect(uncertainRetry.alreadySent).toBe(true);
  expect(client.state.delivery.status).toBe('uncertain');
  expect(client.state.attempts).toBe(2);
});

test('Q7 editorial audit persistence stores bounded provenance and section outcomes', async () => {
  const insert = jest.fn().mockResolvedValue({ error: null });
  const client = { from: jest.fn(() => ({ insert })) };

  await saveNewsletterEditorialAudit(client, {
    issueId: 10,
    deliveryId: 20,
    editorialResult: {
      mode: 'multi-agent-partial-fallback',
      sectionResults: { recap: { disposition: 'fallback', rejectionReasons: ['provider_timeout'] } },
      provenance: {
        packetVersion: 'v1', schemaVersion: 'v1', validatorVersion: 'v1', fallbackVersion: 'v1',
        provider: 'openai', model: 'test-model', discoveryWarnings: ['provider_error'],
      },
    },
  });

  expect(insert).toHaveBeenCalledWith(expect.objectContaining({
    issue_id: 10,
    delivery_id: 20,
    mode: 'multi-agent-partial-fallback',
    section_results: { recap: { disposition: 'fallback', rejectionReasons: ['provider_timeout'] } },
    discovery_warnings: ['provider_error'],
  }));
});
