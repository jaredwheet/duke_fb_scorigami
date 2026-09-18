# PL-01M2R2TR: Make canonical ingestion reruns idempotent and recoverable

> **Status:** In Progress
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Story:** US-01M2QXB2
> **Epic:** [EP-01M2QXM7: Canonical Sports Data and Verified Facts](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md)
> **Created:** 2026-09-17
> **Language:** JavaScript ES modules, SQL migrations, Node.js 22

## Overview

Prove that `persistMasterGame` reuses canonical identity rows on repeated ingestion and surfaces a
mid-batch persistence failure without claiming a transaction boundary the code does not provide. The
live Supabase schema confirms the canonical uniqueness constraints and legacy tables exist. The
repository now includes the legacy base-table migration, and the ordered chain has been replayed against
an isolated empty database with a representative backfill fixture.

## Acceptance Criteria Summary

| AC | Name | Description |
| ---- | ------ | ----------- |
| AC1 | Repeat-run reuse | Repeating identical canonical ingestion does not create duplicate games, teams, participants, sources, or analytics. |
| AC2 | Observable partial failure | A failed write rejects the ingestion and the supported per-game retry/recovery behavior is documented. |
| AC3 | Clean-install migration order | The canonical/backfill migration order and the external legacy-schema prerequisite are verified and recorded. |

---

## Technical Context

### Language & Framework

- **Primary Language:** JavaScript ES modules on Node.js 22
- **Persistence:** Supabase/Postgres via the Supabase JS client
- **Test Framework:** Jest 30, with an injected client double for unit tests and an isolated database for manual integration validation
- **Migration format:** PostgreSQL SQL migrations under `supabase/migrations/`

### Relevant Best Practices

- Keep database calls behind the existing injected `client` seam in `persistMasterGame`.
- Assert every upsert conflict key and propagated error; do not mock the function under test.
- Do not use production credentials or mutate production data from the default Jest suite.
- Preserve explicit failure propagation; do not catch and convert a partial write into success.
- Keep migration changes additive and preserve the legacy-schema ownership trace while validating the checked-in base schema.

### Library Documentation

No new library API is planned. The existing Supabase query-builder calls and PostgreSQL unique constraints
are the contracts under test. Live schema inspection on 2026-09-17 confirmed:

- `games.canonical_key` is unique.
- `teams` is unique on `(sport_id, slug)`.
- `game_participants` is unique on `(game_id, participant_role)`.
- `game_source_records` is unique on `(provider, external_game_id)`.
- `game_analytics` is unique on `(game_id, provider, metric_set)`.
- The isolated replay applied the story's four migrations in the supported order, including the checked-in legacy base-table creation migration.

### Existing Patterns

`persistMasterGame(masterGame, client = null)` accepts an injected client and performs sequential upserts
for sport, teams, game, participants, source records, and optional analytics. `runDukeIngestion.js`
loops over normalized games and calls it once per game. The SQL migrations use `begin`/`commit` and
`on conflict` clauses, but the JavaScript season loop has no whole-season transaction.

---

## Recommended Approach

**Strategy:** TDD

**Rationale:** The story has eight edge cases, clear persistence keys, and a high-risk retry contract.
Write injected-client tests first, observe failures, then make only the smallest implementation or
migration documentation change required. Use an isolated Supabase/Postgres environment for actual
row-count and migration-order evidence; never substitute a production run.

### Test Priority

