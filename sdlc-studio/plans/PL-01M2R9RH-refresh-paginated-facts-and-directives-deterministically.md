# PL-01M2R9RH: Refresh paginated facts and directives deterministically

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Story:** [US-01M2QXB4: Refresh paginated facts and directives deterministically](../stories/US-01M2QXB4-refresh-paginated-facts-and-directives-deterministically.md)
> **Epic:** [EP-01M2QXM7: Canonical Sports Data and Verified Facts](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md)
> **Created:** 2026-09-17
> **Language:** JavaScript ES modules, SQL-backed Supabase persistence, Node.js 22

## Overview

Prove that `refreshDukeFacts` consumes all canonical history pages, computes only code-generated
evidence-backed directives, and persists a deterministic primary directive without emitting unsupported
claims. The existing page loader and fact calculators are retained; the implementation is limited to
the missing test coverage, deterministic tie-break, and refresh persistence selection required by the
story contract.

## Acceptance Criteria Summary

| AC | Name | Description |
| ---- | ---- | ----------- |
| AC1 | Full-history pagination | Every page beyond the first 500 rows contributes to deterministic fact calculation. |
| AC2 | Evidence-backed directives | The highest-priority supported directive is selected deterministically without an AI/provider calculation call. |
| AC3 | Absent-evidence safeguard | Missing required evidence produces omitted/empty facts and no unsupported directive. |

---

## Technical Context

### Language & Framework

- **Primary Language:** JavaScript ES modules on Node.js 22
- **Persistence:** Supabase/Postgres through the existing injected client boundary
- **Test Framework:** Jest 30
- **Runtime entrypoint:** `npm run detect:facts` -> `src/facts/runFactDetection.js`

### Relevant Best Practices

- Keep `fetchAllRows` ordered by `id` and request fixed 500-row ranges until a short or empty page.
- Exercise the real fact and directive functions with representative payloads; do not mock the functions under test.
- Keep numeric facts and directive priorities deterministic and code-generated; no AI or provider import belongs in the computation path.
- Preserve stable fact/directive conflict keys and `EVENT_LOGIC_VERSION` in every persistence payload.
- Clear current-version derived rows before recomputation and make the newsletter read path select the current logic version so unsupported or superseded output is not published.
- Use injected Supabase-shaped doubles in the Jest suite; no service-role credentials or live writes.

### Library Documentation

No new library API is planned. Existing Supabase query-builder calls (`select`, `order`, `range`, and
`upsert`) and the PostgreSQL uniqueness constraints already present in the canonical foundation migration
are the contracts under test.

### Existing Patterns

- `src/facts/refreshFacts.test.js` already provides a paged client double for `fetchAllRows`.
- `src/facts/scoreFacts.test.js` provides canonical Duke/opponent game fixtures.
- `src/facts/gameNarrativeFacts.test.js` provides guide-backed record and play-by-play fixtures.
- `src/eventDetector.test.js` directly asserts tier/priority selection and empty output.
- `src/ingestion/ingestionEngine.test.js` provides a stateful upsert double pattern for rerun assertions.

---

## Recommended Approach

**Strategy:** TDD

**Rationale:** The ACs are clear, the story has seven explicit edge cases, and the current verification
selectors for pagination and safeguards are vacuous. Tests will first pin page termination, directive
ordering, primary-only persistence, stable versioned keys, and missing-evidence behavior. Then the
smallest implementation changes will make those tests pass.

### Test Priority

1. Prove 1,001-row and exact-500-row loads request every required page and terminate on the first short/empty page.
2. Prove all supported signals rank by tier, priority, and stable `directiveKey` tie-break, with no AI/provider calculation.
3. Prove refresh reruns use stable conflict keys, persist only the selected primary directive, and omit unsupported output.

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
| --- | --- | --- | --- | --- |
| 1 | Add refresh fixtures and tests for 1,001 rows, exact multiples of 500, empty history, and page failure propagation. | `src/facts/refreshFacts.test.js` | US-01M2QXB2 Done | [x] |
| 2 | Add deterministic directive tests for supported signals, primary selection, stable key tie-breaking, empty output, and no AI/provider boundary. | `src/eventDetector.test.js`, `src/facts/gameNarrativeFacts.test.js` | Task 1 | [x] |
| 3 | Add refresh persistence tests for primary-only directives, stable fact/directive conflict keys, same-version reruns, and two refreshes under changed logic versions. | `src/facts/refreshFacts.test.js` | Tasks 1-2 | [x] |
| 4 | Implement the deterministic directive tie-break, primary-only persistence, current-version derived-row cleanup, and current-version newsletter reads. | `src/eventDetector.js`, `src/facts/refreshFacts.js`, `src/newsletter/loadSundayIssueData.js`, `src/newsletter/loadSundayIssueData.test.js` | Tasks 1-3 | [x] |
| 5 | Add safeguard coverage for missing scores, missing narrative evidence, and stale derived rows, including no unsupported directive writes. | `src/facts/scoreFacts.test.js`, `src/facts/gameNarrativeFacts.test.js`, `src/facts/refreshFacts.test.js` | Tasks 1-4 | [x] |
| 6 | Run focused and full Jest tests, verify all AC selectors, and record residual manual gaps without claiming live-provider coverage. | `src/facts/*.test.js`, `src/eventDetector.test.js` | Tasks 1-5 | [x] 27 suites/92 tests green; focused selectors pass; no live-provider claim |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
| --- | --- | --- |
| Test fixtures | 1, 2 | Existing fact and directive seams remain unchanged. |
| Persistence tests | 3, 5 | Tasks 1-2 define the fake client and evidence fixtures. |
| Implementation | 4 | Failing tests from Tasks 1-3. |
| Validation | 6 | Tasks 1-5 complete. |

