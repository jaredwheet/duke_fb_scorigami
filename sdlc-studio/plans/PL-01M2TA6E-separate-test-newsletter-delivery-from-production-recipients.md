# PL-01M2TA6E: Separate test newsletter delivery from production recipients

> **Status:** Complete
> **Story:** [US-01M2QXFG: Separate test newsletter delivery from production recipients](../stories/US-01M2QXFG-separate-test-newsletter-delivery-from-production-recipients.md)
> **Epic:** [EP-01M2QXFK: Newsletter Publishing and Delivery](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1
> **Language:** JavaScript ES modules, GitHub Actions YAML, Node.js 22

## Overview

Separate production/test recipients, fail closed on missing configuration, and prove the default Jest suite
cannot contact Resend or a real recipient.

## Implementation Tasks

| # | Task | File | Status |
| --- | --- | --- | --- |
| 1 | Refactor send entrypoints to export testable functions and enforce production/test recipient separation. | `src/newsletter/sendNewsletter.js`, `src/newsletter/sendTestNewsletter.js` | [x] |
| 2 | Add transport spy/no-network tests for recipient, key, edition/date, and workflow input contracts. | `src/newsletter/sendNewsletter.test.js` | [x] |
| 3 | Update workflows and operator documentation with strict secret/input wiring and no production-to-test fallback. | `.github/workflows/newsletter.yml`, `.github/workflows/newsletter-test.yml`, `README.md` | [x] |

## Verification

| AC | Selector | Status |
| --- | --- | --- |
| AC1 | `npm test -- --runInBand -t "test newsletter recipient"` | Pass |
| AC2 | `npm test -- --runInBand -t "production recipient required"` | Pass |
| AC3 | `npm test -- --runInBand -t "newsletter transport guard"` | Pass |
| AC4 | `npm test -- --runInBand -t "newsletter configuration"` | Pass |

## Edge Case Handling

| Edge | Strategy |
| --- | --- |
| Missing production recipient | Refuse before Resend construction. |
| Test recipient present | Only test entrypoint may use it. |
| Missing API key | Refuse before transport. |
| Default Jest suite | Mock transport and assert zero network calls. |
| Invalid edition/date | Validate before rendering/send. |

**Coverage:** 5/5 interactions handled

## Definition of Done

- [x] Production/test separation and transport guard pass.
- [x] Workflow secret/input contract is tested.
- [x] No external recipient/sink is contacted by default tests.
- [ ] Independent review/sign-off recorded.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added fail-closed recipient and transport-guard implementation phases. |
| 2026-09-18 | OpenCode; agent; v1 | Added input validation, strict URL validation, workflow assertions, and four AC selector passes. |
