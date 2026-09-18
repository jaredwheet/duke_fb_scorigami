# US-01M2QXGN: Normalize provider games into canonical records

> **Status:** Done
> **Verification depth:** functional: 11 focused normalization tests and full npm test (25 suites, 70 tests)
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/ingestion/normalize.js, src/ingestion/ingestionEngine.js, src/ingestion/normalize.test.js
> **Epic:** EP-01M2QXM7
> **Points:** 5
> **Persona:** Taylor Morgan

## User Story

**As a** Taylor Morgan
**I want** CFBData provider games normalized into stable canonical sport, team, game, participant, and source records
**So that** facts and newsletters consume one deterministic source of truth instead of reinterpreting provider payloads.

## Context

### Persona Reference

**Taylor Morgan** - publishing operator, accountable for safe scheduled delivery and recovery of the publishing operation.
[Full persona details](../personas/stakeholders/taylor-morgan.md)

### Background

`src/ingestion/normalize.js` already implements `normalizeCfbDataGame`, `slugify`, and `getPayloadHash` for
mapping CFBData payloads into canonical identities consumed by `ingestDukeSeason` in
`src/ingestion/ingestionEngine.js`. PRD FR-001 makes CFBData authoritative for schedule and score, and
FR-002 requires numeric identity to be code-generated. This story pins down the contract the downstream
idempotency and fact stories build on: stable keys across repeats, and optional enrichment represented as
absent rather than invented.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Architecture | Keep domain modules in one Node batch application; preserve ingestion/facts boundaries and command entrypoints (TRD). | Normalization stays a pure module consumed by `ingestDukeSeason`; no new service boundary or entrypoint. |
| PRD | Data integrity | FR-001: CFBData and persisted canonical records are authoritative; optional providers enrich rather than silently override. | AC3 asserts missing enrichment stays absent and schedule/score fields are never fabricated. |
| PRD | Security | FR-002: deterministic numeric facts and identity must be calculated by code, not AI. | Keys and hashes remain computed in `normalize.js`; tests assert byte-stable output. |

---

## Acceptance Criteria

### AC1: Stable canonical identities

- **Given** a CFBData game payload with home and away teams,
- **When** normalization runs,
- **Then** it emits stable sport, team, game, participant, and source identities with the canonical Duke game fields.
- **Verify:** shell npm test -- --runInBand src/ingestion/normalize.test.js -t "normalizes a CFBData game"
- **Caller:** `npm run ingest` (src/ingestion/runDukeIngestion.js -> ingestDukeSeason -> normalizeCfbDataGame)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC2: Repeat-run key stability

- **Given** the same provider payload is normalized twice,
- **When** the canonical keys are compared,
- **Then** both runs produce identical keys and equivalent normalized values.
- **Verify:** shell npm test -- --runInBand src/ingestion/normalize.test.js -t "keeps canonical identity stable for repeated payloads"
- **Caller:** `npm run ingest` (src/ingestion/runDukeIngestion.js -> ingestDukeSeason -> normalizeCfbDataGame)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC3: Absent enrichment stays absent

- **Given** a provider payload omits an optional enrichment,
- **When** normalization runs,
- **Then** authoritative schedule and score fields remain present and the missing enrichment is represented as absent rather than invented.
- **Verify:** shell npm test -- --runInBand src/ingestion/normalize.test.js -t "preserves authoritative fields when optional enrichment is absent"
- **Caller:** `npm run ingest` (src/ingestion/runDukeIngestion.js -> ingestDukeSeason -> normalizeCfbDataGame)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

---

## Scope

### In Scope

- Contract tests for `normalizeCfbDataGame`, `slugify`, and `getPayloadHash` against representative CFBData fixtures.
- Assertions that canonical Duke game fields (score, status, season, date key, external id) survive normalization.
- Key stability across repeated normalization of the same payload, including payload hash determinism.
- Representation of omitted optional enrichment (null/absent metadata) without inventing values.

### Out of Scope

