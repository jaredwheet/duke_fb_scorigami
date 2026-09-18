# PL-01M2QZ03: Normalize provider games into canonical records

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Story:** US-01M2QXGN
> **Epic:** [EP-01M2QXM7: Canonical Sports Data and Verified Facts](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md)
> **Created:** 2026-09-17
> **Language:** JavaScript ES modules on Node.js 22

## Overview

Add regression coverage around the existing pure CFBData normalization contract. The expected change
is primarily test coverage in `src/ingestion/normalize.test.js`; change production normalization only
if a red test demonstrates that the extracted story contract is not met. Preserve the existing provider,
ingestion, and persistence boundaries.

## Acceptance Criteria Summary

| AC | Name | Description |
| ---- | ------ | ----------- |
| AC1 | Stable canonical identities | A complete CFBData game produces stable sport, team, game, participant, and source records. |
| AC2 | Repeat-run key stability | Repeating normalization for the same payload produces identical keys and equivalent values. |
| AC3 | Absent enrichment stays absent | Missing optional enrichment does not remove authoritative fields or invent values. |

---

## Technical Context

### Language & Framework

- **Primary Language:** JavaScript ES modules
- **Runtime:** Node.js 22
- **Framework:** None; pure domain modules and batch entrypoints
- **Test Framework:** Jest 30 via the repository `npm test` script

### Relevant Best Practices

- Keep `normalizeCfbDataGame`, `slugify`, and `getPayloadHash` deterministic and side-effect free.
- Use `const`/`let`, `async`/`await` at async boundaries, and explicit error assertions.
- Test at the provider boundary with representative fixtures; do not call CFBData or Supabase from
  this unit story.
- Assert exact observable fields and error text instead of broad truthiness.

### Library Documentation (Context7)

No external library API needs to be introduced. The story uses the existing Jest 30 command and the
Node `crypto` SHA-256 implementation already imported by `normalize.js`; no new dependency is planned.

### Existing Patterns

`normalize.test.js` currently exercises `buildMasterGameObject` with a complete CFBData fixture and
asserts canonical key, status, participants, and source metadata. Extend that colocated test file with
small fixtures and focused assertions. `buildMasterGameObject` delegates to `normalizeCfbDataGame` and
defaults `enrichments` to `{}`, which is the seam for AC3.

---

## Recommended Approach

**Strategy:** TDD

**Rationale:** The story has clear Given/When/Then criteria, more than five edge cases, deterministic
business rules, and a critical normalization contract. Write each missing regression test first, observe
the failure or vacuous result, then make the smallest implementation correction only if required.

### Test Priority

1. Add a focused test for absent optional enrichment and preserve score/status fields.
2. Add repeat-run deep equality checks for canonical key, team identities, source ID, and payload hash.
3. Add malformed/minimal payload cases and run the complete Jest suite.

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
| --- | --- | --- | --- | --- |
| 1 | Add a complete fixture assertion for canonical sport/team/game/participant/source identity and name the test with the AC contract. | `src/ingestion/normalize.test.js` | None | [x] |
| 2 | Add a repeat-normalization test that compares canonical key, participants, and payload hash for the same payload. | `src/ingestion/normalize.test.js` | Task 1 | [x] |
| 3 | Add missing-enrichment, missing-ID, missing-date, null-score, fallback-team, repeated-team identity, scheduled/in-progress status, diacritic, and payload-hash edge cases. | `src/ingestion/normalize.test.js` | Tasks 1-2 | [x] |
| 4 | If a regression test exposes a mismatch, make the smallest change in `src/ingestion/normalize.js` and preserve existing callers. | `src/ingestion/normalize.js` | Task 3 | [x] Not required; existing implementation passed. |
| 5 | Run focused Jest selectors and the full `npm test` suite; update the story verification report without marking unresolved manual ACs green. | `src/ingestion/normalize.test.js` | Tasks 1-4 | [x] |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
| --- | --- | --- |
| Sequential | 1, 2, 3, 4, 5 | Shared fixture/test file and TDD ordering require one lane. |

---

## Blind Review

The task list was reviewed against the story contract without relying on implementation details:

| Story requirement | Plan coverage |
| --- | --- |
| AC1 stable canonical identities | Tasks 1 and 5; complete-game fixture assertions and focused verification. |
| AC2 repeat-run key stability | Tasks 2 and 5; repeated payload/key/hash assertions and focused verification. |
| AC3 absent enrichment stays absent | Tasks 3 and 5; explicit empty-enrichment fixture and named executable verification. |
| Seven listed edge cases | Task 3, with one handling strategy and phase for each edge case. |
| Out-of-scope provider/persistence boundaries | No task adds a provider, database call, or legacy-schema change. |

