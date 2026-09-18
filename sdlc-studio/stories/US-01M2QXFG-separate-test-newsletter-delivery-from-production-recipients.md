# US-01M2QXFG: Separate test newsletter delivery from production recipients

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Affects:** src/newsletter/sendNewsletter.js, src/newsletter/sendTestNewsletter.js, src/newsletter/sendNewsletter.test.js, .github/workflows/newsletter.yml, .github/workflows/newsletter-test.yml, README.md
> **Epic:** EP-01M2QXFK
> **Points:** 3
> **Persona:** Taylor Morgan

## User Story

**As a** Taylor Morgan
**I want** manual test delivery to use an explicit test recipient and the default test suite to never contact a real recipient
**So that** no workflow or test can silently email production subscribers.

## Context

### Persona Reference

**Taylor Morgan** - publishing operator, accountable for safe scheduled delivery and recovery; veto line: no workflow that can send to a real recipient from the default test suite, and manual tests must never surprise a public recipient.
[Full persona details](../personas/stakeholders/taylor-morgan.md)

### Background

`src/newsletter/sendNewsletter.js` requires `NEWSLETTER_TO` for production and
`src/newsletter/sendTestNewsletter.js` requires `NEWSLETTER_TEST_TO` as the manual test entrypoint (`npm run newsletter:test`), driven
by `.github/workflows/newsletter-test.yml`; production delivery runs via
`.github/workflows/newsletter.yml`. PRD FR-010 and the epic success metrics require test delivery to use
explicit test configuration with no silent fall-through to production recipients. This story pins the
recipient separation and the no-real-request test guarantee.

---

## Inherited Constraints

> See Epic for full constraint chain. Key constraints for this story:

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Security | Recipient addresses and Resend credentials are secrets; tests use a sink. | AC3 requires the default suite to make no real Resend request. |
| PRD | Security | Secrets injected through GitHub Actions and never committed to source. | Workflow changes only reference secret names; no values in files. |
| PRD | Operator controls | FR-010: manual newsletter testing accepts edition and test-date inputs. | AC1 encodes the manual workflow's input contract. |

---

## Acceptance Criteria

### AC1: Manual test workflow uses the test recipient

- **Given** the manual newsletter-test workflow selects an edition and optional date,
- **When** it runs,
- **Then** it uses the test recipient and does not use the production subscriber send path.
- **Verify:** shell npm test -- --runInBand -t "test newsletter recipient"
- **Caller:** `.github/workflows/newsletter-test.yml` -> `npm run newsletter:test` (src/newsletter/sendTestNewsletter.js)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC2: Test fallback when production recipient is absent

- **Given** production `NEWSLETTER_TO` is absent,
- **When** automated delivery resolves its recipient,
- **Then** it fails closed before constructing a transport; only the test entrypoint may use `NEWSLETTER_TEST_TO`.
- **Verify:** shell npm test -- --runInBand -t "production recipient required"
- **Caller:** `npm run newsletter:send` (src/newsletter/sendNewsletter.js recipient resolution)
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC3: Default suite never contacts a real recipient

- **Given** the default Jest suite runs,
- **When** newsletter sending code is tested,
- **Then** no real Resend request or recipient delivery is attempted.
- **Verify:** shell npm test -- --runInBand -t "newsletter transport guard"
- **Caller:** `npm test` (Jest suite) and `.github/workflows/newsletter-test.yml` with the controlled sink
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

### AC4: Missing configuration fails closed

- **Given** the recipient or Resend key is absent,
- **When** either newsletter entrypoint initializes,
- **Then** it fails before constructing a transport or making a network request.
- **Verify:** shell npm test -- --runInBand -t "newsletter configuration"
- **Caller:** `npm run newsletter:send` and `npm run newsletter:test`
- **Verification target:** functional
- **Mutation-checked:** not performed
- **Verified:** yes (2026-09-18)

---

## Scope

### In Scope

- Test recipient resolution in `sendTestNewsletter.js` and fail-closed production recipient resolution in `sendNewsletter.js`.
- `newsletter-test.yml` inputs (edition, optional test date) and secret wiring for `NEWSLETTER_TEST_TO`/`RESEND_API_KEY`.
- Guarding the default Jest suite against real Resend/recipient contact.
- Manual controlled-sink run proving no production recipient is used.

### Out of Scope

- Production subscriber management or multi-recipient fan-out.
- New delivery providers.
- Test sink infrastructure beyond what is already available.
- Edition content and rendering changes (US-01M2QXAG).

