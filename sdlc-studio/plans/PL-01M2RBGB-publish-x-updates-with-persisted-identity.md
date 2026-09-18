# PL-01M2RBGB: Publish X updates with persisted identity

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Story:** [US-01M2QXNM: Publish X updates with persisted identity](../stories/US-01M2QXNM-publish-x-updates-with-persisted-identity.md)
> **Epic:** [EP-01M2QXQF: Reliable X Scorigami Publishing](../epics/EP-01M2QXQF-reliable-x-scorigami-publishing.md)
> **Created:** 2026-09-17
> **Language:** JavaScript ES modules, SQL migrations, Node.js 22

## Overview

Replace the current select-before-post/insert sequence with an atomic persisted publication claim and
finalize state. The workflow will claim `(game_id, score_key)` before any external post, finalize provider
metadata after success, and leave uncertain claims observable instead of silently retrying. Tests execute the
real `run()` orchestration with injected database, game, clock, Scorigami, media, and publisher seams.

## Acceptance Criteria Summary

| AC | Name | Description |
| --- | --- | --- |
| AC1 | Pregame identity | A Wednesday/noon pregame run claims and sends at most one reminder per game. |
| AC2 | Provider metadata | Live/final complete-score posts finalize tweet metadata under the claimed identity. |
| AC3 | Duplicate identity | Existing/claimed identities no-op without a second publisher call. |
| AC4 | Incomplete score guard | Null, non-finite, negative, or fractional scores never reach publication. |
| AC5 | Claim persistence contract | The additive migration and token-owned state transitions enforce the at-most-once claim boundary. |

---

## Technical Context

### Language & Framework

- **Primary Language:** JavaScript ES modules on Node.js 22
- **Persistence:** Supabase/Postgres `tweeted_scores` ledger
- **Test Framework:** Jest 30 with ESM module mocks and stateful doubles
- **External boundaries:** CFBData, Supabase, Twitter, and media providers remain injected in tests

### Relevant Best Practices

- Claim before any public side effect; a unique `(game_id, score_key)` conflict is a safe no-op.
- Keep uncertain claims visible with status/error metadata; do not turn post-success finalize failure into a retryable absence.
- Validate score values before Scorigami lookup, media creation, or X calls.
- Preserve provider tweet ID, URL, content type, template version, and attempt/error metadata.
- Do not use an approved sink or live credentials in the default test suite.

### Existing Patterns

- `src/index.js` owns the existing pregame/live/final branches and remains the orchestration boundary.
- `src/db.js` owns Supabase state access and is the atomic claim/finalize seam.
- `src/twitterClient.js` remains the provider adapter; tests replace `tweet`, `tweetWithMedia`, and upload calls.
- `src/tweetUtils.js` owns the 280-character trim contract.

---

## Recommended Approach

**Strategy:** TDD

**Rationale:** Public side effects and retry behavior are high-risk, the current suite has no orchestration
coverage, and all four ACs have deterministic local seams. Write failing state-machine/orchestration tests
first, then implement the smallest claim/finalize changes and migration.

### Test Priority

1. Claim conflict, claim-token ownership, and no-post behavior under repeated/concurrent identity attempts.
2. Real orchestration branches for pregame, live, final, exact payload/metadata, and incomplete-score guards.
3. Provider and finalize failures leave observable claims and never produce a second post.

---

## Implementation Tasks

