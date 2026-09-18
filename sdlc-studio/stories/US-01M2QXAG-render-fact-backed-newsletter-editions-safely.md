# US-01M2QXAG: Render fact-backed newsletter editions safely

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/newsletter/issueData.js, src/newsletter/editionData.js, src/newsletter/loadSundayIssueData.js, src/newsletter/renderNewsletter.js, src/newsletter/renderBriefNewsletter.js, src/newsletter/newsletterEmail.js, src/newsletter/renderNewsletter.test.js, src/newsletter/renderBriefNewsletter.test.js
> **Epic:** EP-01M2QXFK
> **Points:** 5
> **Persona:** Avery Brooks

## User Story

**As a** Avery Brooks
**I want** edition HTML to use only fact-packet values and to degrade deterministically when optional data is absent
**So that** rendered newsletters never invent numbers and remain valid email HTML under any provider gap.

## Context

### Persona Reference

**Avery Brooks** - Duke football follower, the served reader; veto line: a publication must not state an incorrect score, opponent, date, or record as fact, and a missing optional source must produce an honest omission or fallback.
[Full persona details](../personas/stakeholders/avery-brooks.md)

### Background

`src/newsletter/issueData.js` and `editionData.js` assemble fact packets;
`renderNewsletter.js`/`renderBriefNewsletter.js` render MJML-ish HTML consumed by `prepareNewsletter` in
`newsletterEmail.js`. PRD requires newsletter content to include only fact-packet values for scores,
standings, leaders, odds, and other numeric claims, and HTML rendering to escape provider-controlled
text. This story pins the fact-passthrough, optional-fallback, and escaping contracts.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Data integrity | Newsletter modules consume canonical facts; no numeric recalculation in templates. | AC1 asserts values pass through the packet unchanged. |
| PRD | Security | External source text and AI output are untrusted until validation. | AC3 requires escaping provider-controlled text before it enters HTML. |
| TSD | Quality | Every edition and fallback needs deterministic unit coverage plus boundary tests. | AC2 requires missing-optional fixtures per edition. |

---

## Acceptance Criteria

### AC1: Fact-packet passthrough

- **Given** an issue fact packet contains a score, record, standings, and game context,
- **When** an edition is rendered,
- **Then** the HTML uses those values without recalculating them in the template.
- **Verify:** shell npm test -- --runInBand -t "newsletter HTML"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js -> prepareNewsletter -> renderNewsletter/renderBriefNewsletter)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC2: Optional-data fallback

- **Given** optional odds, history, or moment data is absent,
- **When** an edition is rendered,
- **Then** the optional section is omitted or replaced by its deterministic fallback and the email remains valid.
- **Verify:** shell npm test -- --runInBand -t "newsletter optional"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js -> prepareNewsletter -> renderNewsletter/renderBriefNewsletter)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC3: HTML escaping

- **Given** provider-controlled text contains HTML-sensitive characters,
- **When** newsletter HTML is rendered,
- **Then** the text is escaped and cannot inject markup into the email.
- **Verify:** shell npm test -- --runInBand -t "newsletter escape"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js -> prepareNewsletter -> renderNewsletter/renderBriefNewsletter)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

---

## Scope

### In Scope

- Render path passthrough of fact-packet values (score, record, standings, game context) without recalculation.
- Deterministic omission/fallback for absent odds, history, and moment sections across editions.
- Escaping of provider-controlled text in all rendered outputs.
- Validity of the rendered email HTML with optional sections absent.
- `renderNewsletter.test.js` and `renderBriefNewsletter.test.js` fixture matrices.

### Out of Scope

- Fact packet assembly logic itself (issueData/editionData sourcing contracts beyond what rendering needs).
- AI editorial content generation (EP-01M2QXHW stories).
- Delivery transport and recipient separation (US-01M2QXFG).
- New editions or template redesigns.

---

## Technical Notes

