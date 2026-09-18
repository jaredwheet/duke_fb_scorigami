# TS-01M2R2D8: Canonical Ingestion Rerun and Recovery

> **Status:** In Progress
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Epic:** [EP-01M2QXM7: Canonical Sports Data and Verified Facts](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md)
> **Story:** [US-01M2QXB2: Make canonical ingestion reruns idempotent and recoverable](../stories/US-01M2QXB2-make-canonical-ingestion-reruns-idempotent-and-recoverable.md)
> **Created:** 2026-09-17
> **Last Updated:** 2026-09-17

## Overview

This spec covers canonical persistence repeatability and error propagation. Unit tests use an injected
Supabase-shaped client and never contact production. Migration and failure-injection evidence requires
an isolated Supabase/Postgres environment. The legacy base-table migration is checked in, and the
supported migration order plus representative backfill have been verified in `supabase-test`.

## Scope

### Stories Covered

| Story | Title | Priority |
| --- | --- | --- |
| [US-01M2QXB2](../stories/US-01M2QXB2-make-canonical-ingestion-reruns-idempotent-and-recoverable.md) | Make canonical ingestion reruns idempotent and recoverable | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
| --- | --- | --- | --- | --- |
| US-01M2QXB2 | AC1 | Repeat ingestion reuses canonical identities. | TC0012, TC0013, TC0018, TC0020, TC0023 | Unit evidence passes; isolated integration pending |
| US-01M2QXB2 | AC2 | Mid-batch failure is observable and recovery boundary is documented. | TC0014, TC0015, TC0021 | Unit evidence passes; isolated recovery pending |
| US-01M2QXB2 | AC3 | Migration order and legacy prerequisite are recorded. | TC0016, TC0017, TC0022, TC0024 | Supported order and representative backfill verified; negative-order cases remain manual follow-up |

**Coverage:** 3/3 ACs mapped to test cases; unit automation is complete, AC3 supported-order evidence is recorded, and isolated persistence/recovery cases remain manual.

### Test Types Required

| Type | Required | Rationale |
| ------ | ---------- | --------- |
| Unit | Yes | Injected client and failure propagation are deterministic module behavior. |
| Integration | Yes | Unique constraints, row reuse, migration order, and legacy prerequisites require isolated Postgres/Supabase evidence. |
| E2E | No | No inbound API or user-facing UI is involved. |

### Strategy Heuristics

- [x] **Production-state-shape integration test** - isolated canonical tables must reflect the deployed unique constraints and existing legacy dependency shape.
- [x] **Rejects-old-shape contract test** - not applicable; this story preserves the current persistence schema rather than introducing a new wire shape.
- [x] **Regression test per fixed bug** - BG-01M2R2M9 remains the migration-fix trace and TC0017/TC0024 cover the former missing-prerequisite failure mode.

---

## Environment

| Requirement | Details |
| ------------- | --------- |
| Prerequisites | Node.js 22, Jest 30, injected client test double, and an isolated Supabase/Postgres branch for migration checks. |
| External Services | No production services in default tests; isolated database only for integration/manual cases. |
| Test Data | One normalized Duke game with stable teams, participants, source record, optional analytics, and a changed status rerun. |
| Live schema evidence | Legacy base tables, post metadata, foundation, and backfill are present live; the checked-in chain was also replayed in an empty isolated test database. |

---

## Test Cases

### TC0012: Repeat persistence reuses all canonical identities

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB2 AC1

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A normalized master game and a stateful Supabase-shaped client begin empty. | The client can return stable IDs for sport, teams, game, participants, source, and analytics upserts. |
| When | `persistMasterGame` is called twice with the same master game. | Every logical entity is reused by its documented conflict key; no duplicate identity is recorded. |
| Then | Inspect recorded upserts and state. | Conflict keys are `slug`, `sport_id,slug`, `canonical_key`, `game_id,participant_role`, `provider,external_game_id`, and `game_id,provider,metric_set`. |

**Automation:** Planned `src/ingestion/ingestionEngine.test.js`.

---

### TC0013: Repeat persistence updates existing game state

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB2 AC1 edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A game has been persisted once with scheduled status and a non-empty enrichment payload. | The fake/isolated store contains one canonical identity and one analytics identity. |
| When | The same canonical key is persisted with final status, scores, and updated enrichment. | The existing game, participant, and analytics rows are updated in place. |
| Then | Count logical identities and inspect analytics payload. | Counts remain unchanged while current state and analytics reflect the update. |

**Automation:** Planned `src/ingestion/ingestionEngine.test.js`.

---

### TC0020: Isolated database repeat ingestion reuses durable rows