---

## Blind Review

| Story requirement | Plan coverage |
| --- | --- |
| AC1 full-history pagination | Tasks 1 and 6 exercise 1,001 rows, exact 500 rows, empty history, and page errors through `refreshDukeFacts`. |
| AC2 evidence-backed directives | Tasks 2-4 assert all supported input signals, tier/priority/key ordering, exactly one primary selection per game, and no AI/provider calculation path. |
| AC3 absent-evidence safeguard | Task 5 asserts missing scores and missing play/narrative evidence produce empty facts, clear stale current-version rows, and no unsupported directive write. |
| Seven edge cases | Tasks 1, 3, and 5 cover all seven cases: exact multiple, empty, page failure, competing signals, missing score, logic version, and duplicate rerun key. |
| Out-of-scope boundaries | No new fact type, provider, AI call, downstream wording, or migration is introduced. |

No task changes the Supabase query engine or introduces a new service boundary.

---

## Implementation Phases

### Phase 1: Pagination and Evidence Fixtures

**Goal:** Make every missing AC selector execute against meaningful deterministic fixtures.

- [x] Add a stateful paged client that serves games, participants, teams, and analytics in 500-row pages.
- [x] Add 1,001-row, exact-multiple, empty-history, and mid-page-error tests with explicit range-call assertions.
- [x] Add competing-signal and missing-evidence fixtures using the existing canonical game shapes.

**Files:** `src/facts/refreshFacts.test.js`, `src/eventDetector.test.js`, `src/facts/gameNarrativeFacts.test.js`

### Phase 2: Directive Selection and Persistence Contract

**Goal:** Select and persist only deterministic, evidence-backed directives.

- [x] Assert tier first, priority second, and ascending `directiveKey` as the deterministic tie-break.
- [x] Assert `detectEvents` returns an empty primary result when no supported facts exist.
- [x] Assert refresh persists exactly one selected primary directive per game; multiple issue-type rows, when applicable, share that primary and never persist a loser.
- [x] Assert fact and directive upserts carry stable conflict keys and the default `EVENT_LOGIC_VERSION`; repeat refresh creates no duplicate logical rows.
- [x] Exercise the test-only logic-version override across two refreshes and assert distinct versioned rows/payloads are retained.
- [x] Clear current-version derived rows before recomputation and filter downstream newsletter reads to the current version.

**Files:** `src/eventDetector.js`, `src/facts/refreshFacts.js`, `src/facts/refreshFacts.test.js`, `src/eventDetector.test.js`

### Phase 3: Safeguards and Validation

**Goal:** Prove unsupported claims are omitted and all story verifiers are meaningful.

| AC | Verification Method | File Evidence | Status |
| --- | --- | --- | --- |
| AC1 | `npm test -- --runInBand -t "pagination"` plus full suite | `src/facts/refreshFacts.test.js` | Pass: 4 focused tests; full suite green |
| AC2 | `npm test -- --runInBand -t "directive"` plus full suite | `src/eventDetector.test.js`, `src/facts/refreshFacts.test.js` | Pass: 10 focused tests; full suite green |
| AC3 | `npm test -- --runInBand -t "safeguard"` plus full suite | `src/facts/gameNarrativeFacts.test.js`, `src/facts/refreshFacts.test.js` | Pass: 4 focused tests; full suite green |

- [x] Run the focused selectors and confirm they select at least one test each.
- [x] Run the full Jest suite and inspect for regressions in newsletter consumers.
- [x] Record live Supabase/integration validation as a residual gap; the default suite uses injected clients and pure fixtures.

