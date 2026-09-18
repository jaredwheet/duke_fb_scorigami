# US-01M2QXB2: Make canonical ingestion reruns idempotent and recoverable

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/ingestion/ingestionEngine.js, src/ingestion/runDukeIngestion.js, src/ingestion/ingestionEngine.test.js, supabase/migrations/20260913000000_create_legacy_duke_tables.sql, supabase/migrations/20260914_add_post_metadata.sql, supabase/migrations/20260916133805_sports_publishing_foundation.sql, supabase/migrations/20260916140816_backfill_legacy_duke_games.sql
> **Epic:** EP-01M2QXM7
> **Points:** 8
> **Persona:** Taylor Morgan

## User Story

**As a** Taylor Morgan
**I want** canonical ingestion reruns to update or reuse existing rows without duplicating identity records, and failures to be observable and recoverable
**So that** a failed scheduled ingestion can be safely retried without corrupting the canonical store.

## Context

### Persona Reference

**Taylor Morgan** - publishing operator, accountable for safe scheduled delivery and recovery; asks "if this run fails halfway through, what can I safely retry and how do I know?"
[Full persona details](../personas/stakeholders/taylor-morgan.md)

### Background

`ingestDukeSeason` in `src/ingestion/ingestionEngine.js` fetches a season, builds master game objects, and
`persistMasterGame` writes canonical rows. PRD FR-008 requires legacy Duke game and tweet tables remain
usable while canonical tables are populated and backfilled, and the PRD flags transactional recovery as an
open question. The two checked-in migrations
(`20260916133805_sports_publishing_foundation.sql`, `20260916140816_backfill_legacy_duke_games.sql`) must
apply in order on a clean database. This story proves the idempotent-rerun contract, documents the
mid-batch failure behavior, and validates clean-install migration order.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Architecture | Keep domain modules in one Node batch application; preserve ingestion entrypoints (TRD). | Changes stay inside `ingestionEngine.js` and migrations; `npm run ingest` remains the entrypoint. |
| PRD | Scalability | Canonical identity keys and upserts support repeat ingestion; ingestion is not transactional across all related records, so partial writes may remain after a failure. | AC2 documents recovery/transaction behavior instead of pretending a failed batch is a successful ingestion. |
| PRD | Security | Supabase service-role credentials are server-only and must not be exposed in client-facing code (HIGH). | Tests run against an isolated database or doubles; no live credentials in fixtures. |

---

## Acceptance Criteria

### AC1: Repeat-run reuse

- **Given** an identical season has already been ingested,
- **When** ingestion runs again,
- **Then** canonical games, teams, participants, sources, and analytics are updated or reused without duplicate identity rows.
- **Verify:** shell npm test -- --runInBand src/ingestion/ingestionEngine.test.js -t "repeat persistence reuses all canonical identities"
- **Caller:** `npm run ingest` (src/ingestion/runDukeIngestion.js -> ingestDukeSeason -> persistMasterGame)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

> **AC3 state:** The legacy base-table migration is checked in and applied to the live Supabase
> project. Isolated clean-install verification completed on 2026-09-17.

### AC2: Observable partial failure

- **Given** a related persistence write fails after an earlier write,
- **When** the batch reports failure,
- **Then** the failure is observable and the supported recovery or transaction behavior is documented instead of being treated as a successful ingestion.
- **Verify:** shell npm test -- --runInBand src/ingestion/ingestionEngine.test.js -t "mid-batch persistence failure rejects and can be retried"
- **Caller:** `npm run ingest` (src/ingestion/runDukeIngestion.js -> ingestDukeSeason -> persistMasterGame)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC3: Clean-install migration order

- **Given** a clean database is prepared from the checked-in migrations,
- **When** the legacy backfill and canonical foundation are applied in order,
- **Then** every referenced legacy table and canonical dependency exists before its first write.
- **Verify:** manual apply the full migration chain to an isolated database and record the clean-install order
- **Caller:** `supabase/migrations` applied in filename order by the deployment procedure before `npm run ingest`
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

> **Evidence (2026-09-17):** An isolated `supabase-test` database started with no public tables or
> migrations. The checked-in migrations were applied in filename order: legacy base tables,
> post metadata, canonical foundation, then legacy backfill. A representative legacy game was
> backfilled successfully, producing one canonical game, two teams, two participants, and one
> source record without a missing-object error. Production was not used.

---

## Scope

### In Scope

- Idempotent repeat-ingestion evidence for games, teams, participants, sources, and analytics.
- Documented transaction boundary and failure-observability behavior of `persistMasterGame`.
- Clean-install validation of `20260916133805_sports_publishing_foundation.sql` then `20260916140816_backfill_legacy_duke_games.sql`.
- Failure-injection coverage proving a mid-batch persistence failure surfaces as a failed run.

### Out of Scope

- Making the whole season ingestion a single database transaction (record as filed gap if unsupported).
- New providers or detail-ingestion paths (`INGEST_DETAILS` behavior beyond what exists).
- Legacy X workflow rewrites; only its compatibility contract is exercised by the backfill migration.
- Migration tooling changes; migrations are applied in the existing order mechanism.

---

## Technical Notes

