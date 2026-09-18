# TS-01M2RBPJ: Persisted X Publication Identity

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Epic:** [EP-01M2QXQF: Reliable X Scorigami Publishing](../epics/EP-01M2QXQF-reliable-x-scorigami-publishing.md)
> **Story:** [US-01M2QXNM: Publish X updates with persisted identity](../stories/US-01M2QXNM-publish-x-updates-with-persisted-identity.md)
> **Created:** 2026-09-17
> **Last Updated:** 2026-09-17

## Overview

This spec exercises the real X workflow orchestration with injected Supabase, clock, game, Scorigami,
media, and publisher seams. It proves the claim/finalize contract without external posts or credentials.

## Scope

### Stories Covered

| Story | Title | Priority |
| --- | --- | --- |
| [US-01M2QXNM](../stories/US-01M2QXNM-publish-x-updates-with-persisted-identity.md) | Publish X updates with persisted identity | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
| --- | --- | --- | --- | --- |
| US-01M2QXNM | AC1 | Pregame identity is claimed and posted once. | TC001, TC002 | Automated; focused selector passes |
| US-01M2QXNM | AC2 | Live/final posts finalize exact provider metadata and payload text. | TC003, TC004, TC005, TC011, TC015, TC016, TC017, TC018 | Automated; focused selector passes |
| US-01M2QXNM | AC3 | Existing/claimed identity is a no-op, including concurrent orchestration loss. | TC006, TC007, TC013, TC014 | Automated; focused selector passes |
| US-01M2QXNM | AC4 | Incomplete scores cannot publish. | TC008 | Automated; focused selector passes |
| US-01M2QXNM | AC5 | Claim migration/state contract enforces atomic identity and token-owned updates. | TC010, TC012 | Manual isolated verification complete |

**Coverage:** 5/5 ACs mapped to test cases; automated orchestration tests pass and AC5 isolated migration evidence is recorded.

### Test Types Required

| Type | Required | Rationale |
| --- | --- | --- |
| Unit | Yes | Claim state, score guards, trim boundaries, and metadata are deterministic. |
| Integration | Yes | The injected database state machine and real `run()` orchestration must agree at the side-effect seam. |
| E2E | No | No external X account is authorized for the default suite. |

### Strategy Heuristics

- [x] **Production-state-shape integration test** - the stateful tweet ledger includes claimed, posted, and uncertain rows with provider metadata.
- [x] **Rejects-old-shape contract test** - the migration preserves existing posted rows while adding claim fields; no public wire shape changes.
- [x] **Regression test per fixed bug** - tests pin the current select/post/insert race and post-success metadata failure behavior at the orchestration seam.

---

## Environment

| Requirement | Details |
| --- | --- |
| Prerequisites | Node.js 22, Jest 30, ESM module mocks, stateful Supabase double, deterministic clock. |
| External Services | None in default tests; no X, CFBData, OpenAI, or production Supabase calls. |
| Test Data | Wednesday/noon next game, complete live/final games, partial-score games, same-score different games, and long messages. |

## Test Cases

### TC001: Pregame identity claims once

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QXNM AC1

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A deterministic Wednesday/noon Chicago reference and one next scheduled game. | The claim ledger is empty and publisher is injected. |
| When | `run()` executes twice with the same fixture. | The first run claims/posts/finalizes `pregame`; the second claims nothing. |
| Then | Inspect publisher calls and ledger state. | Exactly one publisher call and one posted identity exist. |

**Automation:** `src/index.test.js` title includes `pregame identity`.

---

### TC002: Pregame window no-op outside boundary

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXNM AC1 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Thursday/noon, Wednesday 11:59, Wednesday 13:00, and no-next-game fixtures. | No eligible pregame branch is active. |
| When | `run()` executes. | No publisher or claim call occurs. |
| Then | Inspect calls. | The workflow exits safely without a public side effect. |

**Automation:** `src/index.test.js`.

---

