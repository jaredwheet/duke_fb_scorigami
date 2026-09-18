# TS-01M2TAZ8: Safe Fact-Backed Newsletter Rendering

> **Status:** Complete
> **Epic:** [EP-01M2QXFK](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md)
> **Story:** [US-01M2QXAG](../stories/US-01M2QXAG-render-fact-backed-newsletter-editions-safely.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1

## AC Coverage Matrix

| AC | Description | Test Cases | Status |
| --- | --- | --- | --- |
| AC1 | Fact packet values pass through unchanged, including zero. | TC001, TC002 | Pass |
| AC2 | All editions degrade cleanly when optional data is absent. | TC003, TC004 | Pass |
| AC3 | Text/URL interpolation is safe and configured. | TC005, TC006 | Pass |

**Coverage:** 3/3 ACs mapped.

## Test Cases

| TC | Case | Expected |
| --- | --- | --- |
| TC001 | Sunday known packet | Score/record/context values appear unchanged. |
| TC002 | Zero/null values | Zero renders as `0`; null optional values omit cleanly. |
| TC003 | Watercooler optionals absent | Output remains valid with deterministic omission. |
| TC004 | Bulletin optionals absent | Output remains valid with no invented odds/records. |
| TC005 | HTML-sensitive text | `<script>`, ampersands, quotes, and brackets are escaped. |
| TC006 | URL/config guard | Production URL config must be HTTPS; local invalid URLs never ship. |

**Automation:** Existing renderer tests plus new zero/optional/URL cases.

## Traceability

| Artefact | Reference |
| --- | --- |
| Epic | [EP-01M2QXFK](../epics/EP-01M2QXFK-newsletter-publishing-and-delivery.md) |
| Story | [US-01M2QXAG](../stories/US-01M2QXAG-render-fact-backed-newsletter-editions-safely.md) |

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added all-edition zero/optional/escaping/URL cases; focused selectors pass. |
