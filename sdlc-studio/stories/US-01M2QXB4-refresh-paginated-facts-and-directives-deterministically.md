# US-01M2QXB4: Refresh paginated facts and directives deterministically

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/facts/refreshFacts.js, src/facts/scoreFacts.js, src/facts/gameNarrativeFacts.js, src/eventDetector.js, src/newsletter/loadSundayIssueData.js, src/facts/refreshFacts.test.js, src/facts/scoreFacts.test.js, src/facts/gameNarrativeFacts.test.js, src/eventDetector.test.js, src/newsletter/loadSundayIssueData.test.js
> **Epic:** EP-01M2QXM7
> **Points:** 5
> **Persona:** Avery Brooks

## User Story

**As a** Avery Brooks
**I want** fact refresh to page through all canonical history and event detection to emit only evidence-backed directives
**So that** every historical occurrence is counted and no unsupported claim reaches a publication.

## Context

### Persona Reference

**Avery Brooks** - Duke football follower, the served reader; veto line: a publication must not state an incorrect score, opponent, date, or record as fact.
[Full persona details](../personas/stakeholders/avery-brooks.md)

### Background

`refreshDukeFacts` in `src/facts/refreshFacts.js` recomputes score-history and narrative facts from
canonical games, and `detectEvents`/`buildHeadlineDirective` in `src/eventDetector.js` turn verified
signals into prioritized directives. PRD requires fact refresh to paginate beyond a single 500-row
Supabase response, each fact to persist with a stable key and logic version, and event detection to emit
an explicit empty result when evidence is absent. The code exists; this story pins the pagination,
prioritization, and safeguard contracts with executable tests.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Performance | Fact refresh must paginate beyond one 500-row response (PRD HIGH). | AC1 requires a multi-page fixture proving no history is silently omitted. |
| PRD | Security | FR-002: numeric facts must be code-generated from validated data; AI cannot calculate statistics. | AC2 asserts directive signals are computed without any AI call. |
| PRD | Data integrity | Event detection must not claim an event when required evidence is absent (PRD HIGH). | AC3 requires omission/empty output rather than an unsupported claim. |

---

## Acceptance Criteria

### AC1: Full-history pagination

- **Given** canonical history spans more than one 500-row response,
- **When** fact refresh runs,
- **Then** every page contributes to the deterministic score and narrative fact calculation.
- **Verify:** shell npm test -- --runInBand -t "pagination"
- **Caller:** `npm run detect:facts` (src/facts/runFactDetection.js -> refreshDukeFacts)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC2: Evidence-backed directives

- **Given** a game has a verified score, record, comeback, upset, or late-game signal,
- **When** event detection runs,
- **Then** it emits the highest-priority supported directive and does not require an AI call to calculate the signal.
- **Verify:** shell npm test -- --runInBand -t "directive"
- **Caller:** `npm run detect:facts` (src/facts/runFactDetection.js -> refreshDukeFacts -> detectEvents/buildHeadlineDirective)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC3: Absent-evidence safeguard

- **Given** required evidence for a narrative signal is absent,
- **When** fact refresh runs,
- **Then** the corresponding fact/directive is omitted or empty and no unsupported claim is emitted.
- **Verify:** shell npm test -- --runInBand -t "safeguard"
- **Caller:** `npm run detect:facts` (src/facts/runFactDetection.js -> refreshDukeFacts -> detectEvents/buildHeadlineDirective)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

---

## Scope

### In Scope

- Multi-page (beyond one 500-row response) pagination coverage for score and narrative fact refresh.
- Deterministic directive priority: highest-priority supported directive wins; ties are resolved deterministically.
- Stable fact keys and logic version persistence so a repeat refresh is idempotent.
- Explicit empty/omitted directive output when evidence is missing.
- Proof that directive calculation makes no AI/provider call.

### Out of Scope

- New fact types beyond score-history, records, comebacks, upsets, and late-game signals.
- Changing directive wording or downstream agent consumption.
- Supabase query engine changes; pagination uses the existing client's range/limit mechanism.
- AI-assisted directive enrichment (excluded by FR-002).

---

## Technical Notes

