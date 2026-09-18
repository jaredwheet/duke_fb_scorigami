# PL-01M2RKYA: Recover final Scorigami media failures

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Story:** [US-01M2QX2Y: Recover final Scorigami media failures](../stories/US-01M2QX2Y-recover-final-scorigami-media-failures.md)
> **Epic:** [EP-01M2QXQF: Reliable X Scorigami Publishing](../epics/EP-01M2QXQF-reliable-x-scorigami-publishing.md)
> **Created:** 2026-09-17
> **Language:** JavaScript ES modules, Node.js 22, Sharp/media adapters

## Overview

Prove the final Scorigami fallback order through the real `run()` orchestration: preferred Wallace Wade
media/upload, deterministic card/upload, then trimmed text-only. Tests inject media and publisher seams;
the default suite never calls OpenAI, Winsipedia logo fetches, X, or a public sink.

## Acceptance Criteria Summary

| AC | Name | Description |
| --- | --- | --- |
| AC1 | Preferred media success | Successful Wallace Wade media reaches the X media publisher and records `final_scorigami_card`. |
| AC2 | Deterministic fallback | Preferred generation/upload failure attempts the deterministic card before text-only. |
| AC3 | Text-only floor | Both media paths failing still publishes verified score/opponent text trimmed to 280. |

---

## Technical Context

- `src/index.js` owns the final Scorigami branch and already has the fallback structure.
- `src/wallaceWadeCard.js` treats OpenAI edit failure as recoverable reference-photo use; card generation/upload failure is the fallback trigger.
- `src/scorigamiCard.js` is deterministic and remains the second media tier.
- `src/twitterClient.js` is mocked; no provider upload/post is allowed in default tests.
- The XNM claim/finalize seam owns publication identity; this story only proves media selection and content type.

## Recommended Approach

**Strategy:** TDD

**Rationale:** The fallback chain is already present but untested at the orchestration boundary. Add failing
tests for each branch and failure, then preserve the smallest existing behavior. Use real deterministic
card generation only for the success path; mock network-dependent Wallace/logo/OpenAI boundaries.

## Implementation Tasks

| # | Task | File | Depends On | Status |
| --- | --- | --- | --- | --- |
| 1 | Add orchestration tests for preferred media success and exact `final_scorigami_card` metadata. | `src/index.test.js`, `src/wallaceWadeCard.test.js` | US-01M2QXNM claim contract | [ ] |
| 2 | Add failure-injection tests for preferred generation/upload, deterministic-card generation/upload, malformed image response, and text-only fallback. | `src/index.test.js`, `src/scorigamiCard.test.js` | Task 1 | [ ] |
| 3 | Add exact 280/281 text-floor tests and verified score/opponent preservation under long opponent names. | `src/index.test.js`, `src/tweetUtils.test.js` | Task 2 | [ ] |
| 4 | Run focused selectors and full Jest; record external sink smoke as deferred because no sink is approved. | `src/index.test.js`, `src/scorigamiCard.test.js` | Tasks 1-3 | [ ] |

### Blind Review

| Story requirement | Plan coverage |
| --- | --- |
| AC1 preferred media | Task 1 invokes the real final branch with injected successful Wallace card/upload and asserts media publisher plus metadata. |
| AC2 deterministic fallback | Task 2 covers generation, upload, malformed response, and preferred-path failures before deterministic fallback. |
| AC3 text-only floor | Tasks 2-3 cover both media failures, exact text, 280 limit, and verified score/opponent retention. |
| Eight edge cases | Tasks 1-3 cover all listed media, malformed, score, limit, no-Scorigami, and metadata failure cases. |
| External side effects | All providers are injected; no approved sink is required for automated acceptance. |

---

## Implementation Phases

### Phase 1: Failing Fallback Tests

- [ ] Add preferred media success and deterministic card output tests with mocked logo/OpenAI boundaries.
- [ ] Add preferred generation/upload/card/upload failure tests through `run()`.
- [ ] Add text-only floor and long-opponent tests.

### Phase 2: Minimal Implementation

- [ ] Preserve isolated fallback try/catch tiers and ensure every successful branch returns provider metadata to claim finalization.
- [ ] Ensure final text is trimmed after season-link/hashtag composition.

### Phase 3: Verification

| AC | Verification | Status |
| --- | --- | --- |
| AC1 | `npm test -- --runInBand -t "preferred media"` | Pass |
| AC2 | `npm test -- --runInBand -t "deterministic media fallback"` | Pass |
| AC3 | `npm test -- --runInBand -t "text-only media floor"` | Pass |

- [x] Run every selector and confirm it selects named tests.
- [x] Run full Jest with no external services.
- [x] Record approved-sink smoke as deferred, never green by assumption.

---

## Edge Case Handling

| # | Edge Case | Handling Strategy | Phase |
| --- | --- | --- | --- |
| 1 | Wallace image generation/upload fails | Catch and attempt deterministic card. | Phase 1/2 |
| 2 | Deterministic card generation/upload fails | Catch and publish text-only. | Phase 1/2 |
| 3 | OpenAI returns malformed/no image | Wallace helper falls back to reference photo; no fabricated overlay. | Phase 1 |
| 4 | Both media paths fail | Text-only publisher remains available with verified score/opponent. | Phase 1/2 |
| 5 | All tiers fail | Error propagates and claim error state remains observable. | Phase 2 |
| 6 | Text exceeds 280 | Trim final composed text before publisher. | Phase 1/2 |
| 7 | Non-Scorigami final | Skip media chain and use ordinary final publisher path. | Phase 1 |
| 8 | Metadata finalization fails | XNM claim remains uncertain; no blind repost. | Phase 2 |
| 9 | Media publisher fails after a successful claim | Record uncertain state and block blind retry. | Phase 2 |
| 10 | Media finalization fails after provider success | Record uncertain state and block blind retry. | Phase 2 |

**Coverage:** 10/10 edge cases handled in the plan

---

## Definition of Done

- [x] All three AC selectors run meaningful tests and pass.
- [x] All ten edge cases have tests or explicit deterministic handling.
- [x] Full Jest passes without external calls.
- [x] Text-only output retains verified score/opponent and stays <=280.
- [x] Independent review and reviewer-of-record sign-off are recorded.

---

## Resolved Questions

- OpenAI edit failure may use the reference photo inside the preferred Wallace helper; deterministic-card fallback is required for preferred generation/upload failure.
- Alerting beyond logs/non-zero failure is deferred to operational deployment work.
- Retry behavior for uncertain publication claims follows XNM at-most-once reconciliation.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-17 | OpenCode; agent; v1 | Added 3-tier fallback TDD phases, 8/8 edge handling, and local-only provider boundaries. |
| 2026-09-17 | OpenCode; agent; v1 | Added fallback/provider failure tests, preferred-media boundary tests, and exact text-floor coverage; all AC selectors pass. |
| 2026-09-17 | Independent code review | Approved implementation after score/opponent-preserving text-floor repair; no blocking findings. |
