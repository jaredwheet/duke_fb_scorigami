# US-01M2QXQ7: Fallback and audit when editorial providers fail

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/ai/agentClient.js, src/ai/agents/recapAgent.js, src/ai/agents/scorigamiAgent.js, src/ai/agents/historyAgent.js, src/ai/agents/accAgent.js, src/ai/agents/momentAgent.js, src/ai/moments/sourceDiscovery.js, src/ai/moments/sourceDiscovery.test.js, src/ai/moments/webMomentScout.js, src/ai/orchestrator.js, src/ai/orchestrator.test.js, src/newsletter/sendNewsletter.js, src/newsletter/sendNewsletterOrchestration.test.js, src/newsletter/newsletterPersistence.js, src/newsletter/newsletterPersistence.test.js, supabase/migrations/20260918180000_newsletter_editorial_audits.sql
> **Epic:** EP-01M2QXHW
> **Points:** 8
> **Persona:** Taylor Morgan

## User Story

**As a** Taylor Morgan
**I want** editorial orchestration to return deterministic fallback copy when OpenAI is unavailable, malformed, or slow, and to record a bounded audit before delivery
**So that** a provider outage never prevents an otherwise renderable newsletter and every sent issue has an operator-visible editorial disposition.

## Context

### Persona Reference

**Taylor Morgan** - publishing operator, accountable for safe scheduled delivery and recovery; has dealt with provider outages and prefers deterministic fallback tests over opaque automation.
[Full persona details](../personas/stakeholders/taylor-morgan.md)

### Background

`src/ai/orchestrator.js` coordinates editorial agents with `src/ai/fallbackEditorial.js` supplying
deterministic copy; `src/newsletter/sendNewsletter.js` is the pre-send audit boundary. PRD FR-007
requires missing optional AI or enrichment providers to use deterministic fallback paths without
creating unsupported facts. Q2Y owns the separate image-edit/card fallback. This story pins no-key,
malformed-output, timeout, repeatability, and audit-before-send behavior.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Security | Model/image providers remain optional and fallbacks are acceptable publication behavior. | All three ACs assert fallback without a provider call. |
| PRD | Functional | FR-007: missing optional AI, odds, image, or enrichment providers must use deterministic fallback paths where implemented. | AC1/AC3 encode missing-provider behavior. |
| TSD | Quality | Fallback and adversarial output paths require executable tests. | AC2 requires a malformed-output fixture. |

---

## Acceptance Criteria

### AC1: No-key deterministic editorial

- **Given** OPENAI_API_KEY is unset, empty, or whitespace-only,
- **When** newsletter editorial orchestration runs,
- **Then** all five editorial sections use deterministic copy, no OpenAI chat/response/web-search/discovery provider is called, final Q8 validation passes, and each affected section records `provider_not_configured`.
- **Verify:** shell npm test -- --runInBand src/ai/orchestrator.test.js -t "^Q7 AC1 unset-or-empty OpenAI key makes editorial orchestration perform zero provider calls$"
- **Caller:** `npm run newsletter:send` (sendNewsletter.js -> runEditorialOrchestrator -> fallbackEditorial.js)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC2: Malformed or rejected section fallback

- **Given** one agent returns invalid JSON, no content, an incomplete/extra-field structure, unsupported numbers, or internal/source language,
- **When** orchestration validates the result,
- **Then** only the affected section uses deterministic fallback, valid sibling sections remain provider output, and Q8 rejection reasons plus the stable provider reason are preserved.
- **Verify:** shell npm test -- --runInBand src/ai/orchestrator.test.js -t "^Q7 AC2 malformed partial section falls back while valid sibling sections remain provider output$"
- **Caller:** `npm run newsletter:send` (runEditorialOrchestrator -> validateEditorialPackage -> fallbackEditorial.js)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC3: Provider timeout is bounded

- **Given** an editorial, web-search, or moment provider never resolves,
- **When** orchestration runs,
- **Then** the request is bounded by the configured 30-second timeout, no in-process retry occurs, the affected section falls back, and a stable `provider_timeout` reason is recorded.
- **Verify:** shell npm test -- --runInBand src/ai/orchestrator.test.js -t "^Q7 EDGE provider timeout is bounded, falls back per section, and preserves the provider warning$"
- **Caller:** `npm run newsletter:send` (sendNewsletter.js -> runEditorialOrchestrator -> agentClient.js/webMomentScout.js)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC4: Deterministic fallback repeatability

- **Given** identical issue data and no successful provider output,
- **When** orchestration runs twice,
- **Then** editorial copy, section dispositions, and stable reason codes are identical across runs.
- **Verify:** shell npm test -- --runInBand src/ai/orchestrator.test.js -t "^Q7 EDGE deterministic editorial fallback is identical across repeated runs$"
- **Caller:** `npm run newsletter:send` (runEditorialOrchestrator -> fallbackEditorial.js)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC5: Editorial audit persists before delivery

- **Given** an issue has been rendered and an editorial result contains provenance and section dispositions,
- **When** production delivery prepares to call Resend,
- **Then** one append-only audit row is persisted first with bounded metadata; if audit persistence fails, Resend is not called and the delivery fails closed.
- **Verify:** shell npm test -- --runInBand src/newsletter/sendNewsletterOrchestration.test.js -t "^Q7 AC5 editorial audit persists before provider send and audit failure blocks send$"
- **Caller:** `npm run newsletter:send` (sendNewsletter.js -> saveNewsletterEditorialAudit -> Resend)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

