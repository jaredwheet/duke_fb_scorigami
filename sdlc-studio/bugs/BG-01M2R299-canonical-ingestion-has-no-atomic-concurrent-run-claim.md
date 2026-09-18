# BG-01M2R299: Canonical ingestion has no atomic concurrent-run claim

> **Status:** inbox
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/ingestion/ingestionEngine.js, src/ingestion/runDukeIngestion.js, supabase/migrations/20260916133805_sports_publishing_foundation.sql
> **Epic:** EP-01M2QXM7
> **Story:** US-01M2QXB2
> **Severity:** High
> **Points:** 5

## Summary

persistMasterGame uses per-row upserts but the season workflow has no atomic claim or lock for two concurrent ingestion runs. Concurrent behavior is not established and must not be described as safe.

## Affected Area

- **Epic:** [EP-01M2QXM7: Canonical Sports Data and Verified Facts](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md)
- **Story:** [US-01M2QXB2: Make canonical ingestion reruns idempotent and recoverable](../stories/US-01M2QXB2-make-canonical-ingestion-reruns-idempotent-and-recoverable.md)
- **Component:** Canonical ingestion concurrency and Supabase write coordination

## Environment

- **Version:** Current Node.js 22 / canonical publishing schema
- **Platform:** GitHub Actions and Supabase Postgres

---

## Steps to Reproduce

Start two canonical ingestion runs for the same season against an isolated database and observe overlapping persistMasterGame calls and resulting row/delivery behavior.

## Expected Behaviour

Concurrent scheduled runs should either serialize safely or be rejected/claimed atomically with a
documented recovery result and no duplicate logical work.

## Actual Behaviour

`runDukeIngestion.js` iterates games and `persistMasterGame` uses per-row upserts, but no run-level
claim, lock, or concurrency policy is implemented or tested.

---

## Root Cause Analysis

> *Filled when investigating*

The ingestion workflow relies on database uniqueness for row identity but has no atomic operation that
coordinates two separate season runs before they perform their writes.

## Proposed Fix

Choose and implement a database-backed atomic claim or explicit concurrency policy, then add an isolated concurrent-run regression test.

### Files Modified

| File | Change |
| --- | --- |
| `src/ingestion/ingestionEngine.js` / `runDukeIngestion.js` | Add the approved concurrency policy or atomic claim. |

### Tests Added

| Test | Description | File |
| --- | --- | --- |
| Future concurrency regression | Two overlapping runs resolve according to the approved policy. | `src/ingestion/ingestionEngine.test.js` or isolated integration suite |

---

## Verification

- [ ] Fix verified in development
- [ ] Regression tests pass
- [ ] No side effects observed
- [ ] **Mutation-checked** - deferred until the concurrency policy and regression test exist.

**Verified by:** Not yet verified
**Verification date:** Not yet verified
**Verification depth:** Not yet verified

> Verification depth tiers: `smoke` (one-shot ping) | `functional` (single round-trip) | `conversational` (multi-turn / multi-step) | `soak` (live traffic over a window) | `live` (operator-confirmed in production with no rollback). See `reference-test-best-practices.md#verification-depth-tiers`. A bug cannot be marked **Fixed** until depth is at least `functional`; promoting **Fixed** to **Verified** requires a tier ABOVE functional (`conversational`/`soak`/`live` - Verified claims the higher-tier proof landed). A production-affecting bug (declare it with a `> **Production-affecting:** yes` header field) cannot be **Closed** until depth is at least `soak` (default 7 days). **These tiers are enforced**: `transition.py` refuses a Fixed/Verified/Closed transition that under-shoots them (a missing depth field is refused, not assumed) - `--force` records an override.
>
> **The regression test must be mutation-checked** (above): a test added alongside a fix but never seen to fail may be asserting the wrong thing and would not catch the bug's return. Seeing it red against the unfixed code is the proof it pins the fix. See `reference-test-best-practices.md#mutation-check`.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | SDLC Studio onboarding | Filed from the ingestion implementation and live-schema review. |