1. Assert every upsert conflict target and repeat-call behavior with an injected stateful client.
2. Inject a deterministic failure at each persistence boundary and assert rejection/observability.
3. Apply the migration chain in an isolated database and record the legacy-schema prerequisite and order.

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
| --- | --- | --- | --- | --- |
| 1 | Build a stateful Supabase client double that implements the chained calls used by `persistMasterGame` and records upserts/conflict keys. | `src/ingestion/ingestionEngine.test.js` | US-01M2QXGN Done | [x] |
| 2 | Add repeat-run tests for games, teams, participants, source records, and non-empty analytics, including status/update behavior. | `src/ingestion/ingestionEngine.test.js` | Task 1 | [x] |
| 3 | Add failure-injection tests for each sequential write boundary, assert the rejection preserves the original error, and expose the failing stage and canonical key. | `src/ingestion/ingestionEngine.test.js`, `src/ingestion/runDukeIngestion.js` | Task 1 | [x] |
| 4 | Apply the full supported migration order in an isolated database: legacy base schema, post metadata, canonical foundation, then legacy backfill; record the prerequisite and link `BG-01M2R2M9`. | `supabase/migrations/20260913000000_create_legacy_duke_tables.sql`, `supabase/migrations/20260914_add_post_metadata.sql`, `supabase/migrations/20260916133805_sports_publishing_foundation.sql`, `supabase/migrations/20260916140816_backfill_legacy_duke_games.sql` | BG-01M2R2M9 migration trace | [x] |
| 5 | Add a multi-game season failure/retry case that exercises the orchestration boundary and records which games commit before/after failure. | `src/ingestion/ingestionEngine.test.js`, `src/ingestion/runDukeIngestion.js` | Tasks 1-3 | [x] |
| 6 | Run focused and full Jest tests, then record AC verification and isolated migration/failure results. | `src/ingestion/ingestionEngine.test.js` | Tasks 1-5 | [x] 26 suites/81 tests green; AC1-AC3 evidence recorded; reviewer sign-off pending |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
| --- | --- | --- |
| Sequential | 1, 2, 3, 4, 5, 6 | Shared stateful client contract and migration evidence must converge before closure. |

---

## Blind Review

| Story requirement | Plan coverage |
| --- | --- |
| AC1 repeat-run reuse | Tasks 1-2 assert all five canonical conflict keys and update behavior; Task 5 exercises multiple games. |
| AC2 observable partial failure | Task 3 asserts rejection; Task 5 records the actual per-game retry boundary. |
| AC3 migration order | Task 4 checks isolated migration order and representative backfill success; BG-01M2R2M9 remains the lifecycle trace. |
| Eight edge cases | Tasks 2-5 cover duplicate runs, changed status, failure, retry, missing schema, wrong order, missing fields, and the tracked concurrency limitation. |
| Out-of-scope whole-season transaction | Plan documents the current per-game boundary rather than inventing a transaction implementation. |

No task claims to create an unknown legacy schema, and no AC is left without a planned evidence path.

---

## Implementation Phases

### Phase 1: Stateful Persistence Test Harness

**Goal:** Exercise `persistMasterGame` through the same client call shape used in production.

- [x] Add an in-memory client double for `from().upsert().select().single()` and chained error/data results.
- [x] Seed stable sport/team/game IDs and record every conflict target and payload.

**Files:** `src/ingestion/ingestionEngine.test.js`

### Phase 2: Idempotency and Failure Tests

**Goal:** Prove repeat updates, no duplicate logical rows, and loud partial failure.

- [x] Call `persistMasterGame` twice with the same master game and assert stable row identities/counts.
- [x] Change status/score metadata between calls and assert update-in-place behavior.
- [x] Fail a write boundary and assert the original error rejects the call; retry successfully and document per-game recovery.
- [x] Preserve the original error while attaching the failing persistence stage and canonical key for CLI observability.
- [x] Add explicit concurrency limitation evidence and link BG-01M2R299 rather than claiming atomic cross-run ownership.

**Files:** `src/ingestion/ingestionEngine.test.js`

### Phase 3: Migration and Validation

**Goal:** Validate the deployed schema contract and record clean-install evidence.

- [x] Apply the full supported order in an isolated database: legacy base schema, `20260914_add_post_metadata.sql`, foundation, then backfill.
- [x] Confirm canonical uniqueness constraints and backfill references.
- [x] Confirm the legacy base tables are now checked in and applied; link `BG-01M2R2M9` for the migration fix and verify isolated clean install.
- [x] Run `npm test` and verify AC1/AC2 plus the isolated migration evidence for AC3; reviewer-of-record sign-off remains pending.

**Files:** `supabase/migrations/*.sql`, story verification record

---

## Edge Case Handling

