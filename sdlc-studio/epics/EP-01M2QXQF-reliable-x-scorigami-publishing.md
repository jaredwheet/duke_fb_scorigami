# EP-01M2QXQF: Reliable X Scorigami Publishing

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Size:** M

## Summary

Preserve accurate pregame, live, final, and recovery posts while preventing duplicate public side
effects and retaining deterministic media fallbacks.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| PRD | Performance | Scheduled jobs run every 15 minutes with a ten-minute timeout. | The workflow must be bounded and avoid unbounded retry work. |
| PRD | Security | X and Supabase credentials remain server-only. | Tests use sinks/doubles and never commit or log secrets. |
| TRD | Architecture | X publishing is a short-lived Node batch coordinated by Actions. | The workflow must remain restartable and observable from state. |
| TRD | Tech Stack | Use current `src/index.js`, Twitter client, game utilities, and Supabase tables. | Avoid a new publisher abstraction unless a story requires it. |

---

## Business Context

### Problem Statement

The account must publish timely score context without posting duplicate pregame/live/final messages
when Actions retries or a game is recovered from the backfill window. [HIGH] Final Scorigami posts also
need a deterministic media fallback so image-provider failures do not erase the publication.

**PRD Reference:** [X Score Publishing](../prd.md#x-score-publishing)

### Value Proposition

Fans receive accurate, timely public updates, and the operator can safely rerun a job after a failure
without guessing whether a side effect already happened.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Duplicate identity keys | Database uniqueness plus select/insert | Zero duplicate public posts | Concurrency/uniqueness test and audit |
| Final media fallback success | Implemented, live status unknown | Text post still succeeds when media fails | Failure-injection test |
| Backfill recovery | Default 30 days | Every eligible completed game evaluated once | Fake-date fixture suite |
| Message length | Trim helper exists | Every sent text is at most 280 characters | Utility and workflow assertion |

---

## Scope

### In Scope

- Pregame Wednesday window, live updates, final posts, and recent-game backfill.
- Score identity, existing-post checks, tweet metadata, and insertion of completed games.
- Wallace Wade card, deterministic Scorigami card, and text-only fallback ordering.
- Fake-date/backfill controls and safe provider-boundary tests.

### Out of Scope

- X account strategy, hashtags, or new copy campaigns.
- Replacing the X provider client.
- Newsletter behavior or canonical ingestion internals except where this workflow consumes them.
- Resolving every concurrency issue without a database-backed acceptance test.

### Affected Personas

- **Avery Brooks:** needs accurate, non-duplicated public score context.
- **Taylor Morgan:** needs safe retries and visible publication state.
- **Casey Nguyen:** needs tests for time windows, incomplete scores, fallback, and duplicate paths.

---

## Acceptance Criteria (Epic Level)

- [ ] Pregame, live, final, and backfill paths each use an atomic persisted claim/finalize identity state machine and safe no-op.
- [ ] A final Scorigami publication reaches text output when both image paths fail.
- [ ] Invalid/incomplete score data cannot produce a publication.
- [ ] The workflow honors `FAKE_DATE`, `BACKFILL_DAYS`, and the 280-character limit in tested paths.

---

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| Historical/canonical game data | Data | Foundation epic | Rowan Patel |
| X test sink and fixture schedule | Test infrastructure | Unit doubles available; manual external smoke requires explicit operator authorization | Casey Nguyen |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| Scheduled X workflow | Operational | It calls the entrypoint and depends on its idempotency. |
| Public fan updates | Product surface | Incorrect state is immediately visible. |

---

## Risks & Assumptions

### Assumptions

- `tweeted_scores` uniqueness is present in the deployed schema.
- Provider failures should fail the job or use an explicit media fallback, never fabricate score data.
- No public side effect is made by the default Jest suite.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Select-before-insert race posts twice | Medium | High | Claim the identity before the external post, finalize provider metadata after success, and expose claimed/failed recovery state. |
| Fake date chooses wrong schedule season | Medium | Medium | Add a year-boundary test and document expected behavior. |
| Partial score is treated as final | Low/Medium | High | Test null/incomplete score guards at workflow boundary. |
| Image fallback throws after a successful upload attempt | Low | Medium | Failure-injection tests for each fallback branch. |

---

## Technical Considerations

### Architecture Impact

Keep the existing orchestration in `src/index.js`, pure helpers in `src/gameUtils.js`/`tweetUtils.js`,
and provider/database adapters at the boundary. Use dependency seams or test doubles rather than live
X/Supabase calls in unit tests.

### Integration Points

CFBData schedule and venue calls, Supabase legacy game/tweet state, Twitter API/media upload, and Sharp/
Puppeteer/OpenAI image paths.

---

## Sizing

**Size:** M

**Estimated Story Count:** 3

**Derived Point Total:** 13

_The point total is derived by reconcile after stories are created._

**Complexity Factors:**

- Public external side effects and non-atomic duplicate checks.
- Time-zone and fake-date branches.
- Multiple image failure fallbacks.

---

## Story Breakdown

<!-- Story links are maintained by artifact.py. -->
---
- [x] [US-01M2QXNM: Publish X updates with persisted identity](../stories/US-01M2QXNM-publish-x-updates-with-persisted-identity.md)
- [x] [US-01M2QX2Y: Recover final Scorigami media failures](../stories/US-01M2QX2Y-recover-final-scorigami-media-failures.md)
- [x] [US-01M2QX4Z: Control X schedule time and backfill inputs](../stories/US-01M2QX4Z-control-x-schedule-time-and-backfill-inputs.md)

## Test Plan

Test specs will cover score identity and message formatting, workflow path selection, duplicate
prevention, and image/text fallback behavior without sending an external message.

---

## Resolved Questions

- An atomic claim is required before the next scheduled deployment. The delivery guarantee is at-most-once
  at the public side-effect boundary: a claim is persisted before posting, successful posts finalize
  metadata, and uncertain claims remain observable for operator reconciliation rather than being retried
  blindly. Exact-once external delivery is not claimed.
- `FAKE_DATE` controls the reference clock and schedule season. January/February dates belong to the prior
  fall football season; all controlled next-game and backfill calculations receive the same reference time.
- No X test account or sink is approved in this workspace. Default evidence uses injected publisher and
  database doubles; live/manual smoke is a separate authorized operation and is not silently claimed green.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | SDLC Studio onboarding | Decomposed PRD X publishing and Scorigami requirements into an operational epic. |
| 2026-09-17 | Three Amigos consultation | Chose at-most-once atomic claim/finalize semantics, reference-date season control, and local-only automated evidence pending explicit X sink authorization. |
