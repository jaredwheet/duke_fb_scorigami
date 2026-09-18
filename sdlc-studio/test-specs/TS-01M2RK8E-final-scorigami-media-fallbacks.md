# TS-01M2RK8E: Final Scorigami Media Fallbacks

> **Status:** Complete
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Epic:** [EP-01M2QXQF: Reliable X Scorigami Publishing](../epics/EP-01M2QXQF-reliable-x-scorigami-publishing.md)
> **Story:** [US-01M2QX2Y: Recover final Scorigami media failures](../stories/US-01M2QX2Y-recover-final-scorigami-media-failures.md)
> **Created:** 2026-09-17
> **Last Updated:** 2026-09-17

## Overview

This spec exercises the final Scorigami branch through injected media and publisher boundaries. The
default suite proves preferred media, deterministic-card fallback, text-only fallback, content types, and
length without OpenAI, logo fetches, X uploads, or public messages.

## Scope

### Stories Covered

| Story | Title | Priority |
| --- | --- | --- |
| [US-01M2QX2Y](../stories/US-01M2QX2Y-recover-final-scorigami-media-failures.md) | Recover final Scorigami media failures | High |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
| --- | --- | --- | --- | --- |
| US-01M2QX2Y | AC1 | Preferred Wallace media succeeds and records card content type. | TC001, TC002 | Automated; focused selector passes |
| US-01M2QX2Y | AC2 | Preferred failure reaches deterministic card. | TC003, TC004, TC005 | Automated; focused selector passes |
| US-01M2QX2Y | AC3 | Both media failures reach trimmed text-only output. | TC006, TC007, TC008 | Automated; focused selector passes |

**Coverage:** 3/3 ACs mapped to test cases; automation is complete and focused selectors pass.

### Test Types Required

| Type | Required | Rationale |
| --- | --- | --- |
| Unit | Yes | Card rendering and trim behavior are deterministic. |
| Integration | Yes | Final orchestration must select media/text tiers and finalize content types at the publisher seam. |
| E2E | No | No external X sink is authorized for the default suite. |

---

## Environment

| Requirement | Details |
| --- | --- |
| Prerequisites | Node.js 22, Jest 30, injected media/upload/publisher adapters, deterministic card fixture. |
| External Services | None in default tests; OpenAI, Winsipedia logos, and X are mocked. |
| Test Data | Verified new score 24-10 vs Virginia, long opponent name, media success/failure doubles. |

## Test Cases

### TC001: Preferred Wallace media success

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QX2Y AC1

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | New Scorigami final with successful Wallace card and upload. | Media ID is returned. |
| When | Final branch runs. | `tweetWithMedia` receives the trimmed verified text and media ID. |
| Then | Inspect finalized state. | Content type is `final_scorigami_card`. |

**Automation:** `src/index.test.js` title includes `preferred media`.

---

### TC002: Deterministic card renders locally

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QX2Y AC1

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Score 24-10 and escaped long opponent text. | No provider call is available. |
| When | `createScorigamiCard` runs. | A valid PNG is returned and score/opponent data is represented. |
| Then | Inspect bytes/size. | PNG signature is valid and output is non-empty. |

**Automation:** `src/scorigamiCard.test.js`.

---

### TC003: Preferred generation failure reaches deterministic card

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QX2Y AC2

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Wallace card generation throws and deterministic card/upload succeed. | Preferred error is logged. |
| When | Final branch runs. | Deterministic card is generated/uploaded and media publisher is called. |
| Then | Inspect calls. | Text-only publisher is not called. |

**Automation:** `src/index.test.js` title includes `deterministic media fallback`.

---

### TC004: Preferred upload failure reaches deterministic card

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QX2Y AC2 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Wallace card succeeds but its upload throws; deterministic card/upload succeed. | The first media attempt fails. |
| When | Final branch continues. | Deterministic card upload is attempted next. |
| Then | Inspect calls. | Exactly one successful media publisher call occurs. |

**Automation:** `src/index.test.js`.

---