No acceptance criterion is unmapped and no task exceeds the story scope. The plan intentionally allows
Task 4 to be a no-op when the current implementation already satisfies the extracted contract.

---

## Implementation Phases

### Phase 1: Establish Failing Contract Tests

**Goal:** Make every story AC and edge case observable through focused Jest assertions.

- [x] Refactor the current complete-game fixture into reusable input data without changing its asserted contract.
- [x] Add repeat-run and omitted-enrichment cases before changing production code.
- [x] Add explicit assertions for missing ID error text, fallback team/date values, null scores, diacritics, repeated-team identity, and hash determinism.

**Files:** `src/ingestion/normalize.test.js` - extend the colocated normalization contract suite.

### Phase 2: Minimal Production Correction, If Required

**Goal:** Make the smallest source change needed if a new contract test exposes a real implementation defect.

- [x] Compare test results with the current PRD/TRD contract and classify any failure as a spec correction or code bug.
- [x] Confirm no production correction was required; the existing pure functions and callers remain unchanged.

**Files:** `src/ingestion/normalize.js` only if a red contract test proves a defect.

### Phase 3: Testing & Validation

**Goal:** Verify all acceptance criteria and preserve the existing suite.

| AC | Verification Method | File Evidence | Status |
| ---- | --------------------- | --------------- | -------- |
| AC1 | `shell npm test -- --runInBand src/ingestion/normalize.test.js -t "normalizes a CFBData game"` plus focused identity assertions | `src/ingestion/normalize.test.js` | Pass |
| AC2 | `shell npm test -- --runInBand src/ingestion/normalize.test.js -t "keeps canonical identity stable for repeated payloads"` plus repeated-payload assertions | `src/ingestion/normalize.test.js` | Pass |
| AC3 | `shell npm test -- --runInBand src/ingestion/normalize.test.js -t "preserves authoritative fields when optional enrichment is absent"` | `src/ingestion/normalize.test.js` | Pass |

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
| --- | --- | --- | --- |
| 1 | Payload missing the external game ID | Assert exact `CFBData game is missing an external id` error and prevent a normalized record. | Phase 1 |
| 2 | Team name missing or empty | Assert stable `team-<id>` slug and `Unknown team` display name. | Phase 1 |
| 3 | `startDate` missing | Assert `unknown-<game id>` date key without relying on the wall clock. | Phase 1 |
| 4 | Score field null versus absent | Assert both become `null`, never numeric zero. | Phase 1 |
| 5 | Non-ASCII team name | Assert NFKD/diacritic removal and stable ASCII slug output. | Phase 1 |
| 6 | Same team appears in multiple games | Assert repeated team identity is equal and suitable for downstream upsert reuse. | Phase 1 |
| 7 | Payload hash content changes | Assert identical serialized content hashes identically and a changed payload value changes the SHA-256 hash; key-order canonicalization is out of scope. | Phase 1 |

**Coverage:** 7/7 edge cases handled in the plan.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing implementation already passes AC1/AC2, so broad selectors could report vacuous green. | High | Use named tests and run `verify_ac` after tests are written; never accept a zero-test Jest run. |
| AC3 initially had manual verification only. | Medium | Added a named omitted-enrichment test and repointed the Verify line before closure. |
| Changing canonical key shape breaks downstream persistence. | High | Do not change key construction without a failing contract test and downstream review; run full suite. |
| Story dependency metadata describes downstream stories but not implementation ordering. | Medium | This story changes only normalization/tests; canonical persistence and facts remain later stories. |

---

## Definition of Done

- [x] All acceptance criteria implemented or explicitly resolved with evidence.
- [x] Unit tests written and passing for all seven edge cases plus the three AC cases.
- [x] All three AC verifier selectors execute named tests.
- [x] Full `npm test` suite passes.
- [x] Code follows existing ES module and Jest conventions.
- [x] No linting or structural validation errors.
- [x] Story, plan, and test-spec traceability remains reconciled.

---

## Notes

No database, CFBData, Supabase, or external provider credentials are needed for this story. The two
story open questions are resolved for this plan as follows: provider payload-version provenance is a
future persistence concern, and Winsipedia enrichment remains a separate adapter outside this story.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | SDLC Studio story plan | Created the AC coverage matrix, unit test cases, fixtures, and current automation baseline. |
| 2026-09-17 | Three Amigos | Narrowed verifier selectors, added repeated-team coverage, and bounded the payload-hash claim. |
| 2026-09-17 | TDD implementation | Added ten normalization regression tests; no production correction was required. |
| 2026-09-17 | TDD implementation | Completed all plan phases; focused and full Jest suites pass and all three ACs verify. |
| 2026-09-17 | TDD implementation | Added ten normalization regression tests; no production correction was required. |
