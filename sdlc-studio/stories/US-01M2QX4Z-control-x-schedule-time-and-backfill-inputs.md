# US-01M2QX4Z: Control X schedule time and backfill inputs

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/index.js, src/gameUtils.js, src/gameApi.js, .github/workflows/scorigami-schedule.yml, src/index.test.js, src/gameUtils.test.js, src/gameApi.test.js
> **Epic:** EP-01M2QXQF
> **Points:** 3
> **Persona:** Taylor Morgan

## User Story

**As a** Taylor Morgan
**I want** the X job to interpret `FAKE_DATE` and `BACKFILL_DAYS` deterministically, defaulting to 30 days and failing fast on invalid dates
**So that** scheduled and manual runs are reproducible and never publish from an unexpected recovery window.

## Context

### Persona Reference

**Taylor Morgan** - publishing operator, accountable for safe scheduled delivery and recovery; wants explicit inputs and a bounded recovery window before every run.
[Full persona details](../personas/stakeholders/taylor-morgan.md)

### Background

`src/index.js` already resolves `FAKE_DATE` (throwing "Invalid FAKE_DATE" for a bad value) and computes a
recovery window from `BACKFILL_DAYS`, defaulting to `DEFAULT_BACKFILL_DAYS = 30` in
`src/gameUtils.js`. PRD FR-010 requires batch scripts to accept environment-controlled date, backfill,
and edition inputs without source edits, and the manual X dispatch passes `backfill_days`. This story
pins the default, the window boundary, and the fail-fast behavior with focused tests.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Performance | Scheduled jobs run every 15 minutes with a ten-minute timeout. | Backfill evaluation must stay bounded; the window caps work per run. |
| PRD | Operator controls | FR-010: environment-controlled season, date, backfill, edition, and detail inputs without source edits. | AC1/AC2 encode the input contract the workflow and manual dispatch rely on. |
| PRD | Security | Invalid inputs must not reach a publication call. | AC3 requires failing before any provider or publish side effect. |

---

## Acceptance Criteria

### AC1: Default backfill window

- **Given** BACKFILL_DAYS is absent, invalid, or negative,
- **When** the X job chooses its recovery window,
- **Then** it uses the 30-day default.
- **Verify:** shell npm test -- --runInBand -t "backfill"
- **Caller:** `.github/workflows/scorigami-schedule.yml` -> `node src/index.js` (backfill window resolution)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC2: Explicit backfill window

- **Given** BACKFILL_DAYS is a non-negative finite number,
- **When** the X job chooses its recovery window,
- **Then** it recovers only completed games within that number of days from the reference date.
- **Verify:** shell npm test -- --runInBand -t "recovery window"
- **Caller:** `.github/workflows/scorigami-schedule.yml` -> `node src/index.js` (backfill window resolution)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC3: Invalid FAKE_DATE fails fast

- **Given** FAKE_DATE is invalid,
- **When** the job starts,
- **Then** it fails with an explicit invalid-date error before making a publication call.
- **Verify:** shell npm test -- --runInBand -t "Invalid FAKE_DATE"
- **Caller:** `.github/workflows/scorigami-schedule.yml` -> `node src/index.js` (reference-date resolution)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

---

## Scope

### In Scope

- `BACKFILL_DAYS` parsing: absent, non-numeric, negative, zero, and positive finite values.
- Window boundary: only completed games within N days of the reference date are recovered.
- `FAKE_DATE` validation and fail-fast ordering before any publication call.
- `getRecentCompletedDukeGames` / `DEFAULT_BACKFILL_DAYS` behavior in `src/gameUtils.js`.
- Workflow input plumbing for `backfill_days` in `scorigami-schedule.yml`.

### Out of Scope

- Reference-date timezone semantics beyond the current Chicago-time convention.
- Changing the 30-day default value.
- Duplicate-post identity (US-01M2QXNM) or media fallback (US-01M2QX2Y) behavior.
- Other workflows' inputs (ingestion season, newsletter test dates).