**Files:** `src/facts/*.test.js`, `src/eventDetector.test.js`, `src/newsletter/loadSundayIssueData.js`, `src/newsletter/loadSundayIssueData.test.js`

---

## Edge Case Handling

| # | Edge Case (from Story) | Handling Strategy | Phase |
| --- | --- | --- | --- |
| 1 | History is an exact multiple of 500 | Request and assert the final empty page at the next offset, then terminate without another request. | Phase 1 |
| 2 | History is empty | Return zero, perform no fact/directive writes, and assert no infinite pagination loop. | Phase 1 |
| 3 | A page fails mid-refresh | Propagate the original error, stop later page requests and writes, and leave retry behavior to stable upserts. | Phase 1/3 |
| 4 | Two signals are eligible for one game | Sort by tier, descending priority, then ascending directive key; persist only one primary directive, reused only across its declared issue types. | Phase 2 |
| 5 | Score is missing on a completed game | Exclude the game from score facts, clear current-version derived rows, and assert no unsupported directive is generated or read. | Phase 2/3 |
| 6 | Logic version changes between refreshes | Keep `EVENT_LOGIC_VERSION` as the production default, allow a test-only version override, and assert two versions produce distinguishable rows/payloads. | Phase 2 |
| 7 | Duplicate directive key on rerun | Upsert using `game_id,issue_type,directive_key,logic_version` and assert stable row identity on repeat refresh. | Phase 2 |

**Coverage:** 7/7 edge cases handled in the plan

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing pagination selector passes with no selected tests | High | Name tests with `pagination` and assert focused selectors execute at least one case. |
| Lower-priority directives remain persisted and are consumed downstream | High | Persist only `detection.primary` while retaining detector candidate ordering for tests. |
| Equal-tier/equal-priority signals vary with insertion order | Medium | Add stable `directiveKey` tie-break and direct regression test. |
| Large history makes score calculation slow | Medium | Use the required 1,001-row fixture as a bounded regression signal; leave optimization out of scope. |
| Missing evidence leaves stale rows in a live database | High | Clear current-version fact/directive rows before recomputation and constrain newsletter reads to `EVENT_LOGIC_VERSION`; no schema change is needed. |
| Fixtures accidentally contact AI/provider modules | High | Keep computation imports pure and assert the detector path has no network/provider dependency. |

---

## Definition of Done

- [x] All three acceptance criteria have meaningful executable selectors.
- [x] All seven edge cases have tests or explicit deterministic handling.
- [x] Pagination, directive priority/tie order, primary-only persistence, and safeguards pass.
- [x] Full `npm test` passes.
- [x] No live provider or service-role credential is used by the default suite.
- [x] Current-version derived-row cleanup and newsletter filtering prevent stale unsupported output.
- [x] Independent code review approves the implementation; residual live-provider validation is explicitly non-blocking.
- [x] Independent plan/code review and reviewer-of-record sign-off are recorded.

---

## Resolved Questions

- Directive ties are resolved by ascending `directiveKey` after tier and descending priority.
- Refresh persists only one selected primary directive per game; candidate discovery remains available in `detectEvents` for deterministic tests, and a primary's declared issue types do not create additional candidates.
- Refresh clears current-version derived rows before recomputation, and newsletter reads filter to the current logic version so older versions remain distinguishable but are not published.
- Whole-history performance beyond the required 1,001-row regression fixture remains outside this story; the maximum history-size question remains owned by Rowan Patel.
- Future directive priority re-validation remains an operational follow-up owned by Jamie Carter; new signal types must carry their own priority review and tests.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-17 | OpenCode; agent; v1 | Added TDD phases, primary-directive persistence boundary, deterministic tie rule, and 7/7 edge-case handling. |
| 2026-09-17 | Reviewer-of-record | Sign-off recorded after independent approval and passing AC verification. |
| 2026-09-17 | OpenCode; agent; v1 | Implemented pagination, directive selection, versioned persistence, and safeguard tests; focused selectors and full Jest suite pass. |
| 2026-09-17 | OpenCode; agent; v1 | Repaired stale derived-row publication, bumped directive logic to v2, and filtered newsletter reads to the current version after independent review. |
| 2026-09-17 | OpenCode; agent; v1 | Re-ran focused selectors and full Jest suite after review repairs: pagination 4, directive 10, safeguard 4, full 26 suites/91 tests; all AC verifiers pass. |
| 2026-09-17 | OpenCode; agent; v1 | Added executable newsletter current-version regression coverage; full suite now passes at 27 suites/92 tests. |
| 2026-09-17 | Independent code review | Approved the implementation with no High/Medium findings; focused selectors and full Jest suite pass. |
