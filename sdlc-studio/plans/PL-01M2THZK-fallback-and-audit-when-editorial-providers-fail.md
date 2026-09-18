# PL-01M2THZK: Fallback and audit when editorial providers fail

> **Status:** Complete
> **Story:** [US-01M2QXQ7: Fallback when editorial and image providers fail](../stories/US-01M2QXQ7-fallback-when-editorial-and-image-providers-fail.md)
> **Epic:** [EP-01M2QXHW: Constrained Editorial and Media References](../epics/EP-01M2QXHW-constrained-editorial-and-media-references.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1
> **Language:** JavaScript ES modules, SQL migrations, Node.js 22, Jest 30

## Overview

Bound all editorial/discovery provider calls, preserve stable per-section fallback outcomes, guarantee deterministic
repeatability, and persist bounded editorial provenance/rejection audit metadata before external delivery.

## Acceptance Criteria Summary

| AC | Name | Description |
| --- | --- | --- |
| AC1 | No-key fallback | Unset/empty keys make zero provider calls and return validated deterministic sections. |
| AC2 | Partial fallback | Only malformed/rejected sections fall back; healthy sibling output and Q8 reasons survive. |
| AC3 | Bounded timeout | Hanging providers time out without in-process retry and produce stable timeout reasons. |
| AC4 | Repeatability | Identical no-provider inputs produce identical content and section outcomes. |
| AC5 | Audit before send | Append-only bounded audit persists before Resend; audit failure blocks send. |

## Implementation Tasks

| # | Task | File | Status |
| --- | --- | --- | --- |
| 1 | Add stable agent result envelopes, no-key classification, finite timeout, safe provider reason codes, and bounded discovery fetches. | `src/ai/agentClient.js`, five editorial adapters, `src/ai/moments/sourceDiscovery.js`, `src/ai/moments/sourceDiscovery.test.js`, `src/ai/moments/webMomentScout.js` | [x] |
| 2 | Preserve agent failure metadata, select one deterministic fallback per affected section, retain Q8 reasons, and expose safe audit metadata. | `src/ai/orchestrator.js` | [x] |
| 3 | Add append-only audit table with mutation-blocking triggers, bounded typed fields, RLS, and service-role persistence boundary. | `supabase/migrations/20260918180000_newsletter_editorial_audits.sql`, `src/newsletter/newsletterPersistence.js` | [x] |
| 4 | Persist audit after render and before Resend; map provider/delivery errors to allowlisted safe codes and fail closed when audit write fails. | `src/newsletter/sendNewsletter.js`, `src/newsletter/newsletterPersistence.js` | [x] |
| 5 | Add exact no-key/partial/timeout/repeatability/audit tests with provider and persistence doubles, including raw-error leakage negatives and discovery count/text bounds. | `src/ai/orchestrator.test.js`, `src/ai/moments/sourceDiscovery.test.js`, `src/newsletter/sendNewsletterOrchestration.test.js`, `src/newsletter/newsletterPersistence.test.js` | [x] |
| 6 | Run isolated migration/table/mutation evidence, exact selectors, and full Jest without external providers. | Q7 tests and `supabase-test` | [x] 5 selectors; full suite 35 suites/165 tests; production ledger recorded |

## Edge Case Handling

| Edge | Strategy |
| --- | --- |
| Unset/empty/whitespace key | Skip discovery and agent provider calls; use `provider_not_configured`. |
| Malformed JSON/no content | Classify `malformed_response`; fallback only that section. |
| Provider error | Classify `provider_error`; do not persist raw error body. |
| Hanging provider | Race against finite timeout; classify `provider_timeout`; no in-process retry. |
| Audit insert failure | Fail before Resend and mark delivery retryable through existing send boundary. |
| Audit mutation/raw payload | SQL checks cap attempts, section/warning JSON shape and size; unique `(delivery_id, attempt)` plus current-attempt linkage prevents duplicate/stale audit rows; triggers reject update/delete; app stores only allowlisted metadata. |
| Repeat fallback | Compare full safe editorial result and section reason/disposition metadata across runs. |
| Discovery resource bounds | Cap configured source count at 5, Reddit results at 12, and fetched excerpts at 4,000 characters. |
| Unknown adapter error | Map to `provider_error`; never expose raw error/prompt/response content. |

**Coverage:** 6/6 listed interactions handled

## Verification

| AC | Selector | Status |
| --- | --- | --- |
| AC1 | `npm test -- --runInBand src/ai/orchestrator.test.js -t "^Q7 AC1 unset-or-empty OpenAI key makes editorial orchestration perform zero provider calls$"` | Pass |
| AC2 | `npm test -- --runInBand src/ai/orchestrator.test.js -t "^Q7 AC2 malformed partial section falls back while valid sibling sections remain provider output$"` | Pass |
| AC3 | `npm test -- --runInBand src/ai/orchestrator.test.js -t "^Q7 EDGE provider timeout is bounded, falls back per section, and preserves the provider warning$"` | Pass |
| AC4 | `npm test -- --runInBand src/ai/orchestrator.test.js -t "^Q7 EDGE deterministic editorial fallback is identical across repeated runs$"` | Pass |
| AC5 | `npm test -- --runInBand src/newsletter/sendNewsletterOrchestration.test.js -t "^Q7 AC5 editorial audit persists before provider send and audit failure blocks send$"` | Pass; migration evidence recorded |

## Definition of Done

- [x] All five exact selectors and full Jest pass.
- [x] Current audit migration/table boundary is replayed in disposable `supabase-test`, including RLS/service-role grants, bounds, trigger rejection, and retry issue/delivery linkage.
- [x] No provider credentials or raw provider content are logged/persisted.
- [x] Independent plan/delivery reviews approve; reviewer-of-record sign-off remains terminal.

## Resolved Questions

- Timeout is 30 seconds by default, configurable to a smaller test value, with no in-process retry.
- Q2Y owns image/card fallback; Q7 does not touch image code.
- Audit records are append-only, bounded, and written before Resend; raw prompts/responses/secrets are excluded.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added five ACs, bounded timeout, stable provider reasons, and pre-send audit migration phases. |
| 2026-09-18 | TDD implementation | Added bounded provider/discovery calls, safe error envelopes, append-only audit persistence, migration evidence, and exact Q7 selectors. |
| 2026-09-18 | Independent review | Approved Q7 after discovery warning propagation and audit attempt/linkage hardening. |