| # | Task | File | Depends On | Status |
| --- | --- | --- | --- | --- |
| 1 | Add the claim-state migration with `status` (`claimed`/`posted`/`uncertain`) defaulting existing rows to `posted`, claim token/timestamp, attempts, error metadata, and the existing unique identity constraint. | `supabase/migrations/20260917190000_x_publication_claims.sql` | Deployed schema review; no production apply | [x] |
| 2 | Implement async `claimTweet({gameId,scoreKey})` with a CSPRNG `randomUUID()` token and atomic insert-on-conflict returning `{claimed,claimToken,status}`, `finalizeTweet` as token-owned conditional update returning zero rows on mismatch, and `recordTweetError` as token-owned uncertain-state update with attempts/error. | `src/db.js`, `src/db.test.js` | Task 1 | [x] |
| 3 | Refactor `src/index.js` to expose `run({ now, games, adapters })`, with concrete adapters `getGames: season->Promise<games[]>`, `getNextScheduledGame: (games,now)->Promise<game|null>`, `getGameVenue: game->Promise<venue|null>`, `isScorigami: (duke,opp,game)->Promise<result>`, `claimTweet: ({gameId,scoreKey})->{claimed,claimToken,status}`, `finalizeTweet: ({gameId,scoreKey,claimToken,metadata})->Promise<void>`, `recordTweetError: ({gameId,scoreKey,claimToken,error})->Promise<void>`, media creators/uploads returning buffers/IDs, and publishers returning tweet IDs; use the upstream controlled-clock/season contract, claim before post, finalize metadata after success, reject invalid scores before venue/Scorigami/database/media/publisher calls, and trim every outbound path. | `src/index.js`, `src/index.test.js`, `src/gameApi.js` | Tasks 2, US-01M2QX4Z clock contract | [x] |
| 4 | Add pregame/live/final/duplicate/provider-failure/finalize-failure/concurrent/same-score/incomplete-score/280-character tests with mocked boundaries and exact payload assertions. | `src/index.test.js`, `src/db.test.js`, `src/tweetUtils.test.js` | Task 3 | [x] |
| 5 | Apply and validate the additive migration contract in the disposable isolated test database, proving existing rows default to posted, uniqueness conflicts, claim fields, and token-owned updates; then run focused and full tests. | `supabase/migrations/20260917190000_x_publication_claims.sql`, `src/index.test.js`, `src/db.test.js` | Tasks 1-4 | [x] AC5 isolated evidence recorded |

### Parallel Execution Groups

| Group | Tasks | Prerequisite |
| --- | --- | --- |
| State contract | 1, 2 | Migration shape, unique conflict, defaults, and claim-token ownership must agree. |
| Orchestration | 3, 4 | Claim API and test doubles available. |
| Validation | 5 | All implementation/test tasks complete. |

---

## Blind Review

| Story requirement | Plan coverage |
| --- | --- |
| AC1 pregame identity | Tasks 3-4 consume the upstream controlled-clock/next-game seam at a fixed Chicago Wednesday/noon reference and assert one claim/post. |
| AC2 provider metadata | Tasks 2-4 assert non-Scorigami live/final, live Scorigami, text-only final Scorigami, and successful media final payloads plus provider metadata. |
| AC3 duplicate no-op | Tasks 2-4 assert claim conflict, concurrent workflow loss, and existing posted/claimed state cause zero second publisher calls. |
| AC4 incomplete score | Task 3 rejects null, non-finite, negative, and fractional scores before Scorigami/database/publisher calls. |
| AC5 claim contract | Tasks 1, 2, and 5 verify migration defaults, unique conflict, claim-token ownership, and isolated database behavior. |
| Seven edge cases | Tasks 2-4 cover repeated runs, partial score, post-success metadata failure, 280 limit, live-to-final keys, same score across games, and claim race. |
| Migration/state semantics | Tasks 1, 2, and 5 cover unique identity, existing-row defaults, CSPRNG/non-empty tokens, conditional claim-token finalization/error, RPC privileges, and required isolated migration evidence. |
| External side effects | No default test contacts X, Supabase production, CFBData, or image providers; manual sink evidence is explicitly deferred. |

---

## Implementation Phases

### Phase 1: Claim State and Migration

**Goal:** Establish an at-most-once persisted identity boundary.

- [x] Add additive claim status/token/timestamp fields and constraints to the tweet ledger.
- [x] Add `claimTweet`, `finalizeTweet`, and `recordTweetError` with unique-conflict no-op and token-owned update semantics.
- [x] Preserve existing posted rows as already finalized state.
- [x] Reject finalize attempts with a mismatched claim token and test existing-row defaults.

**Files:** `supabase/migrations/20260917190000_x_publication_claims.sql`, `src/db.js`, `src/db.test.js`

### Phase 2: Orchestration and TDD Coverage

**Goal:** Route every public-post branch through the claim/finalize seam.

- [x] Inject database, game, Scorigami, media, and publisher boundaries for deterministic `run()` tests; `getNextScheduledGame` receives the same `now` used by the workflow.
- [x] Claim before pregame/live/final posts and finalize all provider metadata on success.
- [x] Keep a claimed/uncertain identity after provider or metadata failure; record status, attempts, and last error without blindly retrying it.
- [x] Reject invalid/incomplete scores before venue, Scorigami, database, media, or publisher calls.
- [x] Assert live and final publication keys remain distinct and same-score games remain distinct by game ID.
- [x] Assert exact outgoing score/opponent text and <=280 payloads on every publication branch.
- [x] Run two concurrent workflow attempts and assert one claim winner and one publisher call.