Rendering must treat the fact packet as read-only input: templates may format but never compute a
numeric value. Escape all provider- or AI-controlled strings at the interpolation boundary (a single
escape helper, not per-template ad-hoc). The optional-section contract is per edition: absent odds
(Watercooler/Bulletin), absent history/moment sections (Sunday recap), each with a deterministic
fallback copy or clean omission that keeps the HTML valid. Keep `newsletterEmail.js`'s `prepareNewsletter`
as the assembly seam so tests can render with injected packets. Production unsubscribe/preferences URLs
are configuration-owned HTTPS values; local fixtures may use `https://example.invalid/...` or omit them.
Numeric zero is a valid fact value and must not be treated as absent.

### API Contracts

No inbound API. Internal contracts: `prepareNewsletter(...)` in `src/newsletter/newsletterEmail.js`
consuming issue packets from `src/newsletter/issueData.js`/`editionData.js` and renderers
`src/newsletter/renderNewsletter.js`/`renderBriefNewsletter.js`. Outbound: MJML/HTML rendering toolchain
and Resend send (send path, not this story's concern).

### Data Requirements

- Fact-packet fixtures with known score/record/standings values to detect any recalculation drift.
- Per-edition fixtures with optional odds/history/moments present and absent.
- Adversarial text fixtures containing `<script>`, `&`, quotes, and bracket characters.
- No provider credentials required; rendering tests are hermetic.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- | --- |
| Odds data absent on a Bulletin edition | Odds section omitted or replaced by the deterministic fallback; email still valid. |
| Moment/history section absent on the Sunday edition | Section omitted; recap renders without it. |
| Opponent name contains `<` or `&` | Escaped in the HTML; no markup injection. |
| Fact packet value is 0 or null | Rendered verbatim as provided; never coerced or recalculated. |
| Standings list empty | Standings section omitted with its fallback; no empty table artifacts. |
| Very long provider text | Rendered escaped and truncated or wrapped per the template's existing rule. |
| One optional section fails to render | The section-level try/catch degrades to the fallback without failing the whole email. |

---

## Test Scenarios

- [ ] Render with a known packet and assert the HTML contains the packet values unchanged (jest "HTML").
- [ ] Render each edition with optional data absent and assert omission/fallback plus valid HTML (jest "optional").
- [ ] Render provider text with HTML-sensitive characters and assert escaped output (jest "escape").
- [ ] Snapshot or structural checks that templates never recalculate a numeric value.
- [ ] Validity check of rendered HTML with all optional sections absent.

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QX66](US-01M2QX66-select-scheduled-newsletter-editions.md) | Upstream | The selected edition determines the renderer and packet shape. | Draft |
| [US-01M2QX6F](US-01M2QX6F-persist-newsletter-issues-and-deliveries-idempotently.md) | Upstream | Rendered content is what issue persistence stores. | Draft |
| [US-01M2QXQ8](US-01M2QXQ8-validate-ai-editorial-against-immutable-facts.md) | Upstream | Validated AI copy enters the packet as optional editorial sections. | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Canonical facts and directives | Data | Foundation epic EP-01M2QXM7. |
| MJML rendering toolchain | Tooling | Present in package.json. |

---

## Estimation

**Points:** 5
**Complexity:** Medium

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/newsletter/issueData.js`, `editionData.js`, `renderNewsletter.js`, `renderBriefNewsletter.js`, `newsletterEmail.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| An issue rendered with a defect | Re-render and re-send the affected edition after fix; persistence keys prevent duplicate sends | < 1 job run |

---

## Resolved Questions

- Production requires explicit HTTPS `NEWSLETTER_UNSUBSCRIBE_URL` and `NEWSLETTER_PREFERENCES_URL`; missing
  configuration fails before send. Tests use `https://example.invalid/...` or omit footer links.
- Fallback copy is deterministic and fact-neutral; seasonal editorial review is an operational follow-up,
  not a reason for templates to invent values.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | Three Amigos refinement | Added football/Duke data-scope dependency, zero-value/URL safety decisions, and explicit production-link configuration. |
