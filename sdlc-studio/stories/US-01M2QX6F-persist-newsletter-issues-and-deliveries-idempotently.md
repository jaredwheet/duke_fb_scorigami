# US-01M2QX6F: Persist newsletter issues and deliveries idempotently

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/newsletter/newsletterPersistence.js, src/newsletter/newsletterPersistence.test.js, src/newsletter/sendNewsletter.js, src/newsletter/sendNewsletter.test.js, supabase/migrations/20260917200000_newsletter_delivery_claims.sql
> **Epic:** EP-01M2QXFK
> **Points:** 8
> **Persona:** Taylor Morgan

## User Story

**As a** Taylor Morgan
**I want** newsletter issues and subscriber deliveries persisted with edition/date identity and completion state
**So that** a scheduled retry reuses the issue, never resends a completed delivery, and leaves failed attempts visible for retry.

## Context

### Persona Reference

**Taylor Morgan** - publishing operator, accountable for safe scheduled delivery and recovery; veto line: no delivery path that cannot distinguish failed, completed, and not-yet-attempted work.
[Full persona details](../personas/stakeholders/taylor-morgan.md)

### Background

`src/newsletter/newsletterPersistence.js` exposes `saveNewsletterIssue`, `claimNewsletterDelivery`,
`completeNewsletterDelivery`, and `failNewsletterDelivery`, consumed by `sendNewsletter.js`; the issue
schema lives in `supabase/migrations/20260916133805_sports_publishing_foundation.sql`. PRD FR-004
requires persisted identity keys so retries do not repeat completed work, and the epic risk table
calls out resending a completed delivery as High impact. This story proves reuse, no-resend, and
observable failure state with unit tests plus migration-boundary validation.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Performance | Scheduled delivery runs every 15 minutes with a ten-minute timeout. | Persistence operations must be bounded; issue assembly and claim stay retryable. |
| PRD | Security | Recipient addresses and Resend credentials are secrets; service-role credentials are server-only. | Tests use a sink/doubles; no real recipient in fixtures. |
| TRD | Architecture | Newsletter modules persist delivery state in Supabase. | All four persistence functions remain the single write boundary. |

---

## Acceptance Criteria

### AC1: Issue reuse

- **Given** an edition/date issue already exists,
- **When** scheduled delivery assembles it again,
- **Then** it reuses the issue identity rather than creating a second issue.
- **Verify:** shell npm test -- --runInBand -t "newsletter issue reuse"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js -> saveNewsletterIssue)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC4: Atomic delivery claim

- **Given** two workers claim the same issue/subscriber delivery,
- **When** the claim RPC runs concurrently,
- **Then** exactly one worker claims it and the loser does not send.
- **Verify:** manual apply `20260917200000_newsletter_delivery_claims.sql` to the disposable `supabase-test` database and assert one claim winner plus token-owned completion/failure transitions
- **Caller:** `npm run newsletter:send` (newsletterPersistence claim boundary)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