---

## Technical Notes

Recipient resolution must stay an explicit config read with a documented separation: test workflow sets
the test recipient; production workflow requires the production recipient and never falls back. The Jest suite must mock the
Resend transport (or use a sink seam) so `npm test` performs zero network requests; a test that
accidentally constructs a real `Resend` client with a real key is a failure. AC3's manual step runs the
test workflow against the controlled sink and records that the resolved recipient is the test one.

### API Contracts

No inbound API. Internal contracts: `src/newsletter/sendTestNewsletter.js` (entrypoint
`npm run newsletter:test`), `src/newsletter/sendNewsletter.js` (entrypoint `npm run newsletter:send`)
with separate recipient contracts: production requires `NEWSLETTER_TO`, while the test entrypoint requires
`NEWSLETTER_TEST_TO`; neither entrypoint falls back to the other. Workflow contracts:
`.github/workflows/newsletter-test.yml` (manual, edition + date inputs) and
`.github/workflows/newsletter.yml` (production schedule).

### Data Requirements

- `NEWSLETTER_TO`, `NEWSLETTER_TEST_TO`, and `RESEND_API_KEY` available as repository secrets; no values committed.
- A local transport spy for automated tests; no live sink is assumed.
- Edition/date inputs validated before any send.

---

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| `NEWSLETTER_TO` set and `NEWSLETTER_TEST_TO` set | Production send uses `NEWSLETTER_TO`; the test workflow uses `NEWSLETTER_TEST_TO`; neither crosses. |
| `NEWSLETTER_TO` absent, `NEWSLETTER_TEST_TO` present | Production delivery fails before transport construction; only the test entrypoint may send to the test recipient. |
| Both recipient variables absent | Send refuses with a clear configuration error before any network call. |
| `RESEND_API_KEY` absent | Send refuses with the explicit key-required error. |
| Jest suite with a real Resend client injected by mistake | Transport mock ensures no network call; test fails loudly if a real request is attempted. |
| Manual test workflow run with an invalid edition | Input validation fails before sending. |
| Test workflow and production workflow overlap in time | Concurrency group configuration keeps them independent; persistence keys prevent duplicate deliveries (US-01M2QX6F). |

---

## Test Scenarios

- [ ] Manual test entrypoint resolves only the test recipient for a selected edition/date (jest "test newsletter recipient").
- [ ] Production entrypoint refuses to fall back to `NEWSLETTER_TEST_TO` (jest "production recipient required").
- [ ] Assert the default Jest suite performs zero Resend network requests (jest "newsletter transport guard").
- [ ] Configuration-error tests for missing recipient/key (jest "newsletter configuration").

---

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US-01M2QX6F](US-01M2QX6F-persist-newsletter-issues-and-deliveries-idempotently.md) | Upstream | Claim/completion verbs the test and production send paths both use. | Draft |
| [US-01M2QXAG](US-01M2QXAG-render-fact-backed-newsletter-editions-safely.md) | Upstream | A rendered issue is what the test send delivers. | Draft |
| [US-01M2QX66](US-01M2QX66-select-scheduled-newsletter-editions.md) | Upstream | Edition selection validates the manual workflow's edition input. | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Repository secrets (`NEWSLETTER_TEST_TO`, `RESEND_API_KEY`) | Infrastructure | Available via GitHub Actions secrets. |
| Approved recipient/provider sink | Infrastructure | None approved; automated transport spy is the default evidence. |

---

## Estimation

**Points:** 3
**Complexity:** Low

---

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| `src/newsletter/sendNewsletter.js`, `src/newsletter/sendTestNewsletter.js` | `git revert` the story commit and re-run `npm test` | < 15 min |
| `newsletter.yml` / `newsletter-test.yml` | `git revert`; next scheduled/manual run uses previous wiring | < 15 min |

---

## Resolved Questions

- No live recipient or provider sink is approved for this epic; local transport guards are the required
  automated evidence and live smoke remains explicit operator work.
- Production delivery refuses to run without `NEWSLETTER_TO`; it never falls back to `NEWSLETTER_TEST_TO`.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | sdlc-studio brownfield fill | Materialized canonical AC/Verify lines from sdlc-studio/.local/init-guided-stories.json and grounded sections in current code. |
| 2026-09-17 | Three Amigos refinement | Removed production-to-test recipient fallback, replaced live sink AC with transport guards, and resolved missing-config behavior. |
| 2026-09-18 | Independent review repair | Aligned the API contract and README with fail-closed production/test recipient separation. |
