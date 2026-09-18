# TS-01M2TF6N: Immutable Fact-Bound Editorial Validation

> **Status:** Complete
> **Epic:** [EP-01M2QXHW: Constrained Editorial and Media References](../epics/EP-01M2QXHW-constrained-editorial-and-media-references.md)
> **Story:** [US-01M2QXQ8: Validate AI editorial against immutable facts](../stories/US-01M2QXQ8-validate-ai-editorial-against-immutable-facts.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1

## AC Coverage Matrix

| AC | Description | Test Cases | Status |
| --- | --- | --- | --- |
| AC1 | Shared packet identity and deep immutability. | TC001 | Pass |
| AC2 | Deterministic numeric authority excludes untrusted evidence. | TC002, TC003 | Pass |
| AC3 | Internal/source/prompt language is rejected in every section. | TC004 | Pass |
| AC4 | Local schema boundary and deterministic fallback validation. | TC005, TC006 | Pass |

**Coverage:** 4/4 ACs mapped.

## Test Cases

| TC | Case | Expected |
| --- | --- | --- |
| TC001 | Five specialized agents receive one packet | Five captured packet arguments are the same object, recursively frozen, and unchanged after mutation attempts. |
| TC002 | Unsupported number only appears in external evidence | The model section is rejected with a stable unsupported-number reason; evidence does not authorize it. |
| TC003 | Numeric normalization | `14`, `14.0`, `1,014`, and signed `-3.5` forms compare deterministically without sign loss. |
| TC004 | Internal language across all visible fields | Agent, prompt, source, payload, canonical, provider, assistant, system, developer, and media-guide terms reject the section. |
| TC005 | Malformed structured section | Missing required fields, wrong arrays, and extra properties produce schema diagnostics. |
| TC006 | Rejection preservation and invalid deterministic replacement | `sectionResults` retains the original rejection code/disposition after a valid fallback; an invalid deterministic replacement throws rather than returning unvalidated issue data. |

**Automation:** `src/ai/orchestrator.test.js` and `src/ai/validateEditorial.test.js`; no OpenAI or network calls.

## Environment

| Requirement | Details |
| --- | --- |
| Prerequisites | Node.js 22, Jest 30, ESM test mocks. |
| External Services | None; OpenAI and moment discovery are mocked/disabled. |
| Test Data | Immutable packet with canonical numeric facts, untrusted evidence containing conflicting numbers, and all editorial section shapes. |

## Automation Status

| TC | Status | Implementation |
| --- | --- | --- |
| TC001-TC006 | Automated | `src/ai/orchestrator.test.js`, `src/ai/validateEditorial.test.js` |

## Traceability

| Artefact | Reference |
| --- | --- |
| Epic | [EP-01M2QXHW](../epics/EP-01M2QXHW-constrained-editorial-and-media-references.md) |
| Story | [US-01M2QXQ8](../stories/US-01M2QXQ8-validate-ai-editorial-against-immutable-facts.md) |
| Plan | [PL-01M2TF27](../plans/PL-01M2TF27-validate-ai-editorial-against-immutable-facts.md) |

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added non-vacuous identity, evidence-boundary, language, schema, and fallback cases. |
| 2026-09-18 | OpenCode; agent; v1 | All six cases pass; full Jest is 34 suites/156 tests with no provider calls. |