`persistMasterGame(masterGame, client)` currently writes per-game with an optional injected client, which is
the seam for failure injection in tests. Idempotency depends on unique identity keys declared in the
foundation migration plus select-then-insert/upsert logic in `ingestionEngine.js`. AC2 is covered by the
injected-client failure tests; persistence errors retain their original object while identifying the
failing stage and canonical key, and the CLI logs that context. An isolated process-level failure run
remains operational follow-up evidence. AC3 was manually verified by applying the checked-in migration
chain to an empty isolated database in filename order and exercising the backfill with a representative
legacy row.

### API Contracts

No inbound API. Internal contract: `ingestDukeSeason({ year }) -> master games[]`,
`persistMasterGame(masterGame, client?) -> void` in `src/ingestion/ingestionEngine.js`, consumed by
`src/ingestion/runDukeIngestion.js` (`npm run ingest`). Outbound: CFBData schedule/details calls and
Supabase writes; both remain behind existing adapters.

### Data Requirements

- Isolated Postgres/Supabase instance for AC2/AC3 manual verification; clean database for AC3.
- One representative season's CFBData payloads (fixtures) sufficient to populate all canonical entity types.
- Migration files `20260916133805_sports_publishing_foundation.sql` and `20260916140816_backfill_legacy_duke_games.sql` unchanged in filename order.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Ingestion run twice with identical provider data | Row counts for games/teams/participants/sources/analytics unchanged after second run. |
| Ingestion run twice with changed score or status | Existing identity rows updated in place; no new identity row. |
| Persistence write fails mid-batch | Run exits non-zero with an observable error naming the failing write; partial rows are either rolled back per supported boundary or listed for retry. |
| Retry after a mid-batch failure | Retry reuses existing rows and completes the missing writes; no duplicates. |
| Clean database has no legacy tables | Applying the foundation migration before the backfill migration creates everything the backfill references. |
| Migration applied in wrong order | Clean-install check fails loudly rather than silently skipping backfill rows. |
| Missing provider fields during a rerun | Normalization represents absence (US-01M2QXGN) so rerun values stay deterministic. |
| Concurrent ingestion runs | Not supported without an atomic claim; behavior documented and a filed gap created if untested. |

---

## Test Scenarios

- [x] Run ingestion twice on identical fixtures and assert no duplicate identity rows (jest "idempotent").
- [ ] Failure-injection: fail a mid-batch write, assert non-zero exit and observable error, then retry and assert completion without duplicates (manual, recorded).
- [x] Apply both migrations to an empty isolated database in order and assert every referenced object exists (manual, recorded).
- [x] Update path: change a game status between runs and assert in-place update.
- [x] Assert `persistMasterGame` honors an injected client so tests never touch live Supabase.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QXGN](US-01M2QXGN-normalize-provider-games-into-canonical-records.md) | Upstream | Stable canonical identities and payload hashes give the unique keys reuse depends on. | Draft |
| [US-01M2QXB4](US-01M2QXB4-refresh-paginated-facts-and-directives-deterministically.md) | Downstream | Fact refresh reads the deduplicated canonical store. | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Supabase migration environment (isolated) | Infrastructure | Open question - owner Taylor Morgan (see epic). |
| Verified provider fixture payloads | Test data | Unit fixtures available; integration set needed (owner Casey Nguyen). |

---

## Estimation

**Points:** 8
**Complexity:** High

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/ingestion/ingestionEngine.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| New migration files | Migrations are additive; revert by a corrective migration or restore the database snapshot taken before apply | < 1 hour with snapshot |
| Partially written canonical rows | Re-run `npm run ingest` after fix; idempotent keys reconcile state | < 1 job run |

---

## Resolved Questions

- The current implementation writes one game at a time and does not wrap the full season in a
  transaction. AC2 will document the observable per-game failure/retry behavior; making the whole
  season atomic is out of scope.
- The live Supabase project owns the existing `duke_football_games` and `tweeted_scores` base tables,
  and their creation migration is now checked in as
  `supabase/migrations/20260913000000_create_legacy_duke_tables.sql` and applied through Supabase MCP.
  AC3 clean-install verification completed in the isolated `supabase-test` database on 2026-09-17;
  the migration-fix trace remains [BG-01M2R2M9](../bugs/BG-01M2R2M9-legacy-supabase-base-tables-are-missing-from-the.md)
  until that bug's lifecycle record is independently transitioned.
- The live migration ledger uses different timestamps for the already-applied foundation, backfill, and
  legacy-table changes, and does not list the post-metadata migration; remote history reconciliation is
  recorded in BG-01M2R2M9 and remains an operator-level deployment follow-up.
- Atomic concurrent-run claiming is not supported by this story; the behavior remains a documented
  follow-up risk tracked as [BG-01M2R299](../bugs/BG-01M2R299-canonical-ingestion-has-no-atomic-concurrent-run-claim.md).

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | Three Amigos | Bound AC3 to the full migration order, declared post-metadata migration in scope, and linked BG-01M2R2M9/BG-01M2R299. |
| 2026-09-17 | TDD implementation | Added injected-client and run-orchestration tests; AC1/AC2 verify, AC3 remains blocked by BG-01M2R2M9. |
| 2026-09-17 | Supabase migration | Added the legacy base-table migration and applied it idempotently through Supabase MCP; isolated clean-install verification remains. |
| 2026-09-17 | Isolated migration verification | Applied the checked-in legacy, metadata, foundation, and backfill migrations to an empty `supabase-test` database and verified a representative legacy row backfills successfully; AC3 verified. |
| 2026-09-17 | Adversarial review repair | Annotated persistence errors with the failing stage and canonical key while preserving the original error; focused tests cover every write boundary. |
