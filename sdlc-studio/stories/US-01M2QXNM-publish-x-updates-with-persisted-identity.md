# US-01M2QXNM: Publish X updates with persisted identity

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/index.js, src/db.js, src/twitterClient.js, src/tweetUtils.js, src/index.test.js, src/db.test.js, src/tweetUtils.test.js, supabase/migrations/20260917190000_x_publication_claims.sql
> **Epic:** EP-01M2QXQF
> **Points:** 5
> **Persona:** Avery Brooks

## User Story

**As a** Avery Brooks
**I want** the X workflow to publish pregame, live, and final updates keyed by persisted identity so that retries never produce duplicate public posts
**So that** the account stays timely and trustworthy without repeating itself.

## Context

### Persona Reference

**Avery Brooks** - Duke football follower, the served reader and social audience; veto line: a publication must not state an incorrect score, opponent, date, or record as fact.
[Full persona details](../personas/stakeholders/avery-brooks.md)

### Background

`src/index.js` is the X workflow entrypoint driven by `.github/workflows/scorigami-schedule.yml` every 15
minutes. It already publishes pregame reminders, live updates, and final posts, storing tweet metadata
keyed by game/score. PRD FR-004 requires persisted identity keys so scheduled retries do not repeat
completed work, and the epic requires an at-most-once claim before an external post. This story pins the
claim/finalize state machine, one-pregame-reminder, metadata-persistence, and duplicate no-op contracts
with local tests; live sink smoke remains separately authorized.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Performance | Scheduled jobs run every 15 minutes with a ten-minute timeout. | The workflow must stay bounded; identity checks and posts finish well inside the window. |
| PRD | Security | X and Supabase credentials remain server-only. | Tests use sinks/doubles; no live credential in the default suite. |
| TRD | Tech Stack | Use current `src/index.js`, Twitter client, game utilities, and Supabase tables. | No new publisher abstraction; changes stay on the existing path. |

---

## Acceptance Criteria

### AC1: At most one pregame reminder

- **Given** a Wednesday reference time at noon Chicago time and a next scheduled Duke game,
- **When** the X job runs,
- **Then** it sends at most one pregame reminder for that game.
- **Verify:** shell npm test -- --runInBand -t "pregame identity"
- **Caller:** `.github/workflows/scorigami-schedule.yml` -> `node src/index.js` (pregame branch)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC2: Correct update with provider metadata

- **Given** a live or completed game with a complete score and no matching persisted publication key,
- **When** the workflow runs,
- **Then** it publishes the correct update and stores the provider metadata.
- **Verify:** shell npm test -- --runInBand -t "tweet metadata"
- **Caller:** `.github/workflows/scorigami-schedule.yml` -> `node src/index.js` (live/final branch -> db.js insert)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC3: Duplicate identity safe no-op

- **Given** the same game and publication key already exists in tweet state,
- **When** the workflow runs again,
- **Then** it performs no second public post and exits through the safe no-op path.
- **Verify:** shell npm test -- --runInBand -t "duplicate identity"
- **Caller:** `.github/workflows/scorigami-schedule.yml` -> `node src/index.js` (existing-key check)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC4: Incomplete score guard

- **Given** a live or completed game has a null, non-finite, negative, or fractional score,
- **When** the workflow evaluates the game,
- **Then** it makes no public post and does not claim a persisted publication.
- **Verify:** shell npm test -- --runInBand -t "incomplete score"
- **Caller:** `node src/index.js` workflow boundary before the X client
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC5: Claim persistence contract

- **Given** the claim migration is applied to a disposable isolated database containing legacy posted rows,
- **When** the claim state contract is exercised,
- **Then** legacy rows default to `posted`, `(game_id, score_key)` is unique/non-null, and only the claim-token owner can finalize or record an uncertain claim.
- **Verify:** manual apply `20260917190000_x_publication_claims.sql` to the disposable `supabase-test` database and assert legacy defaults, unique conflict, revoked public/granted service-role RPC privileges, blank-token rejection, mismatched-token zero-row transitions, and correct-token finalize/error transitions
- **Caller:** `supabase/migrations/20260917190000_x_publication_claims.sql` before `node src/index.js`
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

> **AC5 evidence (2026-09-17):** The claim migration was applied to the disposable `supabase-test`
> database. Existing rows defaulted to `posted`; `tweeted_scores_game_score_key` was unique and
> `score_key` non-null; blank tokens were rejected; public/anonymous/authenticated RPC execution was
> revoked while `service_role` execution remained; a competing claim returned `claimed=false`; wrong
> token finalization returned false; the correct token finalized provider metadata successfully.

---

## Scope

### In Scope

- Pregame Wednesday-window selection and the one-reminder-per-game guarantee.
- Live/final publication keyed by game and score; insertion of completed games into tweet state.
- Persistence of provider tweet id, URL, content type, and template version on success.
- Atomic claim/finalize state transitions, duplicate-key no-op path, and optional approved-sink verification for AC3.
- `tweetUtils.trimTweet` 280-character enforcement on every outgoing message.

