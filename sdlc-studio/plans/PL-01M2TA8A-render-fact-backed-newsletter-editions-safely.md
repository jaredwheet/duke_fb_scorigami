# PL-01M2TA8A: Render fact-backed newsletter editions safely

> **Status:** Complete
> **Story:** [US-01M2QXAG: Render fact-backed newsletter editions safely](../stories/US-01M2QXAG-render-fact-backed-newsletter-editions-safely.md)
> **Epic:** [EP-01M2QXFK: Newsletter Publishing and Delivery](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1
> **Language:** JavaScript ES modules, Node.js 22

## Overview

Exercise all edition renderers with fact-packet passthrough, zero/null values, absent optionals, escaping,
configuration-owned URLs, and football/Duke-scoped canonical inputs.

## Acceptance Criteria Summary

| AC | Name | Description |
| --- | --- | --- |
| AC1 | Fact passthrough | Packet values render without template recalculation. |
| AC2 | Optional fallback | Missing optional sections omit/fallback without invalid HTML. |
| AC3 | Escaping/URLs | Controlled text is escaped and production URLs are validated/configured. |

## Implementation Tasks

| # | Task | File | Status |
| --- | --- | --- |
| 1 | Add all-edition packet/optional/escaping/zero-value tests. | `src/newsletter/renderNewsletter.test.js`, `src/newsletter/renderBriefNewsletter.test.js` | [x] |
| 2 | Fix zero-value rendering, null optional sections, invalid production URL configuration, and scoped canonical query inputs. | `src/newsletter/renderNewsletter.js`, `src/newsletter/renderBriefNewsletter.js`, `src/newsletter/newsletterEmail.js`, `src/newsletter/loadSundayIssueData.js` | [x] |
| 3 | Run focused selectors and full Jest with no providers. | Newsletter tests | [x] 3 AC verifiers pass |

## Edge Case Handling

| Edge | Strategy |
| --- | --- |
| Numeric zero/null | Use nullish checks; preserve zero, omit null. |
| Optional odds/history/moments absent | Omit section or use fact-neutral fallback. |
| HTML-sensitive text | Escape all interpolation boundaries. |
| Invalid production URLs | Fail before send; local fixtures use `example.invalid`. |
| Non-football/non-Duke rows | Query scope requires football sport and Duke team slug. |

**Coverage:** 5/5 listed interactions handled

## Verification

| AC | Selector | Status |
| --- | --- | --- |
| AC1 | `npm test -- --runInBand -t "newsletter HTML"` | Pass |
| AC2 | `npm test -- --runInBand -t "newsletter optional"` | Pass |
| AC3 | `npm test -- --runInBand -t "newsletter escape"` | Pass |

## Definition of Done

- [x] All selectors/full suite pass.
- [x] Zero/optional/escaping/scope/URL tests are recorded.
- [ ] Independent review and sign-off are recorded.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added all-edition rendering, zero-value, URL, and scope test phases. |
| 2026-09-18 | OpenCode; agent; v1 | Implemented rendering guards and recorded all three AC selector passes. |