**Files:** `src/index.js`, `src/index.test.js`, `src/tweetUtils.test.js`

### Phase 3: Verification

| AC | Verification Method | File Evidence | Status |
| --- | --- | --- | --- |
| AC1 | `npm test -- --runInBand -t "pregame identity"` | `src/index.test.js` | Pass |
| AC2 | `npm test -- --runInBand -t "tweet metadata"` | `src/index.test.js` | Pass |
| AC3 | `npm test -- --runInBand -t "duplicate identity"` | `src/index.test.js`, `src/db.test.js` | Pass |
| AC4 | `npm test -- --runInBand -t "incomplete score"` | `src/index.test.js` | Pass |
| AC5 | Manual isolated `supabase-test` migration replay plus claim/finalize/error RPC assertions | `src/db.test.js`, `supabase/migrations/20260917190000_x_publication_claims.sql` | Pass: isolated schema/RPC evidence |

- [x] Run every selector and confirm it selects named tests.
- [x] Run full Jest and inspect existing newsletter/ingestion regressions.
- [x] Record approved-sink manual smoke as not run, with no external side effect claimed.

---

## Edge Case Handling

| # | Edge Case | Handling Strategy | Phase |
| --- | --- | --- | --- |
| 1 | Job runs twice in one window | First claim succeeds; subsequent claim conflicts and publisher is not called. | Phase 1/2 |
| 2 | Partial score | Validate finite non-negative integer scores before any publication call. | Phase 2 |
| 3 | Provider succeeds but metadata write fails | Leave claim uncertain and record error; retry sees the claim and does not post again. | Phase 1/2 |
| 4 | Message exceeds 280 characters | Trim before publisher call and test 280/281 boundaries. | Phase 2 |
| 5 | Live transitions to final | Use distinct live/final score keys; both can claim once. | Phase 2 |
| 6 | Same score pair across games | Include `game_id` in the unique claim identity. | Phase 1/2 |
| 7 | Concurrent claim race | Unique insert conflict makes the losing worker a safe no-op; no live race test is run without an isolated database. | Phase 1/3 |

**Coverage:** 7/7 edge cases handled in the plan

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Claim remains uncertain after network failure | High | Keep status/error visible and require operator reconciliation; never auto-repost. |
| Existing ledger rows lack new claim fields | High | Additive migration defaults existing rows to posted/finalized state. |
| Tests mock the thing under test | High | Mock only adapters; execute real `run()` orchestration and db state functions. |
| No approved X sink | Medium | Keep manual smoke explicitly deferred; local publisher call counts are the default evidence. |
| Migration ledger mismatch from foundation work | High | Do not apply remotely from this story; verify target ledger before deployment and keep BG-01M2R2M9 open. |

---

## Definition of Done

- [x] Claim/finalize migration and db tests pass.
- [x] Migration unique identity/default-state contract is verified in the disposable isolated database.
- [x] All five ACs have executable selectors and pass; AC5 has recorded manual isolated evidence.
- [x] All seven edge cases have tests or explicit deterministic handling.
- [x] Full Jest passes without external calls.
- [x] No X message is sent by the default suite.
- [x] Independent review and reviewer-of-record sign-off are recorded.

---

## Resolved Questions

- Delivery is at-most-once at the public side-effect boundary, not exact-once; uncertain claims require operator reconciliation.
- An external X sink is not approved; local injected publisher evidence is sufficient for automated gates.
- The schedule/reference-date story owns fake-date season and clock semantics; this story consumes its controlled workflow inputs.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-17 | OpenCode; agent; v1 | Added atomic claim/finalize design, local orchestration test phases, and 7/7 edge-case handling. |
| 2026-09-17 | OpenCode; agent; v1 | Added claim migration/RPCs, injected orchestration tests, controlled clock/season inputs, and full local verification; isolated claim migration evidence recorded. |
| 2026-09-17 | OpenCode; agent; v1 | Final full-suite verification passes at 31 suites/125 tests after media evidence additions. |
| 2026-09-17 | Independent code review | Approved the implementation with no High/Medium findings; 30 suites/120 tests pass. |