> **AC5 evidence (2026-09-18):** Exact Q7 selectors and full Jest pass (`35 suites / 164 tests`).
> Production migration ledger versions `20260918153018` (`newsletter_delivery_claims`) and
> `20260918153032` (`newsletter_editorial_audits`) are applied; disposable `supabase-test` has the
> same audit contract. The audit table has RLS enabled, anon/authenticated insert denied, service-role
> insert allowed, issue/delivery/attempt linkage, bounded section/warning JSON checks, and an
> update/delete trigger that raises `newsletter editorial audit rows are append-only`; a unique
> `(delivery_id, attempt)` index and current-attempt trigger reject duplicate or stale audit rows. The orchestration
> test proves audit insertion precedes Resend and audit failure prevents the provider call.

---

## Scope

### In Scope

- Missing-`OPENAI_API_KEY` behavior for newsletter editorial orchestration.
- Malformed/incomplete structured agent output routed to deterministic fallback copy.
- Bounded timeouts and stable provider failure reasons for chat, response/web-search, and discovery calls.
- Deterministic repeatability of fallback copy and section outcomes.
- Append-only editorial audit persistence before external newsletter delivery, including fail-closed audit errors.
- Failure-injection seams in `agentClient.js`, `webMomentScout.js`, `orchestrator.js`, and newsletter delivery persistence.

### Out of Scope

- Validation rules themselves (US-01M2QXQ8 owns what is rejected).
- The X final-post media fallback chain (US-01M2QX2Y owns its ordering).
- Odds API or other enrichment-provider fallbacks beyond editorial.
- New fallback copy content beyond what `fallbackEditorial.js` provides.
- Image-edit and deterministic-card fallback behavior (US-01M2QX2Y owns the existing image boundary).

---

## Technical Notes

The orchestrator must check provider configuration before any call: no key means no request, straight
to `fallbackEditorial.js`. Every provider boundary has a finite 30-second default timeout and no
in-process retry; the scheduled job is the retry mechanism. Structured-output validation failures
(schema mismatch, missing sections, unsupported numbers, or internal language) route only the affected
section to fallback copy so healthy sections remain provider output. Preserve Q8 reason codes and add
stable provider reasons (`provider_not_configured`, `malformed_response`, `provider_error`,
`provider_timeout`) without raw prompt/response/error bodies. The final result remains deterministic.
Before Resend, persist one append-only audit row containing bounded provenance, mode, and section results;
an audit write failure blocks the provider call.

### API Contracts

No inbound API. Internal contracts: `runEditorialOrchestrator(issueData, options)` in
`src/ai/orchestrator.js`; fallback copy in `src/ai/fallbackEditorial.js`; image editing in
`src/openaiImageEditor.js`. Outbound: OpenAI chat/image APIs behind the existing agent client and
image editor adapters.

### Data Requirements

- Issue-data fixtures renderable with and without editorial sections.
- Malformed/incomplete agent-output fixtures, hanging provider doubles, mixed healthy/failing sections,
  and repeated no-provider runs.
- Supabase-shaped audit persistence double plus isolated migration contract evidence.
- No OpenAI credentials or live provider calls in the test environment.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- | --- |
| `OPENAI_API_KEY` empty string vs unset | Both treated as unavailable; no provider call. |
| Provider times out mid-orchestration | Finite timeout; affected section falls back with `provider_timeout`; no in-process retry. |
| One agent returns valid output while another is malformed | Only the malformed section uses fallback copy. |
| Fallback copy itself fails to render | Job fails observably rather than shipping a broken email. |
| Audit write fails before Resend | Delivery fails closed; provider is not called. |
| Fallback selected repeatedly across runs | Output is deterministic, so repeated runs produce the same copy (no drift). |

---

## Test Scenarios

- [ ] Run orchestration with no key and assert zero provider calls (jest "Q7 AC1...").
- [ ] Feed malformed/incomplete output and assert partial section fallback plus valid sibling preservation (jest "Q7 AC2...").
- [ ] Hang a provider and assert bounded timeout/fallback reason (jest "Q7 EDGE provider timeout...").
- [ ] Repeat no-provider orchestration and compare complete result/section metadata (jest "Q7 EDGE deterministic...").
- [ ] Persist editorial audit before send and block send on audit failure (jest "Q7 AC5...").
- [ ] Mixed-output test: valid and malformed agents in one run.
- [ ] Assert fallback output is stable across repeated runs.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QXQ8](US-01M2QXQ8-validate-ai-editorial-against-immutable-facts.md) | Upstream | Validation decides which outputs count as malformed before fallback runs. | Done |
| [US-01M2QX2Y](US-01M2QX2Y-recover-final-scorigami-media-failures.md) | Related | Owns the deterministic-card/image boundary; Q7 does not modify it. | Done |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| OpenAI image/chat availability | Provider | Optional; failure behavior is the subject of this story. |

---

## Estimation

**Points:** 8
**Complexity:** High

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/ai/orchestrator.js`, `src/ai/fallbackEditorial.js`, `src/openaiImageEditor.js` | `git revert` the story commit and re-run `npm test` | < 15 min |

---

## Resolved Questions

- Provider failures use stable reason codes and bounded safe summaries; raw provider errors, prompts, responses,
  and secrets are not logged or persisted.
- Timeout is 30 seconds by default with no in-process retry; scheduled execution retries through the existing
  delivery claim boundary.
- Editorial audit is append-only and persisted before Resend; audit failure blocks external delivery.
- Image-edit/card fallback remains Q2Y scope.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-18 | Three Amigos refinement | Expanded Q7 for bounded provider failures and pre-send append-only audit; removed image fallback overlap with Q2Y and added exact selectors. |
