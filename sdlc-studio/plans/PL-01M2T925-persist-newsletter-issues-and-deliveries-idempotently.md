# PL-01M2T925: Persist newsletter issues and deliveries idempotently

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Story:** [US-01M2QX6F: Persist newsletter issues and deliveries idempotently](../stories/US-01M2QX6F-persist-newsletter-issues-and-deliveries-idempotently.md)
> **Epic:** [EP-01M2QXFK: Newsletter Publishing and Delivery](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md)
> **Created:** 2026-09-18
> **Language:** JavaScript ES modules, SQL migrations, Node.js 22

## Overview

Add an atomic newsletter delivery claim/finalize/fail state boundary. Issue/date reuse remains idempotent;
delivery claims are token-owned, completed deliveries cannot be re-claimed, failed deliveries retain
attempt/error state, and uncertain external sends do not auto-retry.

## Acceptance Criteria Summary

| AC | Name | Description |
| --- | --- | --- |
| AC1 | Issue reuse | Same publication/date reuses one issue identity. |
| AC2 | No duplicate delivery | Completed delivery retries do not send again. |
| AC3 | Observable failure | Failed delivery remains distinguishable and retryable when explicitly eligible. |
| AC4 | Atomic claim | Concurrent claims have one winner and token-owned completion/failure. |

## Technical Context

- Existing issue/date and issue/subscriber uniqueness remains the ledger identity.
- New migration `20260917200000_newsletter_delivery_claims.sql` adds `claimed` state, claim token/time,
  attempt count, and retained error metadata plus security-definer claim/complete/fail RPCs.
- Existing `newsletterPersistence.js` is the only state write boundary.
- Default tests use an in-memory Supabase-shaped client; migration evidence uses disposable `supabase-test`.

## Recommended Approach

**Strategy:** TDD

First pin issue reuse, claim conflict, token ownership, failure/retry, and normalization with stateful
doubles. Then implement the additive migration/RPCs and persistence adapter. No Resend call is made by the
default suite.

## Implementation Tasks

| # | Task | File | Depends On | Status |
| --- | --- | --- | --- | --- |
| 1 | Add claim state migration/RPCs with existing-row defaults, unique identity, token ownership, and service-role-only execution. | `supabase/migrations/20260917200000_newsletter_delivery_claims.sql` | Schema review | [x] |
| 2 | Replace read-then-insert delivery claims with atomic claim RPC and retain failed/uncertain state and attempts. | `src/newsletter/newsletterPersistence.js`, `src/newsletter/newsletterPersistence.test.js` | Task 1 | [x] |
| 3 | Preserve issue reuse, completed no-op, token-owned completion, failure transition, email normalization, and explicit retry eligibility. | `src/newsletter/newsletterPersistence.js`, `src/newsletter/newsletterPersistence.test.js` | Task 2 | [x] |
| 4 | Run stateful focused/full tests and replay the migration/claim contract in disposable `supabase-test`. | `src/newsletter/newsletterPersistence.test.js`, `supabase/migrations/20260917200000_newsletter_delivery_claims.sql` | Tasks 1-3 | [x] 6 stateful selectors pass; SQL results and privilege/RLS evidence recorded |

## Blind Review

| Story requirement | Plan coverage |
| --- | --- |
| AC1 issue reuse | Tasks 2-4 assert one issue identity for repeated edition/date assembly. |
| AC2 no duplicate | Tasks 2-4 assert sent/delivered state blocks claim and concurrent conflict has one winner. |
| AC3 failure | Tasks 2-4 retain failed/attempt/error state and distinguish it from completion. |
| AC4 atomic claim | Tasks 1-4 validate migration/RPC conflict and claim-token ownership in isolated state. |
| Eight edge cases | Tasks 2-4 cover reuse, sent retry, failure, retry, concurrent claim, email normalization, section failure, and migration apply. |

## Edge Case Handling

| # | Edge Case | Handling Strategy | Phase |
| --- | --- | --- | --- |
| 1 | Same issue/date twice | Unique issue identity and create-or-reuse path. | Phase 1/2 |
| 2 | Completed delivery retry | Claim RPC returns completed/no-op. | Phase 1/2 |
| 3 | Delivery failure | Store `failed`, attempts, and error; never mark sent. | Phase 2 |
| 4 | Retry after failure | Explicitly eligible failed state may claim again; uncertain claims require operator reconciliation. | Phase 2 |
| 5 | Concurrent claims | Atomic insert/update conflict allows one winner. | Phase 1/2 |
| 6 | Email case/whitespace | Normalize before subscriber identity lookup. | Phase 2 |
| 7 | Section write failure | Issue remains retryable and no duplicate issue is created. | Phase 2 |
| 8 | Existing migration/data | Additive migration defaults legacy rows and preserves identity. | Phase 1/4 |

**Coverage:** 8/8 edge cases handled

## Verification

| AC | Verification | Status |
| --- | --- | --- |
| AC1 | `npm test -- --runInBand -t "newsletter issue reuse"` | Pass |
| AC2 | `npm test -- --runInBand -t "newsletter duplicate"` | Pass |
| AC3 | `npm test -- --runInBand -t "newsletter delivery failure"` | Pass |
| AC4 | Manual isolated migration/RPC replay with recorded SQL results | Pass |

## Definition of Done

- [x] All four ACs pass.
- [x] Eight edge cases are tested/handled.
- [x] Isolated migration/RPC evidence is recorded.
- [x] Full Jest passes with no Resend calls.
- [x] Independent review approves implementation; reviewer-of-record sign-off remains terminal gate.

## Resolved Questions

- Failed/uncertain state is retained until operator reconciliation; no automatic expiry or blind retry.
- Remote migration-ledger alignment is a deployment follow-up, not applied from this story.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added atomic claim/RPC design, failure retention, and isolated migration verification. |
| 2026-09-18 | TDD implementation | Added newsletter claim RPC adapter tests and fail-closed retry state; focused persistence tests pass. |
| 2026-09-18 | OpenCode; agent; v1 | Added stateful reuse/no-op/retry/uncertain tests and auditable SQL/RLS/privilege results. |
| 2026-09-18 | Independent review | Approved stateful persistence coverage and concrete concurrent/token/migration evidence. |
