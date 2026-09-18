# TS-01M2R9XA: Paginated Facts and Deterministic Directives

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Epic:** [EP-01M2QXM7: Canonical Sports Data and Verified Facts](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md)
> **Story:** [US-01M2QXB4: Refresh paginated facts and directives deterministically](../stories/US-01M2QXB4-refresh-paginated-facts-and-directives-deterministically.md)
> **Created:** 2026-09-17
> **Last Updated:** 2026-09-17

## Overview

This spec covers full canonical-history pagination, deterministic fact/directive selection, stable
versioned persistence, and absent-evidence safeguards. Tests use injected Supabase-shaped clients and
pure fact/directive fixtures; the default Jest suite never contacts providers or production Supabase.

## Scope

### Stories Covered

| Story | Title | Priority |
| --- | --- | --- |
| [US-01M2QXB4](../stories/US-01M2QXB4-refresh-paginated-facts-and-directives-deterministically.md) | Refresh paginated facts and directives deterministically | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
| --- | --- | --- | --- | --- |
| US-01M2QXB4 | AC1 | Every canonical page contributes to fact calculation. | TC001, TC002, TC003, TC004 | Automated; focused selector passes |
| US-01M2QXB4 | AC2 | Highest-priority supported directive is selected without AI calculation. | TC005, TC006, TC007, TC008, TC009 | Automated; focused selector passes |
| US-01M2QXB4 | AC3 | Missing evidence yields no unsupported fact/directive. | TC010, TC011, TC012 | Automated; focused selector passes |

**Coverage:** 3/3 ACs mapped to test cases; all 12 cases are automated and the full Jest suite passes (27 suites, 92 tests).

### Test Types Required

| Type | Required | Rationale |
| --- | --- | --- |
| Unit | Yes | Pure score, narrative, and directive logic is deterministic and locally testable. |
| Integration | Yes | Refresh pagination and upsert conflict keys cross the Supabase-shaped persistence boundary; an isolated target is optional for follow-up evidence. |
| E2E | No | No inbound API or user-facing UI is changed. |

### Strategy Heuristics

- [x] **Production-state-shape integration test** - the refresh fixture includes 1,001 canonical games and separate participant/team/analytics pages rather than a trivial single-row state.
- [x] **Rejects-old-shape contract test** - not applicable; this story preserves the canonical row shape and changes no public wire contract.
- [x] **Regression test per fixed bug** - the vacuous `pagination` and `safeguard` selectors receive named executable tests in the story's existing test seams.

---

## Environment

| Requirement | Details |
| --- | --- |
| Prerequisites | Node.js 22, Jest 30, existing media-guide fixtures, and an injected Supabase-shaped client. |
| External Services | None for default tests; no AI/provider credentials or live database required. |
| Test Data | 1,001 canonical final games, participant/team/analytics page fixtures, competing directive facts, missing scores, and missing play evidence. |

## Test Cases

### TC001: Full-history pagination beyond 500 rows

**Type:** Unit/integration seam | **Priority:** High | **Story:** US-01M2QXB4 AC1

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | An injected client returns 1,001 games and related rows in 500-row pages. | Range calls occur at offsets 0, 500, and 1,000 for each paged canonical table. |
| When | `refreshDukeFacts` runs. | Games from the second and third pages are included in fact calculation and persistence. |
| Then | Inspect fact writes and page calls. | All 1,001 game facts are represented; no history is silently omitted. |

**Automation:** `src/facts/refreshFacts.test.js` test title includes `pagination`.

---

### TC002: Exact multiple pagination terminates

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB4 AC1 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A table returns exactly 500 rows at offset 0 and an empty page at offset 500. | The client records the terminating empty-page request. |
| When | `fetchAllRows` runs. | It returns exactly 500 rows and does not request offset 1,000. |
| Then | Inspect calls. | Pagination terminates without an infinite loop or duplicate page. |

**Automation:** `src/facts/refreshFacts.test.js` test title includes `pagination`.

---

### TC003: Empty history produces no writes

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXB4 AC1 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Every canonical table returns an empty first page. | The calculated game list is empty. |
| When | `refreshDukeFacts` runs. | It returns 0 and performs no fact/directive upsert. |
| Then | Inspect writes. | No unsupported default fact or directive is invented. |

**Automation:** `src/facts/refreshFacts.test.js` test title includes `pagination`.

---

### TC004: Mid-refresh page failure propagates

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB4 AC1 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A later page returns a stable error after an earlier page succeeds. | The error identifies the failed query in the test double. |
| When | `refreshDukeFacts` runs. | The promise rejects and later pages/writes are not reported as successful. |
| Then | Retry with the error removed. | Stable upserts allow the refresh to recompute the same facts. |

**Automation:** `src/facts/refreshFacts.test.js`.

---

### TC005: Highest-priority supported directive wins

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB4 AC2

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Facts contain a new score, record, comeback, upset, and late-game signal. | All candidates are locally code-generated inputs from the story's supported signal types. |
| When | `detectEvents` runs. | The tier-one `scorigami_final` directive is primary. |
| Then | Inspect priority and facts. | The primary retains evidence fields and no AI/provider call is needed. |

**Automation:** `src/eventDetector.test.js`.

---

### TC006: Deterministic tie-breaking

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB4 AC2 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Two eligible directives have equal tier and priority but different keys. | Candidate insertion order is varied between runs. |
| When | `detectEvents` runs. | The same ascending `directiveKey` wins both times. |
| Then | Compare results. | Primary selection is stable and reproducible. |

**Automation:** `src/eventDetector.test.js`.

---

### TC007: Primary-only refresh persistence