`src/facts/refreshFacts.js` must iterate Supabase range queries (500-row page size) until a short page or
no-more-rows marker, merging pages before computing facts in `scoreFacts.js` and
`gameNarrativeFacts.js`. `EVENT_LOGIC_VERSION` in `src/eventDetector.js` is the logic-version source;
bump it whenever directive semantics change so persisted directives are distinguishable. Refresh clears
current-version derived rows before recomputation, and newsletter reads select the current logic version
so stale unsupported output is not published. Directive
priority ordering lives in `detectEvents`/`buildHeadlineDirective`; tests must prove both the
highest-priority selection and the empty-result branch. All fact math stays in code; the test suite can
assert no network-bound module is imported by the computation path.

### API Contracts

No inbound API. Internal contracts: `refreshDukeFacts() -> count` in `src/facts/refreshFacts.js` consumed
by `src/facts/runFactDetection.js`; `detectEvents(masterGame) -> events` and
`buildHeadlineDirective(masterGame) -> directive` in `src/eventDetector.js`. Outbound: Supabase reads for
canonical games and writes for facts/directives through `supabaseClient.js`.

### Data Requirements

- Fixtures spanning more than 500 canonical game rows (generated or sampled) to exercise pagination.
- Canonical game records with verified scores, records, comebacks, upsets, and late-game signals for directive tests.
- Records lacking narrative evidence for the safeguard test.
- No live provider credentials required; Supabase access is mocked or isolated.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| History size is an exact multiple of 500 | A final empty page is requested; refresh terminates without an infinite loop or missing rows. |
| History is empty | Refresh completes with count 0; no facts or directives persisted. |
| A page fails mid-refresh | Run fails observably (non-zero exit); a retry recomputes idempotently from stable keys. |
| Two signals eligible for one game | The deterministic priority order picks one; the loser is not emitted as a second directive. |
| Score missing on a completed game | Game contributes no score-history fact; no invented score pair. |
| Logic version changes between refreshes | Persisted facts carry the new version so changes are distinguishable. |
| Duplicate directive key on rerun | Upsert by stable key; no duplicate directive rows. |

---

## Test Scenarios

- [x] Feed 1,000+ canonical rows and assert every page contributes to the computed facts (jest "pagination").
- [x] Provide a verified-score/record/comeback game and assert the highest-priority directive with no AI call (jest "directive").
- [x] Provide a game with missing narrative evidence and assert omitted/empty directive (jest "safeguard").
- [x] Exact-multiple-of-500 and empty-history termination tests.
- [x] Repeat refresh and assert stable fact keys and no duplicate directives.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QXGN](US-01M2QXGN-normalize-provider-games-into-canonical-records.md) | Upstream | Normalized canonical games supply the input records. | Done |
| [US-01M2QXB2](US-01M2QXB2-make-canonical-ingestion-reruns-idempotent-and-recoverable.md) | Upstream | Deduplicated canonical rows make fact keys stable. | Done |
| [US-01M2QXQ8](US-01M2QXQ8-validate-ai-editorial-against-immutable-facts.md) | Downstream | Directives become evidence inputs to the editorial fact packet. | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Supabase canonical tables | Data | Available via migrations in EP-01M2QXM7. |

---

## Estimation

**Points:** 5
**Complexity:** Medium

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/facts/*.js`, `src/eventDetector.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| Persisted facts/directives computed by a changed version | Re-run `npm run detect:facts`; stable keys overwrite and logic version marks the change | < 1 job run |

---

## Resolved Questions

- The expected maximum history size under the 10-minute timeout is deferred from this story. The 1,001-row
  pagination fixture is the bounded regression contract; Rowan Patel owns a later production-scale
  performance measurement before history volume grows materially.
- Directive priority re-validation for future signal types is deferred as an operational review owned by
  Jamie Carter. This story fixes the current tier, priority, and key tie-break contract; new signal types
  must add their own priority review and tests.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | SDLC Studio planning | Refreshed upstream dependency statuses after the prerequisite stories reached Done. |
| 2026-09-17 | TDD implementation | Added pagination, deterministic directive, versioned rerun, and safeguard coverage; focused selectors and full suite pass. |
| 2026-09-17 | Adversarial review repair | Bumped `EVENT_LOGIC_VERSION` to v2, cleared current-version stale derived rows, and filtered newsletter reads to the active logic version. |
| 2026-09-17 | TDD implementation | Added executable newsletter-loader coverage for current-version filtering; full suite passes at 27 suites/92 tests. |
| 2026-09-17 | SDLC Studio closure preparation | Resolved the two planning questions as explicitly deferred follow-ups with named owners; no terminal gate override is required. |