> **AC4 evidence (2026-09-18):** The delivery-claim migration was applied to disposable `supabase-test`.
> Existing delivery defaults, issue/subscriber uniqueness, one claim winner, failed-to-claimed retry,
> wrong-token rejection, correct-token completion, and service-role-only RPC privileges were verified.
>
> **Recorded SQL evidence (2026-09-18):** The following probes were run against disposable
> `supabase-test`; the SQL shape and returned values are recorded so the manual AC is auditable.
>
> | Probe | SQL | Result |
> | --- | --- | --- |
> | Retry state | `select id, status, attempts, provider_message_id from public.newsletter_deliveries where id in (1,7);` | `(1,sent,1,msg-right)` and `(7,sent,2,retry-message-b)` |
> | Wrong token | `select public.complete_newsletter_delivery(7, 'retry-token-wrong', 'wrong-token-must-not-complete');` | `false` |
> | Owning token | `select public.complete_newsletter_delivery(7, 'retry-token-b', 'retry-message-b');` | `true` |
> | Wrong failure token | `select public.fail_newsletter_delivery(18, 'concurrency-token-wrong', 'wrong-failure-token', false);` | `false` |
> | Owning failure token | `select public.fail_newsletter_delivery(18, 'concurrency-token-f', 'recorded-failure', false);` | `true` and delivery becomes `failed` |
> | RPC privileges | `select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE'), has_function_privilege('authenticated', p.oid, 'EXECUTE'), has_function_privilege('service_role', p.oid, 'EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('claim_newsletter_delivery','complete_newsletter_delivery','fail_newsletter_delivery') order by p.proname;` | All three RPCs: `false, false, true` |
> | Identity indexes | `select indexname, indexdef from pg_indexes where schemaname='public' and tablename in ('newsletter_issues','newsletter_issue_games','newsletter_deliveries') order by tablename,indexname;` | Unique indexes for `(publication_key, issue_date)`, `(issue_id, game_id, section_key)`, and `(issue_id, subscriber_id)` |
> | Direct table boundary | `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('newsletter_issues','newsletter_issue_games','newsletter_subscribers','newsletter_deliveries') order by c.relname;` plus `select tablename, policyname from pg_policies where schemaname='public' and tablename in ('newsletter_issues','newsletter_issue_games','newsletter_subscribers','newsletter_deliveries');` | All four newsletter tables `relrowsecurity=true`; zero public policies |
> | Concurrent claim A, launched in parallel with B | `select pg_backend_pid() as pid, clock_timestamp() as observed_at, result.* from public.claim_newsletter_delivery(9, 1, 'concurrency-token-g') as result;` | `pid=93037, observed_at=13:49:40.189537+00, claimed=true, delivery_id=20, status=claimed, claim_token=concurrency-token-g` |
> | Concurrent claim B, launched in parallel with A | `select pg_backend_pid() as pid, clock_timestamp() as observed_at, result.* from public.claim_newsletter_delivery(9, 1, 'concurrency-token-h') as result;` | `pid=93038, observed_at=13:49:40.317465+00, claimed=false, delivery_id=20, status=claimed, claim_token=concurrency-token-g` |
>
> Claims A and B were submitted as two `supabase-test_execute_sql` calls in one parallel tool batch;
> distinct backend PIDs and the same delivery row show the atomic race result.
>
> RLS/no-policy state denies direct client table writes despite inherited table grants; the service role
> is the only application write path.

### AC2: No duplicate delivery

- **Given** a subscriber delivery is completed,
- **When** the same scheduled retry runs,
- **Then** it does not send that subscriber a second copy.
- **Verify:** shell npm test -- --runInBand -t "newsletter duplicate"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js -> claimNewsletterDelivery/completeNewsletterDelivery)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC3: Observable failure state

- **Given** a delivery attempt fails,
- **When** persistence records the result,
- **Then** the failure and attempt state remain available for a later retry without being mistaken for completion.
- **Verify:** shell npm test -- --runInBand -t "newsletter delivery failure"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js -> failNewsletterDelivery)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

---

## Scope

### In Scope

- Edition/date issue identity: create-or-reuse semantics via `saveNewsletterIssue`.
- Delivery claim, completion, and failure transitions via `claimNewsletterDelivery`, `completeNewsletterDelivery`, `failNewsletterDelivery`.
- Unique keys enforcing issue/date and issue/subscriber identity in the migration.
- Distinguishing failed, completed, and not-yet-attempted states across retries.
- Migration-boundary validation for the newsletter tables in `20260916133805_sports_publishing_foundation.sql`.

### Out of Scope

- Resend provider transport behavior beyond the persistence contract.
- Subscriber acquisition or preference management.
- Issue content assembly and rendering (US-01M2QXAG).
- Migration application tooling; only table/constraint presence is validated.

---

## Technical Notes

`newsletterPersistence.js` already normalizes subscriber emails
(`normalizeNewsletterEmail`) and separates the four write verbs, which is the seam the tests should
exercise with a fake Supabase client. The forward migration adds an atomic claim RPC with a token, claimed
timestamp, attempt count, and retained error state. A failed delivery records failure state without
transitioning to completed; a retry re-claims only incomplete work, while claimed-but-never-completed
work remains operator-reconcilable rather than auto-expiring. `sendNewsletter.js` passes the token through
completion/failure and distinguishes retryable pre-send failure from uncertain post-provider/finalization
failure. Issue lookup is publication/date first, then linked-game validation. Keep `DEFAULT_PUBLICATION_KEY`
unchanged.

