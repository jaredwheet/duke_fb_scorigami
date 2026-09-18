# PL-01M2TF27: Validate AI editorial against immutable facts

> **Status:** Complete
> **Story:** [US-01M2QXQ8: Validate AI editorial against immutable facts](../stories/US-01M2QXQ8-validate-ai-editorial-against-immutable-facts.md)
> **Epic:** [EP-01M2QXHW: Constrained Editorial and Media References](../epics/EP-01M2QXHW-constrained-editorial-and-media-references.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1
> **Language:** JavaScript ES modules, Node.js 22, Jest 30

## Overview

Harden the shared editorial packet boundary, deterministic numeric authority, local structured-output validation,
internal-language rejection, per-section diagnostics, and fail-closed fallback validation.

## Acceptance Criteria Summary

| AC | Name | Description |
| --- | --- | --- |
| AC1 | Shared packet | All five specialized agents receive one deeply frozen packet identity. |
| AC2 | Numeric authority | Unsupported numbers, including numbers present only in untrusted evidence, are rejected. |
| AC3 | Language boundary | Internal/source/prompt language is rejected in every visible section. |
| AC4 | Schema/fallback boundary | Local schema failures produce stable diagnostics and only valid deterministic replacements survive. |

## Implementation Tasks

| # | Task | File | Status |
| --- | --- | --- |
| 1 | Separate deterministic facts from untrusted evidence and preserve one recursively frozen packet. | `src/ai/issuePacket.js` | [x] |
| 2 | Add local required-field/type/additional-property checks, normalized numeric allowlisting from `packet.facts`, internal-language detection, and section result codes. | `src/ai/validateEditorial.js`, `src/ai/schemas.js` | [x] |
| 3 | Preserve initial rejection diagnostics and stable reason codes in `sectionResults` after replacement, validate deterministic replacements, fail closed on invalid fallback, and expose bounded in-memory provenance. | `src/ai/orchestrator.js` | [x] |
| 4 | Add exact identity/immutability, unsupported-evidence-number, every-field language, schema, and fallback tests. | `src/ai/orchestrator.test.js`, `src/ai/validateEditorial.test.js` | [x] |
| 5 | Run exact AC selectors and full Jest without OpenAI/network calls. | AI tests | [x] 4 selectors; full suite 34 suites/156 tests |

## Edge Case Handling

| Edge | Strategy |
| --- | --- |
| Packet consumer mutation | Recursive freeze and identity test across all five agent boundaries. |
| Number only in external evidence | Evidence excluded from numeric authority; validation rejects the number. |
| `14.0`, comma-formatted, or signed values | Normalize numeric tokens without discarding sign. |
| Internal markers | Table-test agent/prompt/source/payload/canonical/provider/assistant/system/developer terms in every text field. |
| Missing/wrong/extra schema fields | Local schema validator rejects before application. |
| Invalid deterministic fallback | Final validation failure throws; no unvalidated issue data returns. |

**Coverage:** 6/6 listed interactions handled

## Verification

| AC | Selector | Status |
| --- | --- | --- |
| AC1 | `npm test -- --runInBand -t "^Q8 AC1 shared packet identity and deep immutability$"` | Pass |
| AC2 | `npm test -- --runInBand -t "^Q8 AC2 rejects unsupported numbers including untrusted evidence$"` | Pass |
| AC3 | `npm test -- --runInBand -t "^Q8 AC3 rejects internal source language in every section$"` | Pass |
| AC4 | `npm test -- --runInBand -t "^Q8 AC4 local schema boundary and fallback validation$"` | Pass |

## Definition of Done

- [x] All four exact selectors and full Jest pass.
- [x] Numeric authority excludes untrusted evidence and normalization is tested.
- [x] Initial rejection diagnostics remain available after fallback selection.
- [ ] Independent plan and delivery reviews approve; reviewer-of-record sign-off remains terminal.

## Resolved Questions

- Durable provider/rejection audit storage is Q7 scope; Q8 returns bounded in-memory diagnostics only.
- Raw prompts, model responses, credentials, and external evidence are never persisted by Q8.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added refined ACs, exact selectors, untrusted-evidence boundary, and fail-closed validation tasks. |
| 2026-09-18 | TDD implementation | Hardened packet/evidence separation, local schema validation, reason codes, fallback validation, and exact adversarial tests. |
