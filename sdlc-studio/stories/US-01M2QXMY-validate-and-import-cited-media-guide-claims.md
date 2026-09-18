# US-01M2QXMY: Validate and import cited media-guide claims

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** data/media-guides/2026.json, src/mediaGuide/schema.js, src/mediaGuide/curateGuide.js, src/mediaGuide/loadGuide.js, src/mediaGuide/mediaGuideRepository.js, src/mediaGuide/importGuideClaims.js, src/mediaGuide/mediaGuide.test.js, supabase/migrations/20260916150000_add_media_guide_claims.sql, supabase/migrations/20260918170000_media_guide_claim_hashes.sql, supabase/migrations/20260918190000_media_guide_import_contract_fix.sql
> **Epic:** EP-01M2QXHW
> **Points:** 8
> **Persona:** Avery Brooks

## User Story

**As a** Avery Brooks
**I want** the reviewed 2026 media-guide artifact to satisfy its season-preview and citation contracts and imported claims to retain edition, citation, hash, and verification state
**So that** historical context is source-backed and reusable without parsing the PDF during every send.

## Context

### Persona Reference

**Avery Brooks** - Duke football follower, the served reader; wants sourced historical claims rather than invented ones, and trusts guide context with a clear source record.
[Full persona details](../personas/stakeholders/avery-brooks.md)

### Background

`src/mediaGuide/` holds the media-guide pipeline: `extractPdf.js` writes generated page text under
`data/generated/`, `curateGuide.js` validates the curated JSON, `loadGuide.js`/
`mediaGuideRepository.js` load the artifact for rendering, and `importGuideClaims.js`
(`npm run import:guide`) persists claims after
`supabase/migrations/20260916150000_add_media_guide_claims.sql`. PRD FR-009 requires claims to retain
source-page and verification metadata, and the epic requires the artifact to be repeatable rather than
parsed per send. This story pins the artifact contract, the import metadata contract, and the
derived-output boundary.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Data integrity | The checked-in JSON is the reviewed 2026 source artifact; generated text is derived. | AC1/AC3 assert artifact validity and that generated output stays out of the runtime contract. |
| PRD | Functional | FR-009: media-guide claims retain source-page and verification metadata when imported. | AC2 encodes edition, citation, hash, and verification-state persistence. |
| PRD | Security | External source text is untrusted until validation. | Claim import validates before persisting; hashes pin the reviewed source. |

---

## Acceptance Criteria

### AC1: Artifact contract validation

- **Given** the checked-in 2026 media-guide PDF and curated JSON artifact,
- **When** guide validation runs,
- **Then** the artifact satisfies the season-preview and citation contracts.
- **Verify:** shell npm test -- --runInBand src/mediaGuide/mediaGuide.test.js -t "^QMY AC1 validates the checked-in 2026 PDF and JSON through curation and preview$"
- **Caller:** `npm run curate:guide` (src/mediaGuide/curateGuide.js) and `npm run guide:preview` (src/mediaGuide/printSeasonPreview.js)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC2: Cited claim import

- **Given** a guide claim includes source page and verification metadata,
- **When** claims import runs after its migration is applied,
- **Then** the persisted claim retains its edition, citation, hash, and verification state.
- **Verify:** shell npm test -- --runInBand src/mediaGuide/mediaGuide.test.js -t "^QMY AC2 builds 33 unique verified claim rows with bounded citations$"
- **Caller:** `npm run import:guide` (src/mediaGuide/importGuideClaims.js -> mediaGuideRepository.js)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC3: Derived extraction output stays out of runtime

- **Given** PDF extraction runs locally,
- **When** generated page text is written,
- **Then** it remains under ignored data/generated output and is not required by newsletter rendering.
- **Verify:** shell npm test -- --runInBand src/mediaGuide/mediaGuide.test.js -t "^QMY AC3 renders guide-backed newsletter context from a clean cwd without generated pages$"
- **Caller:** `npm run extract:guide` (src/mediaGuide/extractPdf.js)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

> **AC2 isolated evidence (2026-09-18):** Base and forward claims migrations are applied in production
> and `supabase-test`. The disposable RPC import accepted a 33-claim fixture twice with the same edition
> identity and returned `claim_count=33`; a 32-claim call failed before writes and the database remained
> at one edition/33 claims. Production schema migration is applied, but the local CLI import adapter
> cannot run without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the checked-in artifact/hash and
> import-row contract are covered by Jest, while live artifact import remains an operator credential step.

---

## Scope

### In Scope