### Out of Scope

- Media fallback ordering for final Scorigami posts (US-01M2QX2Y).
- Backfill window and FAKE_DATE input semantics (US-01M2QX4Z).
- Exact-once external delivery; uncertain claims remain an operator-reconciliation state.
- X account strategy, hashtags, or new copy campaigns.

---

## Technical Notes

The workflow claims the persisted publication key before the external post through an atomic insert and
finalizes provider metadata after success. A successful claim is never silently retried: a post-success
metadata failure leaves an observable claimed state for reconciliation. Keep the claim/post/finalize
sequence behind existing function seams so `index.test.js` and `db.test.js` can inject doubles. The
default suite proves duplicate no-op behavior locally; an approved sink is optional manual evidence only.

### API Contracts

No inbound API. Internal contracts: `run({ now, games, adapters })` in `src/index.js` (pregame/live/final
branches), `src/db.js` claim/finalize state, `src/twitterClient.js` post/media adapters, and
`src/tweetUtils.js` `trimTweet(text, 280)`. The upstream schedule story supplies one controlled reference
clock/season and next-game selection seam. Outbound: CFBData schedule/venue calls and the X API; both stay
behind adapters so tests never dial out.

### Data Requirements

- Tweet-state table (`tweeted_scores` or equivalent) with a unique publication key in the Supabase schema.
- Claim status/token fields and a unique `(game_id, score_key)` constraint for atomic pre-post identity claims.
- Provider tweet id/URL/content type/template version columns for the metadata write.
- Fixture schedules with a next-game-on-Wednesday and completed games with complete scores.
- No real X credentials in fixtures; approved sink only for the manual AC3 run.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Job runs twice in the same window | Second run finds the persisted key and no-ops; at most one public post. |
| Game score partially reported (null/incomplete) | No publication; incomplete data never reaches a post. |
| Provider post succeeds but metadata write fails | Claim remains visible as uncertain; retry does not double-post and operator reconciliation can finalize metadata. |
| Message exceeds 280 characters | `trimTweet` trims before send; every outgoing text is at most 280 characters. |
| Live game transitions to final between runs | Distinct live and final keys allow both posts; neither repeats. |
| Two Duke games in the backfill window share a score pair | Key includes opponent/date context so distinct games are not conflated. |
| Race between concurrent scheduled runs | Documented select-before-insert gap; uniqueness constraint (where present) rejects the duplicate. |

---

## Test Scenarios

- [ ] Wednesday noon Chicago time fixture: assert exactly one pregame reminder per game across repeated runs (jest "pregame").
- [ ] Live/completed game with complete score: assert correct update text and stored provider metadata (jest "tweet").
- [ ] Repeated run with existing key: assert no second post and safe exit (jest "duplicate identity").
- [ ] Incomplete-score guard: assert no publication for null/partial scores (jest "incomplete score").
- [ ] `trimTweet` boundary tests at exactly 280 and 281 characters.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QX2Y](US-01M2QX2Y-recover-final-scorigami-media-failures.md) | Sibling | Final-post media path shares this workflow; fallback ordering composes after identity is settled. | Ready |
| [US-01M2QX4Z](US-01M2QX4Z-control-x-schedule-time-and-backfill-inputs.md) | Upstream | Reference-date and controlled-clock inputs determine which games this workflow evaluates. | Ready |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| X test sink and fixture schedule | Test infrastructure | Needed - owner Casey Nguyen (see epic). |
| Supabase tweet-state table with unique key | Data | Available in current schema; uniqueness to be confirmed against deployed DB. |

---

## Estimation

**Points:** 5
**Complexity:** Medium

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/index.js`, `src/db.js`, `src/twitterClient.js`, `src/tweetUtils.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| Duplicate posts already published | Delete the duplicate post via X client manually; record the corrective action in the run log | < 1 hour |
| Workflow change | `.github/workflows/scorigami-schedule.yml` revert via `git revert`; next 15-minute run picks it up | < 15 min |

---

## Resolved Questions

- Atomic claim is in scope and uses at-most-once semantics: claim before posting, finalize after provider
  success, and leave uncertain claims observable rather than retrying blindly.
- No X sink is approved; automated local doubles are the acceptance evidence. Manual sink smoke remains an
  explicitly authorized follow-up and is not required for the default test gate.
- Controlled date/season semantics are owned by US-01M2QX4Z; this story consumes the resolved reference
  time rather than deriving a second wall clock. Pregame uses the same `America/Chicago` weekday/hour
  convention as the schedule contract.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | Three Amigos refinement | Added atomic claim/finalize semantics, local duplicate evidence, incomplete-score AC, and explicit external-sink boundary. |
