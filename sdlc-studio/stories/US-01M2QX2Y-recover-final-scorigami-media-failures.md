# US-01M2QX2Y: Recover final Scorigami media failures

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/index.js, src/scorigamiCard.js, src/wallaceWadeCard.js, src/openaiImageEditor.js, src/index.test.js, src/scorigamiCard.test.js, src/wallaceWadeCard.test.js
> **Epic:** EP-01M2QXQF
> **Points:** 5
> **Persona:** Avery Brooks

## User Story

**As a** Avery Brooks
**I want** a final Scorigami post to degrade through the Wallace Wade image, deterministic card, and text-only paths without losing the publication
**So that** an image-provider outage never erases a verified final score post.

## Context

### Persona Reference

**Avery Brooks** - Duke football follower, the served reader and social audience; veto line: a missing optional source must produce an honest omission or fallback, not fabricated detail.
[Full persona details](../personas/stakeholders/avery-brooks.md)

### Background

The final Scorigami branch of `src/index.js` prefers `createWallaceWadeCard` (Wallace Wade image path),
falls back to `createScorigamiCard` (deterministic generated card), and can post text-only. PRD business
rule: "A final Scorigami publication prefers the Wallace Wade image path, then the deterministic card,
then text-only output." The epic risk: an image fallback that throws after a successful upload attempt
must not swallow the post. This story pins the three-tier ordering and the trimmed text-only floor with
failure-injection coverage.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Security | Provider failures must fail the job or use an explicit media fallback, never fabricate score data. | AC2/AC3 assert fallback selection without inventing scores. |
| PRD | Business rule | Final Scorigami prefers Wallace Wade image, then deterministic card, then text-only (HIGH). | All three ACs encode one tier of the ordering. |
| TRD | Tech Stack | Use current `src/index.js`, card modules, and image editor. | No new media pipeline; only the fallback chain is exercised. |

---

## Acceptance Criteria

### AC1: Preferred image path success

- **Given** a final score pair is a new Scorigami,
- **When** the preferred Wallace Wade image path succeeds,
- **Then** the X post uses the generated media and records the Scorigami card content type.
- **Verify:** shell npm test -- --runInBand -t "preferred media"
- **Caller:** `.github/workflows/scorigami-schedule.yml` -> `node src/index.js` (final Scorigami branch -> createWallaceWadeCard)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC2: Deterministic card fallback

- **Given** preferred Wallace Wade card generation or media upload fails,
- **When** the final Scorigami path continues,
- **Then** it attempts the deterministic card fallback before giving up on media.
- **Verify:** shell npm test -- --runInBand -t "deterministic media fallback"
- **Caller:** `.github/workflows/scorigami-schedule.yml` -> `node src/index.js` (final Scorigami branch -> createScorigamiCard)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

### AC3: Text-only publication floor

- **Given** both media paths fail,
- **When** the final Scorigami path continues,
- **Then** it publishes a trimmed text-only message containing the verified score and opponent rather than failing silently.
- **Verify:** shell npm test -- --runInBand -t "text-only media floor"
- **Caller:** `.github/workflows/scorigami-schedule.yml` -> `node src/index.js` (final Scorigami branch -> text-only path via tweetUtils.trimTweet)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-17)

---

## Scope

### In Scope

- The three-tier fallback chain: Wallace Wade image -> deterministic Scorigami card -> trimmed text-only.
- Content-type recording on successful media posts (Scorigami card content type).
- Failure-injection seams for the image editor and upload path.
- Text-only message containing the verified score and opponent, trimmed to 280 characters.
- `scorigamiCard.test.js` coverage for the deterministic card output.

### Out of Scope

- New card designs or image generation capabilities.
- Changing the X provider client.
- Replacing the Wallace Wade image pipeline.
- Duplicate-identity handling (US-01M2QXNM) and backfill/fake-date inputs (US-01M2QX4Z).

---

## Technical Notes

