# PL-01M2T866: Select scheduled newsletter editions

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Story:** [US-01M2QX66: Select scheduled newsletter editions](../stories/US-01M2QX66-select-scheduled-newsletter-editions.md)
> **Epic:** [EP-01M2QXFK: Newsletter Publishing and Delivery](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md)
> **Created:** 2026-09-18
> **Language:** JavaScript ES modules, Node.js 22

## Overview

Pin the three Eastern-time publication windows, exact opening boundaries, DST behavior, date keys, and
no-due behavior with pure cadence tests. No persistence/provider work belongs in this story.

## Acceptance Criteria Summary

| AC | Name | Description |
| --- | --- | --- |
| AC1 | Sunday window | Sunday 7:00 AM Eastern selects Devil in the Details. |
| AC2 | Midweek windows | Wednesday noon and Friday 9:00 AM Eastern select their editions. |
| AC3 | No due edition | Outside all windows returns no publication. |

---

## Recommended Approach

**Strategy:** TDD

Add uniquely named tests for each edition, before/at/after boundaries, off-window, DST, and date key.
The existing pure cadence implementation should require only test/documentation changes unless a boundary
failure appears.

## Implementation Tasks

| # | Task | File | Depends On | Status |
| --- | --- | --- | --- | --- |
| 1 | Add Sunday, Wednesday, Friday, boundary, DST, and no-due tests with unique AC selectors. | `src/newsletter/cadence.test.js` | None | [x] |
| 2 | Preserve/adjust pure Eastern-time cadence only if a test exposes a defect; keep no service imports. | `src/newsletter/cadence.js` | Task 1 | [x] Existing implementation passes |
| 3 | Run focused AC selectors and full Jest; record cadence key logging as non-blocking send-entrypoint follow-up. | `src/newsletter/cadence.test.js` | Tasks 1-2 | [x] 3 AC verifiers pass |

### Blind Review

| Story requirement | Plan coverage |
| --- | --- |
| AC1 Sunday window | Tasks 1-3 include opening, inside, before, and DST fixtures. |
| AC2 Wednesday/Friday | Tasks 1-3 include both exact windows and boundaries. |
| AC3 no due | Task 1 includes off-window dates and empty output. |
| Six edge cases | All listed cadence edges have named cases. |

## Implementation Phases

### Phase 1: Cadence TDD

- [x] Add unique Sunday, Wednesday, Friday, boundary, DST, no-due, and repeated-key tests.
- [x] Keep cadence pure and timezone-explicit.

### Phase 2: Verification

| AC | Verification | Status |
| --- | --- | --- |
| AC1 | `npm test -- --runInBand -t "cadence Sunday window"` | Pass |
| AC2 | `npm test -- --runInBand -t "cadence Wednesday Friday"` | Pass |
| AC3 | `npm test -- --runInBand -t "cadence no due"` | Pass |

- [x] Run every selector and full Jest.
- [x] Do not contact providers or databases.

## Edge Case Handling

| # | Edge Case | Handling Strategy | Phase |
| --- | --- | --- | --- |
| 1 | Exact window opening | Include publication at target minute. | Phase 1 |
| 2 | One minute before | Return no due edition. | Phase 1 |
| 3 | Outside all windows | Return empty list. | Phase 1 |
| 4 | DST Sunday | Use `America/New_York` formatter and known UTC fixtures. | Phase 1 |
| 5 | Repeated run | Return stable edition/date key; persistence owns duplicate prevention. | Phase 1 |
| 6 | Invalid reference input | Preserve caller date convention and avoid throwing inside pure cadence. | Phase 1 |

**Coverage:** 6/6 edge cases handled

## Definition of Done

- [x] All three selectors match named tests.
- [x] DST and boundary cases pass.
- [x] Full Jest passes.
- [x] Independent review approves implementation; reviewer-of-record sign-off remains the terminal gate.

## Resolved Questions

- The configured cadence is contractual; game weekday changes do not alter windows.
- Send-entrypoint selection logging is non-blocking follow-up; cadence remains pure.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added unique cadence selectors, DST/boundary cases, and no-due coverage. |
| 2026-09-18 | Independent code review | Approved cadence implementation after invalid-reference fallback and boundary repairs. |
| 2026-09-18 | TDD implementation | Added cadence window/boundary/DST tests; all AC selectors pass. |