**Type:** Integration | **Priority:** High | **Story:** US-01M2QXB2 AC1

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | An isolated Supabase/Postgres database has the applied canonical foundation and a representative master game. | The database exposes the production-shaped uniqueness constraints. |
| When | The same master game is persisted twice, then row counts are queried. | Games, teams, participants, source records, and analytics are reused rather than duplicated. |
| Then | Compare the returned game ID and logical counts. | The second run returns the same game identity and does not increase counts. |

**Automation:** Isolated integration environment required; never run against production.

---

### TC0014: Mid-batch write failure rejects the operation

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB2 AC2

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | The injected client fails at a selected write boundary after an earlier upsert succeeds. | The failure has a stable error object/message plus the failing persistence stage and canonical key. |
| When | `persistMasterGame` executes. | The promise rejects with the original error annotated with stage/key context; it does not return a game ID or swallow the failure. |
| Then | Inspect the call log. | The failing operation is identifiable and later operations do not falsely report success. |

**Automation:** Automated unit failure-injection test in `src/ingestion/ingestionEngine.test.js`.

---

### TC0015: Retry after partial failure reuses prior state

**Type:** Integration/manual | **Priority:** High | **Story:** US-01M2QXB2 AC2 edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | An isolated run fails after some per-game writes have committed. | The failure is recorded and partial state is inspectable. |
| When | The failed game is retried after restoring the isolated client/database. | Existing rows are reused and missing writes complete without duplicates. |
| Then | Compare logical row counts and game ID. | Counts do not grow from duplicate identities and the retry result is observable. |

**Automation:** Manual isolated database evidence; no production run.

---

### TC0021: Multi-game season failure and retry boundary is observable

**Type:** Integration/manual | **Priority:** High | **Story:** US-01M2QXB2 AC2

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A two-game season fixture is processed and the second game's persistence is configured to fail. | The first game's commit state and second-game failure are observable. |
| When | The season ingestion run executes, then the failed game is retried after the fault is removed. | The run exits non-zero at failure; retry reuses the first game and completes the second without duplicate identities. |
| Then | Inspect process result and isolated row counts. | No later game is falsely reported successful and the per-game recovery boundary is documented. |

**Automation:** Isolated integration/manual evidence; current entrypoint requires a controlled database/client seam.

---

### TC0016: Foundation migration precedes backfill

**Type:** Integration/manual | **Priority:** High | **Story:** US-01M2QXB2 AC3

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | An isolated database has the authoritative legacy base schema available. | The migration precondition is explicitly recorded. |
| When | Apply the full supported order: external legacy base schema, `20260914_add_post_metadata.sql`, `20260916133805_sports_publishing_foundation.sql`, then backfill. | Legacy metadata alters existing tables first; canonical tables and constraints exist before backfill writes. |
| Then | Inspect migration results and representative objects. | The supported order is recorded; no production data is modified. |

**Automation:** Manual/isolated migration check; supported order and representative backfill verified on 2026-09-17 in `supabase-test`.

---

### TC0017: Missing legacy schema fails visibly

**Type:** Integration/manual | **Priority:** High | **Story:** US-01M2QXB2 AC3 edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A clean isolated database lacks the external legacy base-table migration. | The checked-in repository migrations are applied without guessing the legacy schema. |
| When | Backfill or post-metadata migration is attempted without the external legacy base-table migration. | The operation fails with a missing-table error and the gap is linked to BG-01M2R2M9. |
| Then | Record the migration result. | The plan does not claim clean-install reproducibility until the bug is resolved. |

**Automation:** Manual/isolated migration evidence.

---

### TC0022: Backfill-before-foundation migration order fails

**Type:** Integration/manual | **Priority:** High | **Story:** US-01M2QXB2 AC3 edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | An isolated database has the legacy base tables but not the canonical foundation tables. | The backfill migration is attempted before the foundation migration. |
| When | The backfill SQL runs. | It fails loudly because referenced canonical objects are absent. |
| Then | Apply the supported order after the external legacy schema and post-metadata migration. | The order is recorded as the only supported sequence, subject to the legacy prerequisite bug. |

**Automation:** Manual/isolated migration evidence.

---

### TC0024: Post-metadata migration requires the legacy base schema

**Type:** Integration/manual | **Priority:** High | **Story:** US-01M2QXB2 AC3 edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | An empty database has neither legacy base tables nor canonical tables. | The repository's post-metadata migration is attempted first. |
| When | `20260914_add_post_metadata.sql` runs. | It fails visibly because it alters legacy tables that are not created by the checked-in chain. |
| Then | Apply the external legacy base schema first. | The migration can proceed to the canonical foundation/backfill order; the prerequisite remains linked to BG-01M2R2M9. |

**Automation:** Manual/isolated migration evidence.