`src/index.js` imports both `createWallaceWadeCard` (`src/wallaceWadeCard.js`) and `createScorigamiCard`
(`src/scorigamiCard.js`); `src/openaiImageEditor.js` is the OpenAI image-edit dependency for the Wallace
Wade path. Each tier must be an isolated try/catch step so a failure in one tier falls to the next
without losing the verified score data. AC2/AC3 use injected card/upload/post doubles in the default
suite; an approved sink is optional manual supplementary evidence and is never contacted automatically.
OpenAI edit failure inside `createWallaceWadeCard` is treated as a recoverable reference-photo path;
deterministic-card fallback is reserved for card-generation or upload failure. The text-only floor uses
`trimTweet` so even the degraded message respects the 280-character limit.

### API Contracts

No inbound API. Internal contracts: `createWallaceWadeCard(...) -> media`, `createScorigamiCard(...) ->
media/buffer`, image-editor calls from `src/openaiImageEditor.js`, and `tweetUtils.trimTweet(text,
280)`, all consumed by the final Scorigami branch of `src/index.js`. Outbound: OpenAI image edit and X
media upload; both behind seams injectable in tests.

### Data Requirements

- A verified final score pair with a known-new Scorigami classification and opponent name.
- Fixture image assets or doubles for the Wallace Wade path success case.
- Approved sink for the manual failure-injection runs (AC2/AC3); no live public post without approval.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Wallace Wade image generation succeeds but upload fails | Control passes to the deterministic card fallback. |
| Deterministic card generation throws | Control passes to the text-only path; verified score text still publishes. |
| OpenAI image editor returns a malformed response | Preferred Wallace helper keeps the reference photo and continues; deterministic fallback is reserved for card-generation/upload failure. |
| Both media paths fail | Trimmed text-only post publishes; no silent failure and no fabricated score. |
| All three tiers fail | Job exits non-zero with an observable error naming the failed publication. |
| Text-only message exceeds 280 characters | `trimTweet` trims before send; score and opponent remain in the kept text. |
| Score pair is not a new Scorigami | The media chain is not entered; normal final-post path runs. |
| Media succeeds but content-type write fails | Failure is observable; retry must respect the persisted publication key (US-01M2QXNM). |

---

## Test Scenarios

- [ ] Wallace Wade path success: assert media used and Scorigami card content type recorded (jest "PNG").
- [ ] Inject preferred media generation/upload failure: assert the deterministic card path is attempted (jest "deterministic media fallback").
- [ ] Inject both media failures: assert a trimmed text-only post with verified score and opponent (jest "text-only media floor").
- [ ] Assert the deterministic card renders for a representative score pair without provider calls.
- [ ] Assert text-only output stays within 280 characters for long opponent names.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QXNM](US-01M2QXNM-publish-x-updates-with-persisted-identity.md) | Sibling | The final-post workflow and publication key this fallback chain hangs off. | Ready |
| [US-01M2QXQ7](US-01M2QXQ7-fallback-when-editorial-and-image-providers-fail.md) | Related | Shares the deterministic-card fallback contract with the newsletter image path. | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| X test sink for manual media-failure runs | Test infrastructure | Needed - owner Casey Nguyen (see epic). |
| OpenAI image editor availability | Provider | Optional; failure behavior is the subject of this story. |

---

## Estimation

**Points:** 5
**Complexity:** Medium

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/index.js`, `src/scorigamiCard.js`, `src/wallaceWadeCard.js`, `src/openaiImageEditor.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| A degraded text-only post already published | Corrective post or deletion via the X client, recorded in the run log | < 1 hour |

---

## Resolved Questions

- Media failures already surface through workflow logging and non-zero failure when all publication tiers
  fail; an additional alerting integration is deferred to operational deployment work owned by Taylor Morgan.
- A retry re-enters the media chain only when the persisted publication claim is not finalized; an uncertain
  claim is reconciled rather than blindly reposted, as defined by US-01M2QXNM.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | Three Amigos refinement | Added executable local fallback criteria, clarified preferred-card failure semantics, and separated optional sink smoke from the default gate. |
| 2026-09-17 | TDD implementation | Added preferred/fallback/text-only orchestration tests, mocked OpenAI/logo boundaries, and exact text-floor coverage; all ACs verify. |
