# US-01M2QX66: Select scheduled newsletter editions

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/newsletter/cadence.js, src/newsletter/cadence.test.js
> **Epic:** EP-01M2QXFK
> **Points:** 3
> **Persona:** Avery Brooks

## User Story

**As a** Avery Brooks
**I want** the cadence to select the correct edition from the configured Eastern-time publication windows
**So that** each newsletter arrives on the promised weekday cadence without unintended sends.

## Context

### Persona Reference

**Avery Brooks** - Duke football follower, the served reader; wants a newsletter on the promised cadence without duplicates or stale-looking facts.
[Full persona details](../personas/stakeholders/avery-brooks.md)

### Background

`src/newsletter/cadence.js` defines `PUBLICATIONS` (Sunday Devil in the Details 7:00 AM, Wednesday
Wallace Wade Watercooler noon, Friday Victory Bell Bulletin 9:00 AM) in `America/New_York`, and
`getDuePublications`/`publicationDateKey` answer "what is due from this reference date". PRD FR-005
requires the scheduler to select the edition from the configured Eastern-time cadence and support a
deterministic test date. This story pins the window selection and the no-due-edition behavior.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Performance | Scheduled delivery runs every 15 minutes with a ten-minute timeout. | Cadence evaluation must be pure and cheap; no network work. |
| PRD | Functional | FR-005: cadence selects the edition from the configured Eastern-time cadence and supports a deterministic test date. | AC1/AC2 encode the exact windows; tests use injected reference dates. |
| PRD | Security | No unintended delivery from the default path. | AC3 requires no-due-edition to mean no send. |

---

## Acceptance Criteria

### AC1: Sunday edition window

- **Given** a reference date in the Sunday 7:00 AM Eastern publication window,
- **When** cadence is evaluated,
- **Then** it selects the Devil in the Details edition.
- **Verify:** shell npm test -- --runInBand -t "cadence Sunday window"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js -> getDuePublications/publicationDateKey)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC2: Wednesday and Friday windows

- **Given** a reference date in the Wednesday noon or Friday 9:00 AM Eastern publication window,
- **When** cadence is evaluated,
- **Then** it selects the matching Watercooler or Victory Bell Bulletin edition.
- **Verify:** shell npm test -- --runInBand -t "cadence Wednesday Friday"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js -> getDuePublications/publicationDateKey)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC3: Outside a window, nothing is due

- **Given** a reference date outside a publication window,
- **When** cadence is evaluated,
- **Then** it returns no due edition and does not schedule an unintended send.
- **Verify:** shell npm test -- --runInBand -t "cadence no due"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js -> getDuePublications/publicationDateKey)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

---

## Scope

### In Scope

- The three publication windows in Eastern time with their exact weekday/hour/minute definitions.
- `getDuePublications`/`publicationDateKey` selection from a reference date.
- No-due-edition behavior and the deterministic test date path.
- Boundary coverage around window edges (daylight saving transitions included).

### Out of Scope

- Edition data assembly and rendering (US-01M2QXAG).
- Issue/delivery persistence (US-01M2QX6F) and send/recipient separation (US-01M2QXFG).
- Changing the published cadence or adding editions.
- Timezone changes away from `America/New_York`.

---

## Technical Notes

`cadence.js` is already pure and timezone-explicit (`NEWSLETTER_TIME_ZONE = 'America/New_York'`).
Tests must inject reference dates rather than reading the clock, and must cover each window's opening
instant, a point inside the window, and a point just outside, plus DST-transition weeks where the UTC
offset differs. Keep the module free of Supabase or provider imports so the 15-minute scheduled job can
evaluate cadence instantly.

### API Contracts

No inbound API. Internal contract: `getDuePublications(referenceDate)` and
`publicationDateKey(publication)` in `src/newsletter/cadence.js`, consumed by
`src/newsletter/sendNewsletter.js` (entrypoint `npm run newsletter:send`).

### Data Requirements

- Fixed reference-date fixtures per window (Sunday 7:00 AM ET, Wednesday noon ET, Friday 9:00 AM ET) and off-window dates.
- DST boundary dates (second Sunday in March, first Sunday in November) for offset coverage.
- No database or provider access required.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Reference date exactly at window opening | Edition is due. |
| Reference date one minute before opening | Not due. |
| Reference date outside all windows (e.g. Tuesday) | No due edition returned; send path does nothing. |
| DST transition Sunday | Sunday 7:00 AM ET resolves to the correct UTC instant regardless of offset. |
| Run repeats within the same window | Same edition/date key returned; duplicate prevention is persistence's job (US-01M2QX6F). |
| Missing/invalid reference date input | Behavior documented; falls back to the caller's date convention without throwing mid-send. |

---

## Test Scenarios

- [ ] Sunday 7:00 AM ET reference date selects Devil in the Details (jest "Sunday").
- [ ] Wednesday noon and Friday 9:00 AM ET reference dates select Watercooler and Victory Bell Bulletin (jest "Watercooler").
- [ ] Off-window reference date returns no due edition (jest "due").
- [ ] Window boundary one-minute-before/at/after tests.
- [ ] DST transition-week resolution tests.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QXAG](US-01M2QXAG-render-fact-backed-newsletter-editions-safely.md) | Downstream | The selected edition drives which renderer runs. | Draft |
| [US-01M2QX6F](US-01M2QX6F-persist-newsletter-issues-and-deliveries-idempotently.md) | Downstream | The edition/date key this story computes is the issue identity. | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| `.github/workflows/newsletter.yml` | Operational | Present; runs `npm run newsletter:send` on schedule. |

---

## Estimation

**Points:** 3
**Complexity:** Low

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/newsletter/cadence.js` | `git revert` the story commit and re-run `npm test` | < 15 min |

---

## Resolved Questions

- The configured Sunday/Wednesday/Friday cadence is contractual; a game moving weekdays does not change
  publication windows without a requirements revision.
- The send entrypoint logs selected edition keys and issue dates whenever an edition is due; no separate
  persistence or provider work belongs in cadence.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | Three Amigos refinement | Replaced broad/vacuous selectors with unique cadence verifiers and resolved cadence/logging questions. |
| 2026-09-18 | TDD implementation | Added unique cadence/DST/boundary/no-due coverage; all three ACs verify. |
