# TS-01M2RDQ4: Deterministic X Schedule and Backfill Inputs

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Epic:** [EP-01M2QXQF: Reliable X Scorigami Publishing](../epics/EP-01M2QXQF-reliable-x-scorigami-publishing.md)
> **Story:** [US-01M2QX4Z: Control X schedule time and backfill inputs](../stories/US-01M2QX4Z-control-x-schedule-time-and-backfill-inputs.md)
> **Created:** 2026-09-17
> **Last Updated:** 2026-09-17

## Overview

This spec tests one controlled reference instant across the X workflow, schedule season selection,
next-game cutoff, rolling backfill window, strict date validation, and GitHub Actions input plumbing.
No provider or X credentials are used.

## Scope

### Stories Covered

| Story | Title | Priority |
| --- | --- | --- |
| [US-01M2QX4Z](../stories/US-01M2QX4Z-control-x-schedule-time-and-backfill-inputs.md) | Control X schedule time and backfill inputs | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
| --- | --- | --- | --- | --- |
| US-01M2QX4Z | AC1 | Invalid/absent/negative values use 30-day default. | TC001, TC002, TC003 | Automated; focused selector passes |
| US-01M2QX4Z | AC2 | Valid values filter completed games by the controlled window. | TC004, TC005, TC006, TC007 | Automated; focused selector passes |
| US-01M2QX4Z | AC3 | Invalid dates fail before any adapter/publication call. | TC008, TC009 | Automated; focused selector passes |

**Coverage:** 3/3 ACs mapped to test cases; all cases are automated and full Jest passes (31 suites, 125 tests).

### Test Types Required

| Type | Required | Rationale |
| --- | --- | --- |
| Unit | Yes | Date parsing, season, and window filtering are deterministic helpers. |
| Integration | Yes | Workflow orchestration must pass one reference instant/season through adapter boundaries. |
| E2E | No | Hosted GitHub/X execution is explicitly not part of the default suite. |

---

## Environment

| Requirement | Details |
| --- | --- |
| Prerequisites | Node.js 22, Jest 30, injected game/provider/publisher adapters, repository workflow YAML. |
| External Services | None in default tests; no CFBData, Supabase, GitHub, or X calls. |
| Test Data | Dates across DST, January/February season boundary, zero/fractional/365/over-365 windows, incomplete games, and malformed dates. |

## Test Cases

### TC001: Default backfill inputs

**Type:** Unit | **Priority:** High | **Story:** US-01M2QX4Z AC1

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | BACKFILL_DAYS is absent, empty, nonnumeric, negative, or Infinity. | Resolver receives invalid/default inputs. |
| When | The workflow resolves its recovery window. | It uses 30 days. |
| Then | Inspect selected games. | No invalid value expands or suppresses the default window. |

**Automation:** `src/index.test.js` title includes `backfill`.

---

### TC002: Explicit bounded backfill values

**Type:** Unit | **Priority:** High | **Story:** US-01M2QX4Z AC1/AC2

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | BACKFILL_DAYS is 0, 1.5, 30, and 365. | Each value is finite and non-negative. |
| When | The recovery window is computed. | The exact rolling duration is used. |
| Then | Use 366/1000 as inputs. | Values above 365 clamp to 365. |

**Automation:** `src/index.test.js` title includes `backfill`.

---

### TC003: Strict FAKE_DATE validation

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QX4Z AC3

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | FAKE_DATE is `not-a-date`, `2026-13-99`, `2026-02-30`, or malformed format. | The date parser rejects it. |
| When | `run()` starts with adapters that would fail if called. | It throws `Invalid FAKE_DATE` before any adapter/publication call. |
| Then | Inspect calls. | Game loading, venue lookup, database, media, and X publisher are untouched. |

**Automation:** `src/index.test.js` title includes `Invalid FAKE_DATE`.

---

### TC004: Exact rolling window boundary

**Type:** Unit | **Priority:** High | **Story:** US-01M2QX4Z AC2 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Reference instant is 2026-09-16T17:00Z and games sit exactly at, just before, and after the cutoff. | Games include completion and complete scores. |
| When | `getRecentCompletedDukeGames` runs with 30 days. | Exact cutoff is included; earlier/future games are excluded. |
| Then | Inspect order. | Results are chronological and bounded. |

