# TS-01M2T88D: Scheduled Newsletter Edition Cadence

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Epic:** [EP-01M2QXFK: Newsletter Publishing and Delivery](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md)
> **Story:** [US-01M2QX66: Select scheduled newsletter editions](../stories/US-01M2QX66-select-scheduled-newsletter-editions.md)
> **Created:** 2026-09-18
> **Last Updated:** 2026-09-18

## Overview

Hermetic cadence coverage for Eastern-time Sunday, Wednesday, and Friday windows, boundaries, DST, date
keys, and no-due behavior.

## AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
| --- | --- | --- | --- | --- |
| US-01M2QX66 | AC1 | Sunday window selects Devil in the Details. | TC001, TC002 | Pass |
| US-01M2QX66 | AC2 | Wednesday/Friday windows select matching editions. | TC003, TC004 | Pass |
| US-01M2QX66 | AC3 | Outside windows returns no due edition. | TC005, TC006 | Pass |

**Coverage:** 3/3 ACs mapped

## Test Cases

| TC | Case | Expected |
| --- | --- | --- |
| TC001 | Sunday 7:00 AM Eastern | Devil in the Details is due. |
| TC002 | Sunday boundary/DST | 6:59 is not due; 7:00 is due across DST. |
| TC003 | Wednesday noon | Watercooler is due; other editions are not. |
| TC004 | Friday 9:00 AM boundary | 8:59 is not due; 9:00 is due. |
| TC005 | Outside window | Returns an empty due-publication list. |
| TC006 | Repeated date key | Same instant produces stable edition/date identity. |

**Automation:** `src/newsletter/cadence.test.js` with unique `cadence ...` test titles.

## Traceability

| Artefact | Reference |
| --- | --- |
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP-01M2QXFK](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md) |
| Story | [US-01M2QX66](../stories/US-01M2QX66-select-scheduled-newsletter-editions.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added six hermetic cadence cases; all AC selectors pass. |
| 2026-09-18 | Independent review | Approved cadence plan/spec coverage and exact selector execution. |
