# PL-01M2RDQ1: Control X schedule time and backfill inputs

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Story:** [US-01M2QX4Z: Control X schedule time and backfill inputs](../stories/US-01M2QX4Z-control-x-schedule-time-and-backfill-inputs.md)
> **Epic:** [EP-01M2QXQF: Reliable X Scorigami Publishing](../epics/EP-01M2QXQF-reliable-x-scorigami-publishing.md)
> **Created:** 2026-09-17
> **Language:** JavaScript ES modules, GitHub Actions YAML, Node.js 22

## Overview

Make the X workflow consume one controlled reference instant for timezone window checks, schedule season,
next-game selection, and backfill filtering. Strictly validate date-only inputs, accept finite fractional
backfill durations, clamp values above 365 days, and expose `fake_date` through manual workflow dispatch.

## Acceptance Criteria Summary

| AC | Name | Description |
| --- | --- | --- |
| AC1 | Default backfill window | Missing/invalid/negative inputs use the 30-day default. |
| AC2 | Explicit backfill window | Valid values include only completed complete-score games within the controlled rolling window. |
| AC3 | Invalid date fail-fast | Invalid calendar dates fail before provider/publication calls. |

---

## Technical Context

- `src/index.js` owns reference-date parsing, season selection, workflow clock, and environment resolution.
- `src/gameApi.js` owns schedule loading and must accept an explicit reference time for next-game selection.
- `src/gameUtils.js` owns the bounded completed-game filter and default duration.
- `.github/workflows/scorigami-schedule.yml` owns manual `fake_date`/`backfill_days` plumbing.
- `America/Chicago` is the single timezone for weekday/hour/date-key scheduling decisions; rendered content may use its existing display timezone.
- January and February use the prior fall football season (`year - 1`); all other months use the calendar year.

---

## Recommended Approach

**Strategy:** TDD

**Rationale:** Existing helpers are mostly implemented but the workflow has ambient-clock and season gaps.
Write deterministic tests around pure input/selection functions and the real `run()` boundary first, then
make the smallest clock/season/workflow changes.

### Implementation Tasks

| # | Task | File | Depends On | Status |
| --- | --- | --- | --- | --- |
| 1 | Add strict fake-date, season, timezone, and backfill parsing/window tests, including DST/year boundaries and exact cutoff behavior. | `src/index.test.js`, `src/gameUtils.test.js`, `src/gameApi.test.js` | None | [x] |
| 2 | Make `getNextScheduledDukeGame(games, now)` use the supplied instant and make `run()` pass one controlled reference instant/season through every schedule decision. | `src/gameApi.js`, `src/index.js` | Task 1 | [x] |
| 3 | Enforce strict `YYYY-MM-DD` calendar validation, `America/Chicago` scheduling predicates, prior-fall January/February season selection, 365-day clamp, and workflow `fake_date` input plumbing. | `src/index.js`, `.github/workflows/scorigami-schedule.yml` | Tasks 1-2 | [x] |
| 4 | Run all named selectors and full Jest; assert invalid date fails before any adapter/publication call and workflow YAML carries the manual input. | `src/index.test.js`, `src/gameUtils.test.js`, `src/gameApi.test.js` | Tasks 1-3 | [x] 3 AC verifiers pass; full suite 31 suites/125 tests |

### Blind Review

| Story requirement | Plan coverage |
| --- | --- |
| AC1 default window | Tasks 1 and 4 cover absent, empty, nonnumeric, negative, infinity, and >365 inputs. |
| AC2 explicit window | Tasks 1-3 cover zero, fractional, exact-boundary, future, incomplete, malformed-date, and ordering cases. |
| AC3 fail-fast date | Tasks 1, 3, and 4 assert strict calendar validation before provider/publication adapters. |
| Seven edge cases | All seven story edge cases map to Tasks 1-3. |
| Workflow contract | Task 3/4 asserts manual `fake_date` and `backfill_days` plumbing without secrets or external calls. |

---

## Implementation Phases

### Phase 1: TDD Input and Clock Contract

- [x] Add tests for strict date parsing, season year boundaries, Chicago Wednesday/noon boundaries, explicit backfill values, and exact window inclusion.
- [x] Add `getNextScheduledDukeGame(games, now)` and `run({ now, games, adapters })` contract tests.

### Phase 2: Minimal Implementation

- [x] Make the supplied reference instant authoritative for weekday/hour, date key, next-game cutoff, and schedule season.
- [x] Clamp `BACKFILL_DAYS` at 365 while preserving finite fractional durations and the 30-day fallback.
- [x] Add manual `fake_date` workflow input and pass it to the job environment.

### Phase 3: Verification

| AC | Verification | Status |
| --- | --- | --- |
| AC1 | `npm test -- --runInBand -t "backfill"` | Pass |
| AC2 | `npm test -- --runInBand -t "recovery window"` | Pass |
| AC3 | `npm test -- --runInBand -t "Invalid FAKE_DATE"` | Pass |

- [x] Verify each selector runs at least one named test.
- [x] Run full Jest and workflow YAML contract assertions.
- [x] Do not run a live GitHub/X job; manual hosted validation is operator-authorized follow-up.

---

## Edge Case Handling

| # | Edge Case | Handling Strategy | Phase |
| --- | --- | --- | --- |
| 1 | BACKFILL_DAYS unset | Use 30-day default. | Phase 1/2 |
| 2 | BACKFILL_DAYS invalid/negative | Use 30-day default. | Phase 1/2 |
| 3 | BACKFILL_DAYS zero/fractional/over-365 | Use rolling duration; accept fractional values; clamp above 365. | Phase 1/2 |
| 4 | Invalid FAKE_DATE | Reject malformed and normalized calendar dates before adapters. | Phase 1/2 |
| 5 | Exact window boundary | Include timestamps at cutoff and exclude just-before-cutoff according to the documented rolling instant. | Phase 1 |
| 6 | Season/year boundary | January/February use prior fall season; all other dates use calendar year. | Phase 1/2 |
| 7 | Chicago/DST boundary | Use one `America/Chicago` instant for weekday/hour and next-game comparisons. | Phase 1/2 |

**Coverage:** 7/7 edge cases handled in the plan

---

## Definition of Done

- [x] All three AC selectors run meaningful tests and pass.
- [x] All seven edge cases are tested or explicitly handled.
- [x] Full Jest passes.
- [x] Workflow YAML input contract is tested.
- [x] No provider or X call occurs on invalid date.
- [x] Independent review and reviewer-of-record sign-off are recorded.

---

## Resolved Questions

- `FAKE_DATE` uses `America/Chicago` for scheduling and determines season: January/February use the prior fall season.
- `BACKFILL_DAYS` accepts finite non-negative fractional durations and clamps values above 365.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-17 | OpenCode; agent; v1 | Added controlled-clock, season, strict-date, bounded-backfill, and workflow-input TDD phases. |
| 2026-09-17 | OpenCode; agent; v1 | Implemented controlled clock/season, strict dates, backfill cap, next-game, and workflow input tests; all AC selectors and full suite pass. |
| 2026-09-17 | Independent code review | Approved the implementation with no blocking findings; final suite 31 suites/125 tests pass. |
| 2026-09-17 | OpenCode; agent; v1 | Implemented controlled clock/season, strict dates, bounded backfill, and workflow input tests; all AC selectors pass. |