### TC003: Live update finalizes provider metadata

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QXNM AC2

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A live complete-score Duke 24-10 Virginia game with no publication identity. | Claim succeeds and publisher returns `tweet-live-1`. |
| When | `run()` evaluates the live branch. | The publisher receives exactly `Live score update:\nDuke 24-10 vs Virginia\nNot a new score pair yet.\n#DukeFootball #DUKEFBSCORIGAMI`; finalization writes ID `tweet-live-1`, URL `https://x.com/i/web/status/tweet-live-1`, content type `live`, and template version `v2`. |
| Then | Inspect ledger. | The live score key is posted with exactly those provider metadata values. |

**Automation:** `src/index.test.js` title includes `tweet metadata`.

---

### TC004: Final update uses a distinct identity

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXNM AC2 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A completed Duke 24-10 Virginia game with a prior live identity and a new Scorigami result. | The final key is `24-10-final`, distinct from `24-10`, and publisher returns `tweet-final-1`. |
| When | `run()` processes the branch with media disabled/failing. | The publisher receives exactly `🚨 DUKE SCORIGAMI 🚨\nDuke 24-10 vs Virginia\nThis final score pair had never occurred in Duke football history.\n\nWhat score will Duke produce next?\nSeason details: https://www.winsipedia.com/duke/schedule/2026\n#DukeFootball #DUKEFBSCORIGAMI`; finalization writes ID `tweet-final-1`, URL `https://x.com/i/web/status/tweet-final-1`, content type `final_scorigami`, and template version `v2`. |
| Then | Inspect keys and metadata. | Live and final identities are distinct and finalized metadata matches the correct branch. |

**Automation:** `src/index.test.js` title includes `tweet metadata`.

---

### TC016: Live Scorigami payload variant

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QXNM AC2 branch

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | The fixture sets `isScorigami: true` and `HASHTAGS` to `#DukeFootball #DUKEFBSCORIGAMI`. | The live score is Duke 24-10 vs Virginia. |
| When | The live branch publishes. | It sends exactly `👀 Live score watch:\nDuke 24-10 vs Virginia\nIf it holds, this would be a new score pair.\n\nWhat do you think?\n#DukeFootball #DUKEFBSCORIGAMI` and finalizes content type `live`. |
| Then | Inspect provider calls and ledger. | Provider metadata is complete and the live key is distinct from final. |

**Automation:** `src/index.test.js` title includes `tweet metadata`.

---

### TC017: Successful Wallace Wade media final

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QXNM AC2 branch

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | The fixture sets `isScorigami: true`, deterministic 2026 season text, and a successful media upload. | The media publisher returns `tweet-final-1`. |
| When | The final Scorigami branch publishes. | It calls the media publisher and finalizes content type `final_scorigami_card`, ID, URL, and template version. |
| Then | Inspect text/media calls. | The exact score/opponent message is retained and no text-only publisher call occurs. |

**Automation:** `src/index.test.js` title includes `tweet metadata`.

---

### TC018: Ordinary completed-game metadata

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QXNM AC2 branch

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | The fixture sets `isScorigami: false`, one prior occurrence on 2025-09-05, prior teams Duke/Virginia, prior score 24-10, prior city/state Durham/NC, no media path, and the production date formatter timezone `America/New_York`. | The final branch builds the controlled 2026 ordinary-final text. |
| When | The final publisher runs. | It sends exactly `Duke 24-10 vs Virginia\nNot a new score pair. This score pair has occurred 1 time in Duke football history.\nPrevious: Duke 24-10 vs Virginia on 9/5/2025 at Durham, NC\nSeason details: https://www.winsipedia.com/duke/schedule/2026\n#DukeFootball #DUKEFBSCORIGAMI` and finalizes content type `final`, ID `tweet-final-ordinary-1`, URL `https://x.com/i/web/status/tweet-final-ordinary-1`, and template version `v2`. |
| Then | Inspect state. | The final identity is posted once with complete metadata. |

