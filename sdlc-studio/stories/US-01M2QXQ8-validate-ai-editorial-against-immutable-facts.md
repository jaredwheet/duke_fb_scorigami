# US-01M2QXQ8: Validate AI editorial against immutable facts

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/ai/issuePacket.js, src/ai/orchestrator.js, src/ai/validateEditorial.js, src/ai/schemas.js, src/ai/orchestrator.test.js, src/ai/validateEditorial.test.js
> **Epic:** EP-01M2QXHW
> **Points:** 5
> **Persona:** Avery Brooks

## User Story

**As a** Avery Brooks
**I want** every editorial agent to receive the same immutable fact packet and any unsupported number or internal source language in model output to be rejected
**So that** generated prose can vary while numeric truth stays fixed.

## Context

### Persona Reference

**Avery Brooks** - Duke football follower, the served reader; veto line: a publication must not state an incorrect score, opponent, date, or record as fact, and unsupported statistics must not be invented.
[Full persona details](../personas/stakeholders/avery-brooks.md)

### Background

`src/ai/issuePacket.js` builds the fact packet, `runEditorialOrchestrator` in
`src/ai/orchestrator.js` fans out to specialized agents, and `validateEditorialPackage` in
`src/ai/validateEditorial.js` checks structured output against `src/ai/schemas.js`. PRD FR-006 requires
AI output to pass numeric and source-language validation before inclusion, and the epic risk table
calls a plausible unsupported statistic the highest-impact failure. This story pins the shared-packet,
numeric-rejection, and internal-language-rejection contracts.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Security | External source text and model output are untrusted until validation. | AC2/AC3 require rejection paths with adversarial fixtures. |
| PRD | Data integrity | AI may write editorial wording but never calculate numeric facts. | AC1 asserts the packet is the only numeric authority shared with agents. |
| TRD | Architecture | No provider response can bypass deterministic validation. | Validation sits between the model response and inclusion in the newsletter. |

---

## Acceptance Criteria

### AC1: Shared immutable fact packet

- **Given** a canonical issue fact packet,
- **When** editorial agents are invoked,
- **Then** every specialized agent receives the same verified packet and structured output contract.
- **Verify:** shell npm test -- --runInBand -t "^Q8 AC1 shared packet identity and deep immutability$"
- **Caller:** `npm run newsletter:send` (sendNewsletter.js -> issueData.js -> runEditorialOrchestrator)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC2: Unsupported numbers rejected

- **Given** model output contains a number not present in the fact packet,
- **When** editorial validation runs,
- **Then** the output is rejected rather than included in the newsletter.
- **Verify:** shell npm test -- --runInBand -t "^Q8 AC2 rejects unsupported numbers including untrusted evidence$"
- **Caller:** `npm run newsletter:send` (runEditorialOrchestrator -> validateEditorialPackage)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC3: Internal source language rejected

- **Given** model output contains internal source or prompt language,
- **When** editorial validation runs,
- **Then** the output is rejected or replaced with deterministic copy.
- **Verify:** shell npm test -- --runInBand -t "^Q8 AC3 rejects internal source language in every section$"
- **Caller:** `npm run newsletter:send` (runEditorialOrchestrator -> validateEditorialPackage)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC4: Structured output boundary fails closed

- **Given** a model section is missing required fields, has the wrong field type, or contains an extra field,
- **When** editorial validation and deterministic replacement complete,
- **Then** the invalid section is marked with a stable rejection reason, replaced only by a valid deterministic section, and the orchestrator refuses to publish if the deterministic replacement itself is invalid.
- **Verify:** shell npm test -- --runInBand -t "^Q8 AC4 local schema boundary and fallback validation$"
- **Caller:** `npm run newsletter:send` (runEditorialOrchestrator -> validateEditorialPackage)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

---

## Scope

### In Scope

- Issue fact packet immutability and its single shared instance across recap, turning-point, Scorigami, history, and ACC agents.
- Structured output contract enforcement via `schemas.js`.
- Numeric cross-check: any number in model output must appear in the fact packet.
- Internal/source/prompt language rejection with deterministic replacement where applicable.
- Per-section validation disposition and stable rejection reason codes returned to the downstream delivery/audit boundary.
- Local required-field, type, and additional-property checks independent of provider-side structured-output enforcement.
- Deterministic replacement is validated before the orchestrator returns publishable issue data.
- Adversarial fixture set in `orchestrator.test.js`.

### Out of Scope

- Training or fine-tuning models.
- Deterministic fallback copy content itself (US-01M2QXQ7 owns fallback behavior).
- External moment discovery and its untrusted-evidence boundary beyond what validation consumes.
- Provider availability handling (US-01M2QXQ7).