### API Contracts

No inbound API. Internal contracts in `src/newsletter/newsletterPersistence.js`:
`saveNewsletterIssue(client, issueId, {...})`, `claimNewsletterDelivery(client, {...})`,
`completeNewsletterDelivery(client, {issueId, deliveryId, claimToken, providerMessageId})`,
`failNewsletterDelivery(client, {issueId, deliveryId, claimToken, error, uncertain})`,
`normalizeNewsletterEmail(email)`, all consumed by `src/newsletter/sendNewsletter.js`. Outbound:
Supabase writes through `supabaseClient.js`; migration `20260916133805_sports_publishing_foundation.sql`
owns the tables and constraints.

### Data Requirements

- Newsletter issue and delivery tables with unique edition/date and issue/subscriber keys.
- State columns capable of representing not-yet-attempted, claimed, completed, failed, and uncertain.
- Fake/double Supabase client for unit tests; isolated database for migration-boundary validation.
- No real recipient addresses or Resend credentials in fixtures.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- | --- |
| Same edition/date assembled twice | One issue row reused; no second issue. |
| Retry after a completed delivery | Claim returns/observes completed; no second send. |
| Delivery fails mid-attempt | Failure recorded; state stays retryable and distinct from completion. |
| Retry after failure | Incomplete work is re-claimed and can complete; earlier failure history preserved. |
| Two concurrent claims for the same subscriber | Unique key allows one claim; the loser observes an existing claim. |
| Subscriber email case/whitespace varies | `normalizeNewsletterEmail` normalizes so identity matches. |
| Issue exists but a section write fails | Failure is observable; retry rebuilds sections idempotently without a duplicate issue. |
| Migration applied to a database with existing issues | Additive constraints validated; no data loss on apply. |

---

## Test Scenarios

- [ ] Assemble the same edition/date twice and assert a single issue row (jest "newsletter persistence").
- [ ] Complete a delivery, rerun the retry, and assert no second delivery (jest "duplicate").
- [ ] Fail a delivery and assert failed/attempt state recorded and retryable (jest "delivery").
- [ ] Concurrent-claim test proving the unique key rejects a second claim.
- [ ] Migration-boundary test asserting issue/delivery tables and unique constraints exist on a clean database.
- [ ] Email normalization tests for case/whitespace variants.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QX66](US-01M2QX66-select-scheduled-newsletter-editions.md) | Upstream | Edition/date key from cadence is the issue identity input. | Draft |
| [US-01M2QXAG](US-01M2QXAG-render-fact-backed-newsletter-editions-safely.md) | Upstream | Rendered issue content is what gets persisted and delivered. | Draft |
| [US-01M2QXFG](US-01M2QXFG-separate-test-newsletter-delivery-from-production-recipients.md) | Downstream | Test and production send paths both consume the claim/completion verbs. | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Supabase isolated boundary | Infrastructure | Needed - owner Taylor Morgan (see epic). |
| Migration `20260916133805_sports_publishing_foundation.sql` | Schema | Checked in; applied before send paths run. |

---

## Estimation

**Points:** 8
**Complexity:** High

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/newsletter/newsletterPersistence.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| Migration changes | Additive; revert via corrective migration or database snapshot restore | < 1 hour with snapshot |
| Delivery rows in a bad state | Re-run delivery after fix; claim/completion keys reconcile state | < 1 job run |

---

## Resolved Questions

- The issue/subscriber uniqueness and delivery claim RPC are validated in the disposable `supabase-test`
  database; remote migration-ledger alignment remains an operator deployment follow-up.
- Failed delivery state is retained indefinitely until an operator reconciles or archives it; no silent data
  loss or automatic retry of an uncertain external send is allowed.
- Claimed-but-never-completed deliveries do not auto-expire. A token-owned completion/failure transition
  remains observable for explicit recovery.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | Three Amigos refinement | Added atomic delivery claim AC/migration boundary, retained failure state, and explicit uncertain-claim recovery policy. |