**Automation:** `src/index.test.js` title includes `tweet metadata`.

---

### TC005: Metadata failure leaves an uncertain claim

**Type:** Unit/integration seam | **Priority:** High | **Story:** US-01M2QXNM AC2 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | The publisher returns success but finalization fails. | The claim remains observable with an error/uncertain state. |
| When | The same identity is evaluated again. | It does not publish a second time. |
| Then | Inspect calls/state. | Public at-most-once behavior is preserved and reconciliation data exists. |

**Automation:** `src/index.test.js`, `src/db.test.js`.

---

### TC006: Existing posted identity is a no-op

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXNM AC3

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | The ledger already contains a posted identity. | Claim insert returns a unique-conflict/no-op result. |
| When | The workflow runs. | No publisher or media call occurs. |
| Then | Inspect calls. | The state remains unchanged. |

**Automation:** `src/index.test.js` title includes `duplicate identity`.

---

### TC007: Concurrent claims have one winner

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXNM AC3 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Two claim attempts target the same `(game_id, score_key)`. | The state double enforces the unique identity. |
| When | Both claims run. | Exactly one returns claimed; the other returns no-op. |
| Then | Inspect state. | One identity row exists and no provider call is implied by the losing claim. |

**Automation:** `src/db.test.js`.

---

### TC008: Incomplete score never publishes

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QXNM AC4

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Null, NaN, negative, and fractional score fixtures. | The score guard rejects each fixture. |
| When | `run()` evaluates the games. | No Scorigami lookup, claim, media, or publisher call occurs. |
| Then | Inspect calls. | No publication identity is persisted. |

**Automation:** `src/index.test.js` title includes `incomplete score`.

---

### TC009: Message length boundary

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXNM edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | 280-character and 281-character outgoing messages. | The first remains unchanged and the second is trimmed. |
| When | The publisher boundary is reached. | Every text is at most 280 characters. |
| Then | Inspect publisher payload. | The trimmed message retains its verified core text. |

**Automation:** `src/tweetUtils.test.js`.

---

### TC010: Claim migration preserves ledger contract

**Type:** Integration/manual | **Priority:** High | **Story:** US-01M2QXNM state contract

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | An isolated disposable Postgres/Supabase target with existing posted ledger rows. | The migration applies without losing existing rows. |
| When | Inspect the migrated table, unique indexes, RPC signatures/privileges, and status/token checks. | Existing rows default to finalized state; claim fields and `(game_id, score_key)` uniqueness exist; public execution is revoked and server-role execution is granted. |
| Then | Attempt two same-identity claims, a blank-token claim, and mismatched/correct-token finalize/error calls. | Exactly one valid claim succeeds, blank tokens fail, mismatched tokens affect zero rows, and only the owner can finalize/record uncertainty. |

**Automation:** Manual isolated `supabase-test` replay; no production database.

---

### TC011: Provider failure after claim remains uncertain

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QXNM provider-failure edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A claim succeeds and the publisher rejects or times out without a definitive result. | The claim remains observable with an error and no automatic release. |
| When | The same identity is retried. | It does not make a second publisher call. |
| Then | Inspect ledger. | Operator reconciliation can distinguish the uncertain claim from a clean absence. |

**Automation:** `src/index.test.js`, `src/db.test.js`.

---

### TC012: Finalize requires the claim token

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXNM claim-state edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | A claim exists with token A. | A finalize attempt supplies token B. |
| When | Finalization runs. | The update affects no row and returns a conflict/error. |
| Then | Finalize with token A. | Only the owner can mark the claim posted and write provider metadata. |

**Automation:** `src/db.test.js`.

---

### TC013: Same score pair across games remains distinct

**Type:** Unit/orchestration | **Priority:** Medium | **Story:** US-01M2QXNM edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Two different game IDs produce the same score pair. | Their publication keys share the score but differ by game ID. |
| When | Both games run through the workflow. | Both can claim and publish once. |
| Then | Inspect state and calls. | Two identities and two publisher calls exist; neither is conflated. |