**Type:** Unit/integration seam | **Priority:** High | **Story:** US-01M2QXB4 AC2

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A game has multiple eligible signals, and the selected primary declares more than one issue type. | `detectEvents` returns one deterministic primary and its declared issue types. |
| When | `refreshDukeFacts` persists the game. | Only the primary directive is persisted; the same primary key may appear once per declared issue type. |
| Then | Inspect directive writes. | Lower-priority candidates are not emitted, and no second directive key is written for the game. |

**Automation:** `src/facts/refreshFacts.test.js`.

---

### TC008: Versioned fact/directive rerun keys

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB4 AC2 edge cases

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | The same game is refreshed once with no override and once with a test-only `v3` logic-version override. | The first refresh carries production-default `EVENT_LOGIC_VERSION` (`v2`); the second carries `v3`. |
| When | Both refreshes run, then the `v3` refresh is repeated. | `v2` and `v3` logical rows remain distinct, while the repeated `v3` refresh reuses its rows. |
| Then | Inspect calls and state. | Version participates in the key/payload, proving a logic change is distinguishable without duplicating a single version. |

**Automation:** `src/facts/refreshFacts.test.js`.

---

### TC009: Directive calculation has no AI/provider dependency

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXB4 AC2

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Direct fact inputs are supplied to `detectEvents`. | The module graph is limited to local deterministic code. |
| When | Directive calculation runs. | It completes without network/provider invocation. |
| Then | Inspect result. | The directive is derived solely from supplied verified facts. |

**Automation:** `src/eventDetector.test.js`.

---

### TC010: Missing completed-game score is omitted

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB4 AC3 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A completed game has a missing Duke or opponent score. | The game has no valid score pair. |
| When | Score facts calculate. | The game is excluded and no invented score fact exists. |
| Then | Inspect result. | No unsupported score directive can be selected. |

**Automation:** `src/facts/scoreFacts.test.js` test title includes `safeguard`.

---

### TC011: Missing narrative evidence is empty

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXB4 AC3

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A game has participants and final scores but no verified play progression or record evidence. | Narrative calculation has no supported signal. |
| When | `calculateGameNarrativeFacts` and `buildHeadlineDirective` run. | Narrative facts are empty and the directive is null. |
| Then | Inspect output. | No comeback, late-game, upset, or record claim is fabricated. |

**Automation:** `src/facts/gameNarrativeFacts.test.js` and `src/eventDetector.test.js` test titles include `safeguard`.

---

### TC012: Refresh safeguard clears stale unsupported facts and directives

**Type:** Unit/integration seam | **Priority:** High | **Story:** US-01M2QXB4 AC3

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A valid refresh has persisted current-version facts/directives, then the same game loses required score or narrative evidence. | The next refresh identifies no supported directive for the game. |
| When | `refreshDukeFacts` runs and the newsletter read path queries the game. | Current-version derived rows are cleared/recomputed and older logic versions are not selected for publication. |
| Then | Inspect the injected client's state and query contract. | No stale unsupported fact/directive remains publishable. |

**Automation:** `src/facts/refreshFacts.test.js` test title includes `safeguard`; `src/newsletter/loadSundayIssueData.test.js` proves the loader filters the current logic version.

---

## Fixtures

```yaml
page_size: 500
history_rows: 1001
signals:
  scorigami: {isNew: true, score: "3-17", occurrenceCount: 0}
  historic: {isRecord: true, recordWatch: {status: record}}
  narrative: {comeback: true, upset: true, lateGameWin: true}
missing_score: {status: final, duke_score: null, opponent_score: 17}
missing_narrative: {status: final, plays: [], record_watch: null}
conflict_keys:
  fact: game_id,fact_key,logic_version
  directive: game_id,issue_type,directive_key,logic_version
```

---

## Automation Status

| TC | Title | Status | Implementation |
| --- | --- | --- | --- |
| TC001 | Full-history pagination beyond 500 rows | Automated | `src/facts/refreshFacts.test.js` |
| TC002 | Exact multiple pagination terminates | Automated | `src/facts/refreshFacts.test.js` |
| TC003 | Empty history produces no writes | Automated | `src/facts/refreshFacts.test.js` |
| TC004 | Mid-refresh page failure propagates | Automated | `src/facts/refreshFacts.test.js` |
| TC005 | Highest-priority supported directive wins | Automated | `src/eventDetector.test.js` |
| TC006 | Deterministic tie-breaking | Automated | `src/eventDetector.test.js` |
| TC007 | Primary-only refresh persistence | Automated | `src/facts/refreshFacts.test.js` |
| TC008 | Versioned fact/directive rerun keys | Automated | `src/facts/refreshFacts.test.js` |
| TC009 | Directive calculation has no AI/provider dependency | Automated | `src/eventDetector.test.js` |
| TC010 | Missing completed-game score is omitted | Automated | `src/facts/scoreFacts.test.js` |
| TC011 | Missing narrative evidence is empty | Automated | `src/facts/gameNarrativeFacts.test.js`, `src/eventDetector.test.js` |
| TC012 | Refresh safeguard clears stale unsupported facts and directives | Automated | `src/facts/refreshFacts.test.js`, `src/newsletter/loadSundayIssueData.test.js` |

---

## Traceability

| Artefact | Reference |
| --- | --- |
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP-01M2QXM7](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md) |
| Story | [US-01M2QXB4](../stories/US-01M2QXB4-refresh-paginated-facts-and-directives-deterministically.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-17 | OpenCode; agent; v1 | Added 12 executable cases covering all three ACs and seven edge cases. |
| 2026-09-17 | OpenCode; agent; v1 | Automated all 12 cases; focused selectors and full Jest suite pass. |
| 2026-09-17 | OpenCode; agent; v1 | Added executable newsletter-loader coverage for current-version filtering. |