---

## Technical Notes

`src/index.js` parses `process.env.BACKFILL_DAYS` with `Number(...)` and falls back to
`DEFAULT_BACKFILL_DAYS` when the result is not a non-negative finite number; `FAKE_DATE` is parsed as
`YYYY-MM-DD` at `T12:00:00Z` and throws `Invalid FAKE_DATE: <value>` when invalid. Keep these as pure,
first-step resolutions so the job aborts before any provider call. `FAKE_DATE` also supplies the schedule
year and reference clock; January and February belong to the prior fall football season. All X workflow
weekday/hour decisions use `America/Chicago`, and `getNextScheduledDukeGame` receives the same reference
time rather than reading the ambient clock. `BACKFILL_DAYS` accepts finite non-negative fractional
durations and clamps values above 365 days to 365. Tests use fixtures with fake dates just inside/outside
the window and invalid strings like `"not-a-date"` and `"2026-13-99"`.

### API Contracts

No inbound API. Internal contracts: `DEFAULT_BACKFILL_DAYS` and `getRecentCompletedDukeGames(...,
{ backfillDays })` in `src/gameUtils.js`; reference-date and window resolution at the top of
`src/index.js`. Workflow contract: `.github/workflows/scorigami-schedule.yml` supplies
`backfill_days` input to the manual dispatch and environment to the scheduled run.

### Data Requirements

- CFBData game fixtures with completion status and dates relative to a fixed reference date.
- No provider credentials for unit tests; the fail-fast path must be provable without network access.
- Workflow file must continue to pass inputs through GitHub Actions inputs/secrets without committing secrets.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| `BACKFILL_DAYS` unset | 30-day default window used. |
| `BACKFILL_DAYS="abc"` or negative | Treated as invalid; 30-day default used. |
| `BACKFILL_DAYS=0` | Window includes only the reference date; no unintended lookback. |
| `BACKFILL_DAYS=365` | Window covers exactly the requested completed-game span; bounded by job timeout risk documented. |
| `FAKE_DATE` malformed string | Job throws "Invalid FAKE_DATE: ..." before any publication call. |
| Game completed exactly at the window edge | Included or excluded deterministically; boundary behavior is documented in the test. |
| Fake date near a season/year boundary | Schedule lookup uses the fake date's season; year-boundary behavior tested and documented. |

---

## Test Scenarios

- [ ] Absent/invalid/negative `BACKFILL_DAYS` yields the 30-day default (jest "backfill").
- [ ] A valid `BACKFILL_DAYS` recovers only completed games within that many days of the reference date (jest "recovery window").
- [ ] Invalid `FAKE_DATE` throws the explicit error before any publication call (jest "Invalid FAKE_DATE").
- [ ] Boundary tests at zero days and at the exact window edge.
- [ ] Assert the manual dispatch `backfill_days` input flows into the workflow environment.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QXNM](US-01M2QXNM-publish-x-updates-with-persisted-identity.md) | Sibling | The window this story computes feeds the publish/no-op evaluation. | Ready |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| GitHub Actions scheduled/manual dispatch | Infrastructure | `scorigami-schedule.yml` present; hosted execution pending. |

---

## Estimation

**Points:** 3
**Complexity:** Low

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/index.js`, `src/gameUtils.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| `scorigami-schedule.yml` input plumbing | `git revert`; next scheduled run uses previous behavior | < 15 min |

---

## Resolved Questions

- A controlled fake date determines the schedule season and clock; January/February dates use the prior fall
  season so bowl/postseason schedules remain discoverable.
- `BACKFILL_DAYS` values above 365 are clamped to 365 to preserve the ten-minute workflow bound; finite
  fractional values are accepted as rolling-day durations.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | Three Amigos refinement | Resolved fake-date season/clock semantics, bounded backfill to 365 days, and added explicit API/workflow test seams. |
| 2026-09-17 | TDD implementation | Added strict date, controlled season/clock, backfill cap, next-game, and workflow input tests; all ACs verify. |