### TC005: Malformed OpenAI response remains preferred reference path

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QX2Y AC2 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | OpenAI edit returns no image data inside `createWallaceWadeCard`. | The helper logs the failure and retains the reference image. |
| When | Wallace card completes. | Overlay/card output still returns a PNG. |
| Then | Inspect provider calls. | No deterministic-card fallback is required solely for an absorbed edit failure. |

**Automation:** `src/wallaceWadeCard.test.js`.

---

### TC006: Both media paths reach text-only

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QX2Y AC3

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Both card generation/upload paths throw. | No media ID exists. |
| When | Final branch runs. | Text publisher receives the verified score/opponent message. |
| Then | Inspect state. | Content type is `final_scorigami`; no silent failure occurs. |

**Automation:** `src/index.test.js` title includes `text-only media floor`.

---

### TC007: Text-only output preserves score and length

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QX2Y AC3 edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Exactly 280-character and 281-character text fixtures, plus a long opponent and both media failures. | The first is unchanged and the second is trimmed without losing verified score/opponent content. |
| When | Text-only publisher runs. | Every payload is <=280 characters. |
| Then | Inspect payloads. | The exact boundary and long-opponent cases preserve the verified score and opponent prefix. |

**Automation:** `src/index.test.js`, `src/tweetUtils.test.js`.

---

### TC008: Non-Scorigami skips media chain

**Type:** Unit/orchestration | **Priority:** Medium | **Story:** US-01M2QX2Y edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Completed score is not a new Scorigami. | Media creators/uploads are not needed. |
| When | Final branch runs. | Ordinary final text publisher is called once. |
| Then | Inspect calls. | No media provider is invoked. |

**Automation:** `src/index.test.js`.

---

### TC009: Media post failure remains uncertain

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QX2Y edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Media succeeds but the publisher throws after the claim. | The claim is recorded as uncertain. |
| When | The same final identity is retried. | No blind second post occurs. |
| Then | Inspect state. | Error metadata is observable for reconciliation. |

**Automation:** `src/index.test.js`.

---

### TC010: Media finalize failure remains uncertain

**Type:** Unit/orchestration | **Priority:** High | **Story:** US-01M2QX2Y edge case

| Step | Action | Expected Result |
| --- | --- | --- |
| Given | Media publisher succeeds but claim finalization fails. | The claim is uncertain and provider metadata failure is visible. |
| When | The same final identity is retried. | No second media/publication call occurs. |
| Then | Inspect state. | XNM at-most-once reconciliation behavior is preserved. |

**Automation:** `src/index.test.js`.

---

## Automation Status

| TC | Title | Status | Implementation |
| --- | --- | --- | --- |
| TC001 | Preferred Wallace media success | Automated | `src/index.test.js` |
| TC002 | Deterministic card renders locally | Automated | `src/scorigamiCard.test.js` |
| TC003 | Preferred generation failure reaches deterministic card | Automated | `src/index.test.js` |
| TC004 | Preferred upload failure reaches deterministic card | Automated | `src/index.test.js` |
| TC005 | Malformed OpenAI response remains preferred reference path | Automated | `src/wallaceWadeCard.test.js` with mocked OpenAI and logo fetch |
| TC006 | Both media paths reach text-only | Automated | `src/index.test.js` |
| TC007 | Text-only output preserves score and length | Automated | `src/index.test.js`, `src/tweetUtils.test.js` |
| TC008 | Non-Scorigami skips media chain | Automated | `src/index.test.js` |
| TC009 | Media post failure remains uncertain | Automated | `src/index.test.js` |
| TC010 | Media finalize failure remains uncertain | Automated | `src/index.test.js` |

---

## Traceability

| Artefact | Reference |
| --- | --- |
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP-01M2QXQF](../epics/EP-01M2QXQF-reliable-x-scorigami-publishing.md) |
| Story | [US-01M2QX2Y](../stories/US-01M2QX2Y-recover-final-scorigami-media-failures.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-17 | OpenCode; agent; v1 | Added 8 executable fallback/guard cases with local provider boundaries. |
| 2026-09-17 | OpenCode; agent; v1 | Added 10 executable fallback/guard cases with local provider boundaries; focused selectors pass. |