- New external provider integrations beyond CFBData payloads.
- Supabase write behavior; persistence and idempotency are US-01M2QXB2.
- Fact calculation or event detection; those consume normalized records downstream.
- Legacy table compatibility logic.

---

## Technical Notes

Keep `normalizeCfbDataGame` pure: no network, no env reads, no side effects. Identity components are
`slugify`-derived slugs, provider external ids, season, date key, and SHA-256 payload hash via
`getPayloadHash`. Score normalization already coerces null to null (`normalizeScore`), which is the
"absent, not invented" behavior AC3 pins down. Fixtures in `normalize.test.js` should include a full
payload, a minimal payload with missing optional fields, and one with null score/startDate to lock the
fallback paths (`unknown-<id>` date key, null score).

### API Contracts

No inbound API. This is an internal module contract: `normalizeCfbDataGame(game) -> canonical record`
consumed by `ingestDukeSeason`/`persistMasterGame` in `src/ingestion/ingestionEngine.js`. Outbound:
CFBData REST payloads remain the sole input shape; no change to the provider client here.

### Data Requirements

- Representative CFBData game payload fixtures with home/away teams, ids, conferences, Elo metadata, startDate, season, and completed/in-progress/scheduled status.
- A minimal fixture omitting optional enrichment fields to exercise the absent-value path.
- No database access required for this story; tests run without Supabase credentials.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Payload missing the external game id | Normalization throws "CFBData game is missing an external id"; ingestion fails rather than persisting a keyless record. |
| Team name missing or empty | Slug falls back to `team-<id>`; name falls back to "Unknown team"; identity remains stable. |
| startDate missing | Date key falls back to `unknown-<game id>` deterministically. |
| Score field null vs absent | Both normalize to null; never coerced to 0. |
| Non-ASCII team names | `slugify` NFKD-normalizes and strips diacritics so keys stay ASCII-stable. |
| Same team appears twice in one season | Identical team identity is emitted both times so the persistence layer can reuse rather than duplicate. |
| Payload hash content determinism | Identical serialized content produces the same hash; a changed payload value produces a different hash. Key-order canonicalization is not part of this story. |

---

## Test Scenarios

- [ ] Normalize a complete CFBData payload and assert sport/team/game/participant/source fields (jest "normalizes").
- [ ] Normalize the same payload twice and deep-compare keys and values (named repeated-payload test).
- [ ] Normalize a payload with missing optional enrichment and assert schedule/score presence plus absent enrichment (jest "optional").
- [ ] Assert the missing-id error path and the `unknown-<id>` date-key fallback.
- [ ] Assert repeated team IDs produce reusable team identity fields across two game payloads.
- [ ] Assert `slugify` output for diacritics, ampersands, and punctuation.
- [ ] Assert repeated serialized payload content hashes equally and changed payload content hashes differently.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QXB2](US-01M2QXB2-make-canonical-ingestion-reruns-idempotent-and-recoverable.md) | Downstream | Consumes normalized identities to prove repeat-run reuse without duplicate rows. | Draft |
| [US-01M2QXB4](US-01M2QXB4-refresh-paginated-facts-and-directives-deterministically.md) | Downstream | Fact refresh reads canonical games produced from normalized records. | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| CFBData API payload shape | Data | Available; fixture payloads to be checked in with tests. |
| EP-01M2QXM7 canonical schema | Schema | Defined by supabase/migrations/20260916133805_sports_publishing_foundation.sql. |

---

## Estimation

**Points:** 5
**Complexity:** Medium

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/ingestion/normalize.js` | `git revert` the story commit; re-run `npm test` to confirm green | < 15 min |
| Canonical data written by a changed normalizer | Re-ingest affected season via `npm run ingest` after revert | < 1 job run |

---

## Resolved Questions

- Provider-version provenance is deferred to the canonical source-persistence story; this normalizer
  retains the deterministic payload hash and provider/external-game identity only.
- Winsipedia enrichment remains a separate provider adapter and is not normalized by this CFBData
  contract.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | Three Amigos | Narrowed verifier selectors, bounded the payload-hash claim, and added explicit repeated-team/hash scenarios. |
