# EP-01M2QXM7: Canonical Sports Data and Verified Facts

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Size:** L

## Summary

Make canonical ingestion, idempotent persistence, deterministic facts, and editorial directives
trustworthy inputs for every publication path.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| PRD | Performance | Fact refresh must paginate beyond one 500-row response. | History-scale refresh cannot silently omit older games. |
| PRD | Security | Numeric facts must be code-generated from validated data. | AI is not allowed to calculate or authorize sports statistics. |
| TRD | Architecture | Keep domain modules in one Node batch application. | Changes must preserve ingestion/facts boundaries and command entrypoints. |
| TRD | Tech Stack | Node 22 ES modules, Jest 30, Supabase/Postgres. | Tests and persistence contracts use the current runtime and schema. |

---

## Business Context

### Problem Statement

Provider payloads, legacy tables, and the new canonical publishing schema must agree before a score or
newsletter claim can be published. [HIGH] The current implementation has normalization and fact logic,
but migration order, transaction boundaries, and repeat-run behavior still need executable validation.

**PRD Reference:** [Data Architecture](../prd.md#data-architecture)

### Value Proposition

Operators and downstream publishers receive one stable, source-backed data model instead of each
publication path recalculating facts or interpreting provider payloads independently.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Duplicate canonical rows on repeat ingestion | Not measured | Zero for identical provider input | Isolated integration rerun |
| Facts omitted by page boundary | Risk identified | Zero across representative history | Paginated fixture test |
| Unsupported numeric directives | Guarded by unit tests | Zero accepted by validator | Fact/directive contract suite |
| Partial-write recovery | Not specified | Documented and tested | Failure-injection integration test |

---

## Scope

### In Scope

- CFBData normalization into sports, teams, games, participants, sources, and analytics.
- Stable identity and idempotent upsert behavior.
- Deterministic score, narrative, statistical facts, and editorial directives.
- Migration/backfill contracts and persistence failure behavior.
- Test evidence for provider parsing, pagination, and canonical queries.

### Out of Scope

- New external provider integrations.
- Public API or frontend work.
- Replacing Supabase with another database.
- Rewriting the legacy X workflow before its compatibility contract is tested.

### Affected Personas

- **Rowan Patel:** needs durable identity, migration order, and recoverable batch behavior.
- **Casey Nguyen:** needs executable evidence for normalization, pagination, and fact safeguards.
- **Taylor Morgan:** needs reruns that are safe after a failed ingestion.

---

## Acceptance Criteria (Epic Level)

- [ ] A representative season can be ingested twice without duplicate canonical identity rows.
- [ ] Fact refresh covers data beyond a single 500-row page and persists stable fact/directive keys.
- [ ] Score and narrative directives never promote incomplete or unsupported data to verified facts.
- [ ] Required migration order and the behavior of a mid-batch persistence failure are documented and
  covered by an isolated test or filed as an explicit known issue.

---

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| Supabase migration environment | Infrastructure | Open question | Taylor Morgan |
| Verified provider fixture payloads | Test data | Available for unit paths; integration set needed | Casey Nguyen |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| Newsletter and AI issue packets | Downstream epic | They must read canonical facts rather than recalculate them. |
| X final-score history lookup | Downstream epic | Scorigami detection depends on complete historical data. |

---

## Risks & Assumptions

### Assumptions

- CFBData remains authoritative for current schedules, scores, and supported statistics.
- Supabase service-role execution is restricted to server-side batch jobs.
- Existing migrations are the intended source for canonical table shape.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Ingestion fails after related rows are partially written | Medium | High | Define transaction boundary and add failure-injection test. |
| Legacy base tables are absent in a clean database | Medium | High | Document migration ownership/order and add clean-install check. |
| A page or provider response silently omits history | Medium | High | Pagination fixtures and explicit response/error assertions. |
| Canonical tables gain other sports without query scoping | Low/Medium | Medium | Add sport/team filters before expansion. |

---

## Technical Considerations

### Architecture Impact

Preserve `src/ingestion/`, `src/facts/`, provider adapters, and the Supabase client boundary. Keep
normalization and numeric fact logic pure where possible so generated acceptance criteria can run under
Jest without live credentials.

### Integration Points

CFBData, Winsipedia and optional enrichment providers; Supabase canonical tables; SQL migrations and
legacy backfill. No new network boundary is required for the initial validation work.

---

## Sizing

**Size:** L

**Estimated Story Count:** 3

**Derived Point Total:** 18

_The point total is derived by reconcile after stories are created._

**Complexity Factors:**

- Multiple schemas and legacy-to-canonical compatibility.
- Provider pagination and malformed payload behavior.
- Persistence/idempotency semantics that require an isolated database boundary.

---

## Story Breakdown

<!-- Story links are maintained by artifact.py. -->
---
- [x] [US-01M2QXGN: Normalize provider games into canonical records](../stories/US-01M2QXGN-normalize-provider-games-into-canonical-records.md)
- [x] [US-01M2QXB2: Make canonical ingestion reruns idempotent and recoverable](../stories/US-01M2QXB2-make-canonical-ingestion-reruns-idempotent-and-recoverable.md)
- [x] [US-01M2QXB4: Refresh paginated facts and directives deterministically](../stories/US-01M2QXB4-refresh-paginated-facts-and-directives-deterministically.md)

## Test Plan

Test specs will map the three stories to normalization, persistence/idempotency, pagination, and fact
directive contracts described in `sdlc-studio/tsd.md`.

---

## Resolved Questions

- The repository-owned legacy base-table migration is `20260913000000_create_legacy_duke_tables.sql`;
  live migration-ledger alignment remains the operational follow-up tracked by BG-01M2R2M9.
- Canonical ingestion remains per-game recoverable rather than season-atomic. US-01M2QXB2 documents
  observable partial failure and stable retry behavior; a whole-season transaction is not required by
  this foundation increment.
- Current fact refresh is scoped to the Duke canonical records used by this product. Before adding other
  sports or broadening team scope, a follow-up story owned by Jamie Carter must define and test explicit
  sport/team filters.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | SDLC Studio onboarding | Decomposed PRD data, persistence, and deterministic-fact requirements into a foundation epic. |
| 2026-09-17 | SDLC Studio closure preparation | Resolved the three epic open questions from the completed foundation stories and recorded their follow-up boundaries. |
