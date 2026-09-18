# EP-01M2QXHW: Constrained Editorial and Media References

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Size:** L

## Summary

Keep AI-assisted editorial wording bounded by verified facts and make reviewed media-guide context
reusable and cited.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| PRD | Security | External source text and model output are untrusted until validation. | Validator tests must reject unsupported claims and unsafe source language. |
| PRD | Data integrity | AI may write editorial wording but never calculate numeric facts. | Fact packets remain the only numeric authority. |
| TRD | Architecture | AI and media-guide modules sit behind explicit issue/fact boundaries. | No provider response can bypass deterministic validation. |
| TSD | Quality | Fallback and adversarial output paths require executable tests. | Missing OpenAI or malformed responses must be covered. |

---

## Business Context

### Problem Statement

Readers benefit from readable recap, history, ACC, and turning-point prose, but a model or web source
can introduce a plausible unsupported number. Reviewed media-guide context also needs citations and a
repeatable artifact path instead of parsing a PDF during every send. [HIGH]

**PRD Reference:** [Constrained AI Editorial](../prd.md#constrained-ai-editorial)

### Value Proposition

Editors get varied copy without surrendering numeric truth, and historical context can be reused with
known source pages and verification state.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Unsupported numeric output accepted | Validator exists | Zero accepted in adversarial fixture set | Validator suite |
| Model outage publication failure | Deterministic fallback exists | Newsletter remains renderable | Missing/invalid model tests |
| Guide claim citation completeness | JSON and optional claims migration | Every imported claim has source page/hash | Import contract test |
| Future edition portability | Hard-coded 2026 | Explicitly decided and documented | Architecture/product decision |

---

## Scope

### In Scope

- Immutable issue fact packets and structured editorial agent outputs.
- Numeric/source-language validation, deterministic fallback, and untrusted moment discovery.
- PDF extraction, guide curation, loading, preview, and claims import contracts.
- Citation pages, hashes, verification state, and 2026 artifact reproducibility.

### Out of Scope

- Training or fine-tuning a model.
- Treating Reddit or web discovery as an authoritative sports database.
- Replacing the checked-in guide artifact with an unreviewed live scraper.
- Supporting future guide editions until their artifact/version contract is decided.

### Affected Personas

- **Jamie Carter:** needs readable, source-backed editorial scope.
- **Casey Nguyen:** needs rejection/fallback tests that can fail.
- **Avery Brooks:** needs trustworthy context rather than confident speculation.

---

## Acceptance Criteria (Epic Level)

- [ ] Every AI agent receives verified facts through the shared issue packet and cannot author a
  numeric fact outside it.
- [ ] Invalid model/source output is rejected or replaced with deterministic copy.
- [ ] The reviewed 2026 guide artifact and imported claims retain citation and verification metadata.
- [ ] Guide extraction output remains derived and does not become a runtime dependency of rendering.

---

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| Canonical facts and directives | Data | Foundation epic | Rowan Patel |
| Newsletter issue packet | Feature | Newsletter epic | Jamie Carter |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| Newsletter editorial sections | Feature | They consume validated copy and guide context. |
| Media-guide import command | Operations | It depends on the claims migration. |

---

## Risks & Assumptions

### Assumptions

- Deterministic validators can compare model output against the issue packet.
- The checked-in JSON is the reviewed 2026 source artifact.
- Model/image providers remain optional and fallbacks are acceptable publication behavior.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Validator accepts a plausible unsupported statistic | Medium | High | Adversarial numeric fixtures and mutation checks. |
| External moment evidence becomes an unverified fact | Medium | High | Preserve untrusted evidence boundary and test rejection. |
| Guide artifact becomes stale or hard-coded | Medium | Medium | Hash/citation validation and explicit future-season decision. |
| Prompt/model change alters output contract | Medium | Medium | Structured schema tests and model configuration audit. |

---

## Technical Considerations

### Architecture Impact

Keep `issuePacket.js`, `orchestrator.js`, `validateEditorial.js`, and `fallbackEditorial.js` as the
fact-to-copy boundary. Keep media-guide extraction, curation, loading, and claims persistence separate
so generated text is never the source of numeric truth.

### Integration Points

OpenAI editorial/image/moment services, external web/Reddit sources, the media-guide PDF/JSON files,
and optional Supabase claims tables.

---

## Sizing

**Size:** L

**Estimated Story Count:** 3

**Derived Point Total:** 21

_The point total is derived by reconcile after stories are created._

**Complexity Factors:**

- Adversarial validation of structured model output.
- Untrusted external evidence and deterministic fallback.
- Citation-backed reference artifacts and optional migration.

---

## Story Breakdown

<!-- Story links are maintained by artifact.py. -->
---
- [x] [US-01M2QXQ8: Validate AI editorial against immutable facts](../stories/US-01M2QXQ8-validate-ai-editorial-against-immutable-facts.md)
- [x] [US-01M2QXQ7: Fallback when editorial and image providers fail](../stories/US-01M2QXQ7-fallback-when-editorial-and-image-providers-fail.md)
- [x] [US-01M2QXMY: Validate and import cited media-guide claims](../stories/US-01M2QXMY-validate-and-import-cited-media-guide-claims.md)

## Test Plan

Test specs will cover packet immutability, output rejection/fallback, moment evidence boundaries,
guide artifact validation, citation imports, and command path independence.

---

## Open Questions

- [x] Which model/prompt versions must be retained for editorial audit? - Decision D0005: Q7 retains bounded provider/model, prompt-template, packet, schema, validator, fallback, disposition, and timestamp metadata; raw prompts/responses are out of scope.
- [x] What is the supported process for adding a 2027 media guide? - Decision D0006: a future guide requires a separately reviewed/versioned artifact and citation contract; this epic supports only the reviewed 2026 artifact.
- [x] Is the claims import migration required in every production environment? - Decision D0007: environments running claims import must apply the migration; local artifact-backed rendering does not require the claims table.

## Three Amigos Consultation

**Date:** 2026-09-18  
**Participants:** Product Owner, Engineering, QA  
**Verdict:** Conditional approval after refinement.

- Q8 is the first implementation slice: immutable packet, deterministic-facts-only numeric authority, local schema checks, internal-language rejection, stable per-section diagnostics, and fail-closed fallback validation.
- Q7 owns provider failure behavior and durable audit persistence; QMY owns claim-level guide provenance and import semantics. No raw prompts, raw model responses, or credentials are persisted.
- External sources and discovered moments remain untrusted evidence and cannot authorize numeric output. QMY must complete before guide-backed editorial claims are treated as verified.
- Exact selectors must exercise the feature; broad substrings such as `fallback`, `unsupported`, or `internal` are not acceptable acceptance verifiers.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | SDLC Studio onboarding | Decomposed constrained editorial, fallback, and media-guide requirements into an epic. |
| 2026-09-18 | Three Amigos refinement | Resolved provenance/guide/migration questions, assigned Q8/Q7/QMY boundaries, and approved Q8 as the first implementation slice. |
