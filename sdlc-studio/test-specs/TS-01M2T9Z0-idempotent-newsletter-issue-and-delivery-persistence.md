# TS-01M2T9Z0: Idempotent Newsletter Issue and Delivery Persistence

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Epic:** [EP-01M2QXFK: Newsletter Publishing and Delivery](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md)
> **Story:** [US-01M2QX6F: Persist newsletter issues and deliveries idempotently](../stories/US-01M2QX6F-persist-newsletter-issues-and-deliveries-idempotently.md)
> **Created:** 2026-09-18
> **Last Updated:** 2026-09-18

## Overview

Hermetic state-machine coverage for newsletter issue reuse, atomic delivery claims, completed no-resend,
failed retry state, email normalization, and isolated migration/RPC behavior.

## AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
| --- | --- | --- | --- | --- |
| US-01M2QX6F | AC1 | Issue/date identity is reused. | TC001, TC002 | Pass |
| US-01M2QX6F | AC2 | Completed delivery is not sent twice. | TC003, TC004 | Pass |
| US-01M2QX6F | AC3 | Failure state remains observable/retryable. | TC005, TC006, TC007 | Pass |
| US-01M2QX6F | AC4 | Atomic claim/token state has one winner. | TC008, TC009 | Pass |

**Coverage:** 4/4 ACs mapped; automated persistence/orchestration tests and isolated migration evidence pass.

## Test Cases

| TC | Case | Expected |
| --- | --- | --- |
| TC001 | Same issue/date twice | One issue identity is reused. |
| TC002 | Section update on reused issue | Existing issue can be updated without a duplicate. |
| TC003 | Completed delivery retry | Sent/delivered state produces no second claim/send. |
| TC004 | Concurrent delivery claims | One claim wins; loser observes existing state. |
| TC005 | Failed delivery state | Failed status, attempt count, and error persist. |
| TC006 | Retry after failed state | Explicitly retryable failure can claim again; uncertain state cannot auto-retry. |
| TC007 | Email normalization | Case/whitespace variants resolve to one subscriber identity. |
| TC008 | Migration defaults/uniqueness | Existing rows default correctly and issue/subscriber keys remain unique. |
| TC009 | Token-owned RPC transitions | Wrong token updates zero rows; correct token completes/fails. |

**Automation:** TC001-TC007 use stateful `newsletterPersistence.test.js` and `sendNewsletterOrchestration.test.js`; TC008-TC009 use manual disposable `supabase-test` replay plus recorded SQL/RLS/privilege assertions.

## Environment

| Requirement | Details |
| --- | --- |
| Prerequisites | Node.js 22, Jest 30, stateful Supabase-shaped double, disposable `supabase-test` database. |
| External Services | None; no Resend or recipient is used. |
| Test Data | Existing posted issue/delivery rows, claimed/failed/uncertain states, normalized email variants. |

## Automation Status

| TC | Status | Implementation |
| --- | --- | --- |
| TC001-TC007 | Automated stateful | `src/newsletter/newsletterPersistence.test.js`, `src/newsletter/sendNewsletterOrchestration.test.js` |
| TC008-TC009 | Manual isolated complete | `supabase-test` migration/RPC replay and AC4 SQL evidence |

## Traceability

| Artefact | Reference |
| --- | --- |
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP-01M2QXFK](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md) |
| Story | [US-01M2QX6F](../stories/US-01M2QX6F-persist-newsletter-issues-and-deliveries-idempotently.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added nine state/migration cases. |
| 2026-09-18 | OpenCode; agent; v1 | Automated persistence/orchestration cases and recorded isolated claim/retry evidence. |
| 2026-09-18 | OpenCode; agent; v1 | Replaced static claim assertions with stateful reuse/no-op/retry/uncertain cases and recorded SQL/RLS evidence. |