- Curation validation of the checked-in 2026 JSON artifact (season-preview and citation contracts).
- Claim import with edition, citation, hash, and verification-state retention after migration `20260916150000_add_media_guide_claims.sql`.
- Forward migrations `20260918170000_media_guide_claim_hashes.sql` and
  `20260918190000_media_guide_import_contract_fix.sql` with claim-level source/hash/citation columns,
  exact-33 contract, drift comparison, and atomic import RPC.
- `data/generated/` extraction output staying git-ignored and outside newsletter rendering dependencies.
- `mediaGuide.test.js` coverage for the artifact and import contracts.

### Out of Scope

- Supporting future (2027+) guide editions; their artifact/version contract is an epic open question.
- Replacing the checked-in artifact with a live scraper.
- Newsletter rendering of guide context beyond the load boundary.
- PDF parsing library changes.

---

## Technical Notes

`extractPdf.js` writes page text under `data/generated/`, which `.gitignore` already excludes. `curateGuide.js`
is the validation gate for the curated JSON and `printSeasonPreview.js` prints the season-preview contract.
`importGuideClaims.js` is a thin CLI adapter over an injectable repository import function; the forward migration
adds claim-level provenance and an atomic service-role RPC. Claims are hashed from exact reviewed PDF bytes and
canonical sorted JSON so a re-import is idempotent and artifact drift fails closed. Tests run against the
checked-in artifact, never generated output.

### API Contracts

No inbound API. Internal contracts: `npm run extract:guide` (extractPdf.js),
`npm run curate:guide` (curateGuide.js), `npm run guide:preview` (printSeasonPreview.js),
`npm run import:guide` (importGuideClaims.js); loading via `loadGuide.js`/`mediaGuideRepository.js`.
Outbound: Supabase writes for claims after the claims migration; PDF parsing is local.

### Data Requirements

- Checked-in 2026 media-guide PDF and curated JSON artifact.
- Claim fixtures carrying edition, citation ID, source page, verification metadata, source hash, and claim hash.
- Claims table from `supabase/migrations/20260916150000_add_media_guide_claims.sql` in an isolated or real database.
- `data/generated/` remains in `.gitignore`; no generated files required by tests or rendering.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- | --- |
| Curated JSON missing a required citation field | Curation validation fails loudly; artifact not accepted. |
| Claim re-imported after a first successful import | Idempotent upsert by identity/hash; no duplicate claims. |
| Artifact content changed but hash not refreshed | Hash mismatch detected; import refuses or flags the drift. |
| Migration not yet applied before import | Import fails with a clear missing-table error; no partial writes. |
| PDF extraction re-run | Overwrites derived output under `data/generated/` only; checked-in artifacts untouched. |
| Claim with an unresolvable source page | Claim rejected or flagged rather than persisted with a fabricated citation. |
| Import runs on a database with other sports present | Claim identity scoped to edition/guide source; no cross-sport bleed. |

---

## Test Scenarios

- [ ] Validate the checked-in 2026 artifact, source hash, citations, and season preview (exact QMY AC1 selector).
- [ ] Build 33 unique claim rows with resolved bounded citations, source hash, claim hash, and verified state (exact QMY AC2 selector).
- [ ] Render guide-backed context from a clean cwd without generated pages (exact QMY AC3 selector).
- [ ] Isolated import twice: stable edition/claim IDs and no duplicate claims.
- [ ] Missing migration, source drift, invalid citation, duplicate key, and stale claim-set failure tests.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QXAG](US-01M2QXAG-render-fact-backed-newsletter-editions-safely.md) | Downstream | Rendered editions load guide context through `loadGuide.js`. | Done |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Migration `supabase/migrations/20260916150000_add_media_guide_claims.sql` | Schema | Checked in; applied before `npm run import:guide`. |
| Reviewed 2026 guide PDF/JSON artifacts | Data | Checked in under `data/`. |

---

## Estimation

**Points:** 5
**Complexity:** Medium

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/mediaGuide/*.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| Claims migration/import | Additive; revert via corrective migration or database snapshot; claims re-import is idempotent | < 1 hour with snapshot |

---

## Resolved Questions

- Future guide editions require a new reviewed artifact/schema/citation contract (D0006); this story accepts only 2026.
- Claims import requires the base and forward migrations in every import environment, while artifact-backed rendering
  does not require the claims table (D0007).

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-18 | Three Amigos refinement | Added exact selectors, citation/page/hash/idempotency contracts, atomic import boundary, 2026-only edition decision, and forward migration scope. |