**Automation:** `src/gameUtils.test.js` title includes `recovery window`.

---

### TC005: Incomplete/future/malformed games excluded

**Type:** Unit | **Priority:** High | **Story:** US-01M2QX4Z AC2 edge cases

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Fixtures include incomplete scores, uncompleted games, malformed dates, and future games. | Only completed complete-score valid-date games remain. |
| When | The recovery filter runs. | Invalid candidates are excluded without throwing. |
| Then | Inspect output. | No publication candidate is produced for excluded games. |

**Automation:** `src/gameUtils.test.js`.

---

### TC006: Controlled schedule season

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QX4Z AC2 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Controlled dates in September 2026 and January 2027. | The season resolver receives the same reference instant as the workflow. |
| When | Schedule loading and next-game selection run. | September uses season 2026; January uses prior fall season 2026, and next-game cutoff uses the supplied instant. |
| Then | Inspect adapter calls. | No ambient `new Date()` or runner year is used. |

**Automation:** `src/index.test.js`, `src/gameApi.test.js`.

---

### TC007: Chicago timezone/DST boundary

**Type:** Unit/orchestration | **Priority:** Medium | **Story:** US-01M2QX4Z edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Wednesday instants around daylight-saving transitions and Chicago noon boundaries. | Weekday and hour are evaluated in `America/Chicago`. |
| When | The pregame branch checks the window. | Both predicates use the same timezone and instant. |
| Then | Inspect next-game adapter input. | The reference instant is unchanged and deterministic. |

**Automation:** `src/index.test.js`.

---

### TC008: Workflow dispatch plumbing

**Type:** Unit/static | **Priority:** Medium | **Story:** US-01M2QX4Z AC1/AC2

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | `.github/workflows/scorigami-schedule.yml` is read as text. | Manual `fake_date` and `backfill_days` inputs exist. |
| When | Workflow env mapping is inspected. | Both inputs are passed to the Node job; secrets and timeout/concurrency remain intact. |
| Then | Inspect source. | No secret or external call is introduced by the test. |

**Automation:** `src/index.test.js` workflow contract test.

---

### TC009: Zero-day and year-boundary behavior

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QX4Z edge cases

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Zero-day and January/February references with games at calendar boundaries. | Date and season rules are explicit. |
| When | Filter/season helpers run. | Only the reference-day rolling window is included and prior-fall season is selected for Jan/Feb. |
| Then | Inspect results. | No year-boundary or zero-window drift occurs. |

**Automation:** `src/gameUtils.test.js`, `src/index.test.js`.

---

## Automation Status

| TC | Title | Status | Implementation |
| --- | --- | --- | --- |
| TC001 | Default backfill inputs | Automated | `src/index.test.js` |
| TC002 | Explicit bounded backfill values | Automated | `src/index.test.js` |
| TC003 | Strict FAKE_DATE validation | Automated | `src/index.test.js` |
| TC004 | Exact rolling window boundary | Automated | `src/gameUtils.test.js` |
| TC005 | Incomplete/future/malformed games excluded | Automated | `src/gameUtils.test.js` |
| TC006 | Controlled schedule season | Automated | `src/index.test.js`, `src/gameApi.test.js` |
| TC007 | Chicago timezone/DST boundary | Automated | `src/index.test.js` |
| TC008 | Workflow dispatch plumbing | Automated | `src/index.test.js` |
| TC009 | Zero-day and year-boundary behavior | Automated | `src/gameUtils.test.js`, `src/index.test.js` |

---

## Traceability

| Artefact | Reference |
| --- | --- |
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP-01M2QXQF](../epics/EP-01M2QXQF-reliable-x-scorigami-publishing.md) |
| Story | [US-01M2QX4Z](../stories/US-01M2QX4Z-control-x-schedule-time-and-backfill-inputs.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-17 | OpenCode; agent; v1 | Added 9 cases for default/explicit inputs, strict dates, season, timezone, boundary, and workflow contracts. |
| 2026-09-17 | OpenCode; agent; v1 | Automated controlled-clock and workflow input cases; all AC selectors and full Jest pass. |