| # | Edge Case | Handling Strategy | Phase |
| --- | --- | --- | --- |
| 1 | Identical ingestion run twice | Stateful client/integration row-count assertions; all conflict keys must reuse identity. | Phase 2 |
| 2 | Existing game status changes | Assert game upsert updates the existing canonical row and participants remain attached. | Phase 2 |
| 3 | Mid-batch persistence failure | Inject error at each write stage; assert rejection and logged/returned error, not success. | Phase 2 |
| 4 | Retry after partial failure | Retry against retained state; assert missing writes complete without duplicate logical rows. | Phase 2/3 |
| 5 | Legacy tables absent on clean install | Isolated migration check must fail/name the external prerequisite; link BG-01M2R2M9. | Phase 3 |
| 6 | Wrong migration order | Backfill-before-foundation must fail loudly; supported order is foundation then backfill. | Phase 3 |
| 7 | Missing provider fields on rerun | Consume normalized absent values from US-01M2QXGN; do not invent identity or score values. | Phase 2 |
| 8 | Concurrent ingestion runs | Explicitly unsupported in this story and tracked as BG-01M2R299; do not assert safety without an atomic test. | Phase 2 |

**Coverage:** 8/8 edge cases handled in the plan.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Fake client passes while live unique constraints differ | High | Inspect live schema and run an isolated database/branch validation. |
| Legacy base schema was previously unreproducible | High | The checked-in base migration and isolated replay now cover the prerequisite; keep BG-01M2R2M9 as the lifecycle trace. |
| Partial writes are mistaken for transaction safety | High | Name the per-game boundary and require failure-injection evidence. |
| Test fixtures accidentally load service-role credentials | Critical | Keep default tests injected/in-memory; no `.env` or live writes. |

---

## Definition of Done

- [x] Repeat-run tests cover all canonical upsert conflict keys.
- [x] Failure injection proves errors are observable and recovery behavior is documented.
- [x] Migration order and legacy-schema prerequisite are recorded with BG-01M2R2M9 linked.
- [x] Full `npm test` passes without warnings.
- [x] No migration is applied to production from this story without explicit deployment authorization.
- [x] AC verification report and test-spec matrix are updated for the unit and isolated migration evidence.
- [ ] Live Supabase migration ledger is reconciled with the checked-in filenames by an authorized operator.
- [x] Independent review approves the repaired persistence error context; deferred ledger repair and residual integration gaps are recorded.
- [x] Reviewer-of-record signoff is recorded in `sdlc-studio/reviews/signoff-record.md`.

---

## Resolved Questions

- Whole-season atomic transaction: not implemented in this story; current contract is per-game persistence with explicit partial-failure recovery.
- Legacy base-table ownership: existing live tables remain externally operated, while the checked-in creation migration now makes the clean-install prerequisite reproducible; BG-01M2R2M9 remains the lifecycle trace.
- Concurrent atomic claim: not promised by this story; remains a follow-up risk for scheduled workflows.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | SDLC Studio story plan | Planned idempotency, failure injection, live-schema validation, and migration prerequisite evidence. |
| 2026-09-17 | Three Amigos | Added isolated integration, multi-game failure, analytics-positive, split migration-order, and tracked concurrency cases. |
| 2026-09-17 | TDD implementation | Added five unit tests covering repeat identity, updates, failure/retry, multi-game recovery, and absent enrichment; AC3 remains blocked pending migration bug BG-01M2R2M9. |
| 2026-09-17 | TDD implementation | Focused ingestion tests 11/11 and full suite 26 suites/81 tests pass; AC1/AC2 verify and AC3 remains blocked/manual. |
| 2026-09-17 | Isolated migration verification | Replayed the four story migrations on an empty `supabase-test` database and backfilled a representative legacy row; AC3 evidence is complete, with reviewer-of-record sign-off still pending. |
| 2026-09-17 | Adversarial review repair | Added production-shaped persistence failure context and boundary assertions; migration ledger reconciliation remains an operator-level follow-up. |
| 2026-09-17 | Independent code review | Re-review found no new High/Medium/Low issues and approved the repair; subprocess and isolated durable-retry cases remain non-blocking gaps, and BG-01M2R2M9 ledger repair is deferred. |
