# TS-01M2TARJ: Newsletter Recipient and Transport Safety

> **Status:** Complete
> **Epic:** [EP-01M2QXFK](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md)
> **Story:** [US-01M2QXFG](../stories/US-01M2QXFG-separate-test-newsletter-delivery-from-production-recipients.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1

## AC Coverage Matrix

| AC | Description | Test Cases | Status |
| --- | --- | --- | --- |
| AC1 | Test entrypoint uses only test recipient. | TC001 | Pass |
| AC2 | Production recipient is required/no test fallback. | TC002 | Pass |
| AC3 | Default suite cannot call transport. | TC003 | Pass |
| AC4 | Missing config fails closed. | TC004 | Pass |

**Coverage:** 4/4 ACs mapped.

## Test Cases

| TC | Case | Expected |
| --- | --- | --- |
| TC001 | Test recipient resolution | Only `NEWSLETTER_TEST_TO` reaches mocked transport. |
| TC002 | Production recipient guard | Missing `NEWSLETTER_TO` fails before transport. |
| TC003 | Transport guard | Default tests make zero Resend requests. |
| TC004 | Missing key/recipient | Both entrypoints fail before transport construction. |

**Automation:** `src/newsletter/sendNewsletter.test.js` with mocked Resend.

## Traceability

| Artefact | Reference |
| --- | --- |
| Epic | [EP-01M2QXFK](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md) |
| Story | [US-01M2QXFG](../stories/US-01M2QXFG-separate-test-newsletter-delivery-from-production-recipients.md) |

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added fail-closed recipient/transport cases. |
| 2026-09-18 | OpenCode; agent; v1 | Added input/workflow/transport cases; focused selectors pass. |