**Automation:** `src/index.test.js`.

---

### TC014: Concurrent orchestration has one publisher winner

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QXNM concurrency edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Two `run()` attempts share a stateful claim double and one identity. | The claim double permits one winner. |
| When | Both attempts execute concurrently. | Exactly one publisher call occurs. |
| Then | Inspect state. | One claim is finalized/uncertain and the loser is a no-op. |

**Automation:** `src/index.test.js`.

---

### TC015: Every outbound branch trims text

**Type:** Unit/orchestration | **Priority:** Medium | **Story:** US-01M2QXNM message-length edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Pregame, live, and final fixtures whose rendered text exceeds 280 characters. | The injected publisher records each payload. |
| When | Each branch publishes. | Every payload length is at most 280 characters. |
| Then | Inspect text. | Verified score/opponent content remains present. |

**Automation:** `src/index.test.js`, `src/tweetUtils.test.js`.

---

## Fixtures

```yaml
reference_time: 2026-09-16T17:00:00Z
next_game: {id: 101, startDate: 2026-09-19T19:00:00Z, homeTeam: Duke, awayTeam: Virginia}
complete_game: {id: 202, completed: true, homeTeam: Duke, awayTeam: Virginia, homePoints: 24, awayPoints: 10}
incomplete_game: {id: 203, completed: true, homeTeam: Duke, awayTeam: Virginia, homePoints: null, awayPoints: 10}
publication_keys: [pregame, "24-10", "24-10-final"]
claim_states: [claimed, posted, uncertain]
```

---

## Automation Status

| TC | Title | Status | Implementation |
| --- | --- | --- | --- |
| TC001 | Pregame identity claims once | Automated | `src/index.test.js` |
| TC002 | Pregame window no-op outside boundary | Automated | `src/index.test.js` |
| TC003 | Live update finalizes provider metadata | Automated | `src/index.test.js` |
| TC004 | Final update uses a distinct identity | Automated | `src/index.test.js` |
| TC005 | Metadata failure leaves an uncertain claim | Automated | `src/index.test.js`, `src/db.test.js` |
| TC006 | Existing posted identity is a no-op | Automated | `src/index.test.js` |
| TC007 | Concurrent claims have one winner | Automated | `src/db.test.js` |
| TC008 | Incomplete score never publishes | Automated | `src/index.test.js` |
| TC009 | Message length boundary | Automated | `src/tweetUtils.test.js` |
| TC010 | Claim migration preserves ledger contract | Manual isolated | Disposable `supabase-test` target |
| TC011 | Provider failure after claim remains uncertain | Automated | `src/index.test.js`, `src/db.test.js` |
| TC012 | Finalize requires the claim token | Automated | `src/db.test.js` |
| TC013 | Same score pair across games remains distinct | Automated | `src/index.test.js` |
| TC014 | Concurrent orchestration has one publisher winner | Automated | `src/index.test.js` |
| TC015 | Every outbound branch trims text | Automated | `src/index.test.js`, `src/tweetUtils.test.js` |
| TC016 | Live Scorigami payload variant | Automated | `src/index.test.js` |
| TC017 | Successful Wallace Wade media final | Automated | `src/index.test.js` |
| TC018 | Ordinary completed-game metadata | Automated | `src/index.test.js` |

---

## Traceability

| Artefact | Reference |
| --- | --- |
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP-01M2QXQF](../epics/EP-01M2QXQF-reliable-x-scorigami-publishing.md) |
| Story | [US-01M2QXNM](../stories/US-01M2QXNM-publish-x-updates-with-persisted-identity.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-17 | OpenCode; agent; v1 | Added 9 executable cases for claim state, orchestration, metadata, duplicate, guard, and length contracts. |
| 2026-09-17 | OpenCode; agent; v1 | Automated claim/orchestration cases and recorded isolated migration state evidence. |