---

### TC0018: Missing provider fields remain deterministic on rerun

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXB2 AC1 edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A master game is built from normalized fields with absent optional provider values. | Identity and nullable values match US-01M2QXGN's tested contract. |
| When | Persistence is attempted twice. | The same conflict keys are used and no fabricated enrichment row is written. |
| Then | Inspect analytics writes. | Absent enrichment produces no analytics payload. |

**Automation:** Planned unit test using the completed normalization fixtures.

---

### TC0023: Non-empty analytics upsert is idempotent

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXB2 AC1

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A master game contains one enrichment with provider, metric set, and data. | Analytics payload is eligible for persistence. |
| When | `persistMasterGame` runs twice with changed enrichment data on the second call. | The same `(game_id, provider, metric_set)` conflict key is used and payload updates in place. |
| Then | Inspect recorded analytics upserts. | No duplicate analytics identity is created. |

**Automation:** Planned unit test in `src/ingestion/ingestionEngine.test.js`.

---

### TC0019: Concurrent runs remain an explicit unsupported boundary

**Type:** Manual | **Priority:** Medium | **Story:** US-01M2QXB2 AC2 edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | Two ingestion processes can target the same game concurrently. | No application-level atomic claim is assumed. |
| When | The concurrency behavior is assessed against database uniqueness and current job scheduling. | It is recorded as unsupported by this story; no atomic guarantee is claimed. |
| Then | Link the follow-up. | The gap is tracked as BG-01M2R299. |

**Automation:** Manual design/operations review.

---

## Fixtures

```yaml
master_game:
  canonicalKey: football:2026:2026-09-05T19:30:00.000Z:duke:tulane
  sport: {slug: football, name: College Football}
  season: 2026
  week: 2
  status: final
  participants:
    - {role: home, team: {externalId: '150', slug: duke, name: Duke, metadata: {}}, score: 17}
    - {role: away, team: {externalId: '2655', slug: tulane, name: Tulane, metadata: {}}, score: 3}
  sourceRecords:
    - {provider: cfbdata, externalGameId: '401858209', payloadHash: fixture-hash}
  enrichments: {}
failure_points:
  - sport-upsert
  - team-upsert
  - game-upsert
  - participant-upsert
  - source-upsert
  - analytics-upsert
```

---

## Automation Status

| TC | Title | Status | Implementation |
| --- | --- | --- | --- |
| TC0012 | Repeat persistence reuses all canonical identities | Automated | `src/ingestion/ingestionEngine.test.js` |
| TC0013 | Repeat persistence updates existing game state | Automated | `src/ingestion/ingestionEngine.test.js` |
| TC0014 | Mid-batch write failure rejects the operation | Automated | `src/ingestion/ingestionEngine.test.js` |
| TC0015 | Retry after partial failure reuses prior state | Manual | Isolated database required |
| TC0016 | Foundation migration precedes backfill | Manual | Isolated database required |
| TC0017 | Missing legacy schema fails visibly | Manual | BG-01M2R2M9 migration-fix trace |
| TC0018 | Missing provider fields remain deterministic on rerun | Automated | `src/ingestion/ingestionEngine.test.js` |
| TC0019 | Concurrent runs remain an explicit unsupported boundary | Manual | Operations/design review |
| TC0020 | Isolated database repeat ingestion reuses durable rows | Manual | Isolated database required |
| TC0021 | Multi-game season failure and retry boundary is observable | Manual | Isolated database required |
| TC0022 | Backfill-before-foundation migration order fails | Manual | Isolated database required |
| TC0023 | Non-empty analytics upsert is idempotent | Automated | `src/ingestion/ingestionEngine.test.js` |
| TC0024 | Post-metadata migration requires the legacy base schema | Manual | BG-01M2R2M9 migration-fix trace |

---

## Traceability

| Artefact | Reference |
| ---------- | ----------- |
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP-01M2QXM7](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md) |
| Story | [US-01M2QXB2](../stories/US-01M2QXB2-make-canonical-ingestion-reruns-idempotent-and-recoverable.md) |
| Bug prerequisite | [BG-01M2R2M9](../bugs/BG-01M2R2M9-legacy-supabase-base-tables-are-missing-from-the.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | SDLC Studio story plan | Created AC coverage, repeat-run, failure-injection, and migration evidence cases. |
| 2026-09-17 | TDD implementation | Automated repeat, update, failure, multi-game, absent-enrichment, and analytics unit cases. |
| 2026-09-17 | Isolated migration verification | Replayed the story migration order and verified a representative legacy row backfills into canonical tables without missing-object errors. |
| 2026-09-17 | Adversarial review repair | Added assertions for persistence stage and canonical key context on every injected write boundary. |