---

## Technical Notes

The validator must treat the deterministic `packet.facts` subtree as the closed set of permitted numbers:
extract numeric tokens from model output, normalize commas/decimal spelling, and reject any not present in
verified facts. `packet.evidence` may contain external leads, but its numbers are never authority.
Internal-language detection covers prompt fragments, source labels, assistant/system/developer markers,
and media-guide/source terminology at every visible editorial field; rejection may replace the section with
deterministic copy. The packet must be frozen (`Object.freeze`-equivalent discipline) before fan-out so no
agent can mutate another's input.
Local validation enforces each schema's required fields, primitive/array types, and additional-property rule;
provider-side JSON schema enforcement is not trusted as the only boundary.
Keep `validateEditorialPackage` pure and synchronous for deterministic testing. Return per-section
`sectionResults` with `approved|rejected|fallback` disposition and stable reason codes. Durable audit
persistence and raw prompt/response retention belong to Q7's delivery boundary, not this story.

### API Contracts

No inbound API. Internal contracts: `runEditorialOrchestrator(issueData, options)` in
`src/ai/orchestrator.js`; `validateEditorialPackage({ packet, editorial })` in
`src/ai/validateEditorial.js`; schema definitions in `src/ai/schemas.js`; packet construction in
`src/ai/issuePacket.js`. Outbound: OpenAI structured outputs via `src/ai/agentClient.js` (optional;
tests use fixtures, not live calls).

### Data Requirements

- Canonical fact packets with known numeric values for the cross-check.
- Adversarial model-output fixtures: unsupported numbers, prompt/internal language, malformed structure.
- Structured-schema fixtures conforming to `schemas.js`.
- No OpenAI credentials required for the test suite.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- | --- |
| Model output includes a plausible but unsupported number | Rejected; the section uses rejection/replacement handling, never the unsupported value. |
| Model output repeats a packet number in a new context | Accepted only if the number itself is present in the packet; wording checks still apply. |
| Number formatting differs (e.g. "14.0" vs "14") | Normalization decides equivalence deterministically; behavior documented in tests. |
| Output contains prompt/system fragments | Rejected or replaced with deterministic copy. |
| Output violates the structured schema | Treated as malformed; falls to US-01M2QXQ7 fallback handling. |
| Packet mutated by one agent before another runs | Frozen packet prevents mutation; test asserts the second agent sees original values. |
| Validation itself throws on unexpected output shape | Orchestrator catches and routes to deterministic fallback; no partial unvalidated copy ships. |

---

## Test Scenarios

- [ ] Fan out to every specialized agent with one shared packet instance and assert identical verified values (jest "fact packet").
- [ ] Adversarial output with an unsupported number is rejected (jest "unsupported").
- [ ] Output with internal source/prompt language is rejected or replaced (jest "internal").
- [ ] Structured-schema conformance fixtures for each agent contract.
- [ ] Packet immutability test: mutate one consumer's view and assert others are unaffected.
- [ ] Rejected sections retain stable reason codes while deterministic fallback validation remains independently green.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QXB4](US-01M2QXB4-refresh-paginated-facts-and-directives-deterministically.md) | Upstream | Canonical facts/directives supply the packet's verified values. | Done |
| [US-01M2QXQ7](US-01M2QXQ7-fallback-when-editorial-and-image-providers-fail.md) | Downstream | Rejection triggers the deterministic fallback path. | Draft |
| [US-01M2QXAG](US-01M2QXAG-render-fact-backed-newsletter-editions-safely.md) | Downstream | Validated editorial copy renders as optional newsletter sections. | Done |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| OpenAI structured-output model configuration | Provider | Optional at test time; fixtures stand in. |
| Newsletter issue packet | Feature | Newsletter epic EP-01M2QXFK. |

---

## Estimation

**Points:** 5
**Complexity:** Medium

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/ai/issuePacket.js`, `orchestrator.js`, `validateEditorial.js`, `schemas.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| A newsletter issue rendered with rejected copy | Re-render/regenerate the issue after fix; persistence keys prevent duplicate sends | < 1 job run |

---

## Resolved Questions

- Q8 returns bounded in-memory validation dispositions and reason codes; Q7 owns durable provenance/rejection
  audit persistence before external delivery. Raw prompts and model responses are not stored by Q8.
- Numeric authorization excludes `packet.evidence` (external sources and discovered moments); only deterministic
  `packet.facts` values may authorize model numbers.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-18 | Three Amigos refinement | Added AC4, exact non-vacuous selectors, local schema enforcement, untrusted-evidence exclusion, stable section diagnostics, and Q7 audit-boundary decision. |
