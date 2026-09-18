# TS-01M2THEP: Editorial Provider Fallback and Audit Safety

> **Status:** Complete
> **Epic:** [EP-01M2QXHW: Constrained Editorial and Media References](../epics/EP-01M2QXHW-constrained-editorial-and-media-references.md)
> **Story:** [US-01M2QXQ7: Fallback when editorial and image providers fail](../stories/US-01M2QXQ7-fallback-when-editorial-and-image-providers-fail.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1

## AC Coverage Matrix

| AC | Description | Test Cases | Status |
| --- | --- | --- | --- |
| AC1 | No-key editorial fallback and zero provider calls. | TC001 | Pass |
| AC2 | Partial malformed/rejected section fallback. | TC002 | Pass |
| AC3 | Bounded provider timeout and stable reason. | TC003 | Pass |
| AC4 | Deterministic repeatability. | TC004 | Pass |
| AC5 | Pre-send append-only audit and fail-closed audit errors. | TC005, TC006 | Pass |

**Coverage:** 5/5 ACs mapped.

## Test Cases

| TC | Case | Expected |
| --- | --- | --- |
| TC001 | Key unset, empty, and whitespace | Zero chat/response/discovery calls; five deterministic sections; provider-not-configured outcomes. |
| TC002 | One malformed provider section plus valid siblings | Only malformed section falls back; sibling sentinel remains; Q8 and provider reason codes persist. |
| TC003 | Never-resolving provider | Returns within injected timeout; no retry; section has `provider_timeout`. |
| TC004 | Two identical no-provider runs | Safe editorial copy, section dispositions, and stable reasons are equal. |
| TC005 | Audit before provider | Audit insert occurs before Resend; bounded metadata contains no raw provider content and records issue/delivery/attempt linkage. |
| TC006 | Audit insert failure | Resend is not called and send path returns a retryable failure; isolated SQL evidence proves RLS, service-role grant, bounds, and update/delete trigger rejection. |
| TC007 | Discovery resource bounds | Five configured URLs maximum, twelve Reddit results maximum, and each fetched excerpt is at most 4,000 characters. |
| TC008 | Safe error mapping | Unknown agent/discovery errors become allowlisted `provider_error`/`provider_timeout`/`malformed_response` codes with no raw error text. |

**Automation:** `src/ai/orchestrator.test.js`, `src/newsletter/sendNewsletterOrchestration.test.js`, and `src/newsletter/newsletterPersistence.test.js`; no live providers.

## Environment

| Requirement | Details |
| --- | --- |
| Prerequisites | Node.js 22, Jest 30, mocked Resend/OpenAI, Supabase-shaped doubles, disposable `supabase-test`. |
| External Services | None in default tests; migration/table evidence is isolated. |
| Test Data | Identical issue packets, malformed/timeout provider envelopes, valid sibling output, audit metadata. |

## Automation Status

| TC | Status | Implementation |
| --- | --- | --- |
| TC001-TC008 | Automated/isolated complete | Q7 AI/discovery/newsletter tests and production/test migration replay |

## Traceability

| Artefact | Reference |
| --- | --- |
| Epic | [EP-01M2QXHW](../epics/EP-01M2QXHW-constrained-editorial-and-media-references.md) |
| Story | [US-01M2QXQ7](../stories/US-01M2QXQ7-fallback-when-editorial-and-image-providers-fail.md) |
| Plan | [PL-01M2THZK](../plans/PL-01M2THZK-fallback-and-audit-when-editorial-providers-fail.md) |

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added exact non-vacuous no-key, partial, timeout, repeatability, and audit cases. |
| 2026-09-18 | OpenCode; agent; v1 | All Q7 cases pass; discovery bounds, safe errors, and audit linkage evidence are recorded. |
