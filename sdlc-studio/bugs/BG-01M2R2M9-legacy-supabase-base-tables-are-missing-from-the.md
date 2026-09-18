# BG-01M2R2M9: Legacy Supabase base tables are missing from the checked-in migration chain

> **Status:** inbox
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** supabase/migrations/20260914_add_post_metadata.sql, supabase/migrations/20260916140816_backfill_legacy_duke_games.sql
> **Epic:** EP-01M2QXM7
> **Story:** US-01M2QXB2
> **Severity:** High
> **Points:** 5

## Summary

The live Supabase project contains `public.duke_football_games` and `public.tweeted_scores`, but the repository migration chain only alters or references those tables. A clean database cannot reproduce the deployed legacy schema from checked-in migrations alone.

## Affected Area

- **Epic:** [EP-01M2QXM7: Canonical Sports Data and Verified Facts](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md)
- **Story:** [US-01M2QXB2: Make canonical ingestion reruns idempotent and recoverable](../stories/US-01M2QXB2-make-canonical-ingestion-reruns-idempotent-and-recoverable.md)
- **Component:** Supabase/Postgres migration chain and legacy schema ownership

## Environment

- **Version:** Migration history `20260916133805` / `20260916150326`
- **Platform:** Supabase Postgres

---

## Steps to Reproduce

Inspect supabase/migrations/20260914_add_post_metadata.sql and 20260916140816_backfill_legacy_duke_games.sql, then apply the checked-in migration chain to an empty isolated database.

## Expected Behaviour

Applying the checked-in migrations to an empty database should create every table referenced by the
post-metadata and canonical backfill migrations before the first write.

## Actual Behaviour

The live database has the legacy tables, but the checked-in migration files only alter or reference
them. A clean database cannot reproduce the deployed legacy schema from this repository alone.

---

## Root Cause Analysis

> *Filled when investigating*

The legacy base-table schema predates the checked-in migration chain and its owning migration is not
present in this repository. The canonical backfill therefore assumes an external prerequisite.

## Proposed Fix

Authoritative legacy base-table migration is now checked in at
`supabase/migrations/20260913000000_create_legacy_duke_tables.sql` and has been applied idempotently
through Supabase MCP. The remaining verification is an isolated clean-install run proving the full
order before this bug can be marked Fixed.

### Files Modified

| File | Change |
| --- | --- |
| Follow-up migration | Add or restore the authoritative legacy base-table schema and document migration order. |

### Tests Added

| Test | Description | File |
| --- | --- | --- |
| TC0016/TC0017 | Validate supported order and visible missing-prerequisite failure. | TS-01M2R2D8 |

### Deployment History Gap

The live Supabase schema now contains the legacy tables, post-metadata columns and indexes, canonical
tables, and backfill constraints. The live migration ledger is not yet aligned with the checked-in
filenames: it records `20260916133805_sports_publishing_foundation`,
`20260916150326_backfill_legacy_duke_games`, and `20260917165452_create_legacy_duke_tables`, while the
repository chain uses `20260913000000_create_legacy_duke_tables`, `20260914_add_post_metadata`, and
`20260916140816_backfill_legacy_duke_games`. The isolated `supabase-test` replay proves the checked-in
chain, but no remote migration-history repair was run from this session. A linked dev/staging operator
must reconcile the ledger with `supabase migration list` and the documented `supabase migration repair`
workflow before treating remote deployment history as clean.

---

## Verification

- [ ] Fix verified in development
- [ ] Regression tests pass
- [ ] No side effects observed
- [ ] **Mutation-checked** - deferred until the authoritative migration fix exists; the clean-install check must fail on the current incomplete chain first.

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
| 2026-09-17 | SDLC Studio onboarding | Filed from live Supabase schema and migration-ledger comparison. |
| 2026-09-17 | Supabase migration | Added and applied the legacy base-table migration; isolated clean-install verification remains. |
