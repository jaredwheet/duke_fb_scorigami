# EP-01M2QXFK: Newsletter Publishing and Delivery

> **Status:** Done
> **Created:** 2026-09-17
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Size:** XL

## Summary

Assemble the three recurring editions, render useful HTML, and deliver with durable issue and retry
state.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| PRD | Performance | Scheduled delivery runs every 15 minutes with a ten-minute timeout. | Issue assembly and delivery must remain bounded and retryable. |
| PRD | Security | Recipient addresses and Resend credentials are secrets. | Tests use a sink; no real recipients in fixtures or default commands. |
| TRD | Architecture | Newsletter modules consume canonical facts and persist delivery state in Supabase. | Keep data, rendering, persistence, and send boundaries explicit. |
| TSD | Quality | Every edition and fallback needs deterministic unit coverage plus boundary tests. | Missing sections and provider failure must be tested, not manually assumed. |

---

## Business Context

### Problem Statement

Recurring newsletters need edition-specific game context, historical facts, ACC information, and future
game details while scheduled retries avoid duplicate sends. [HIGH] Rendering and persistence are broadly
tested, but live Resend/Supabase behavior and sport scoping remain validation gaps.

**PRD Reference:** [Newsletter Editions and Delivery](../prd.md#newsletter-editions-and-delivery)

### Value Proposition

Readers receive a dependable weekly publication, and operators can retry a failed run without resending
a completed issue or losing the reason a delivery failed.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Edition cadence selection | Unit tested | All three windows select the correct edition | Time-zone boundary suite |
| Completed issue duplicate sends | Persistence guard exists | Zero completed-issue resends | Isolated delivery integration |
| Render failures on optional data | Fallback tests exist | No crash for missing optional sections | Render fixture matrix |
| Recipient safety in tests | Not centrally enforced | No default command contacts a real recipient | Transport sink and config gate |

---

## Scope

### In Scope

- Sunday Devil in the Details, Wednesday Wallace Wade Watercooler, and Friday Victory Bell Bulletin.
- Edition cadence, issue packet assembly, game/section persistence, HTML rendering, and Resend send.
- Delivery retry/completion state, fallback data, escaping, and test newsletter controls.
- Sport/team scoping and migration boundary validation for newsletter queries.

### Out of Scope

- New subscriber acquisition or marketing automation.
- A frontend preference center.
- New editorial AI capabilities beyond consuming validated issue packets.
- Live delivery tests without an explicitly authorized recipient sink.

### Affected Personas

- **Avery Brooks:** needs useful, timely, non-duplicated editions.
- **Taylor Morgan:** needs visible issue/delivery state and safe retries.
- **Jamie Carter:** needs edition scope and numeric claims grounded in facts.

---

## Acceptance Criteria (Epic Level)

- [ ] Each supported publication window selects the intended edition in Eastern time with deterministic boundary tests.
- [ ] An issue and its delivery records use atomic claim/complete/fail state and are idempotent across scheduled retries.
- [ ] Rendering remains valid with optional data absent, preserves zero values, and escapes controlled text/URLs.
- [ ] Every canonical newsletter query is scoped to football and Duke; production/test recipient configuration fails closed.

---

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| Canonical games/facts/directives | Data | Foundation epic | Rowan Patel |
| Resend and Supabase isolated boundary | Infrastructure | Local transport/database doubles available; live sink requires explicit authorization | Taylor Morgan |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| Newsletter scheduled workflow | Operational | It runs the production send command. |
| AI editorial epic | Feature | Validated copy is an optional input to issue sections. |

---

## Risks & Assumptions

### Assumptions

- Issue/date and issue/subscriber delivery keys are enforced in the deployed schema.
- CFBData remains authoritative for live schedule and score content.
- Resend is the intended production delivery provider.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Completed delivery is resent after a retry | Medium | High | Integration test state transitions and unique keys. |
| Newsletter query includes unintended sport | Medium | Medium | Add explicit sport/team filter requirement. |
| Missing optional provider data breaks render | Medium | Medium | Keep deterministic fallback fixtures for every edition. |
| Placeholder links ship to readers | Medium | Medium | Add content review or configuration acceptance criterion. |

---

## Technical Considerations

### Architecture Impact

Preserve the split between cadence/data modules, `newsletterPersistence.js`, rendering/MJML, AI
orchestration, and send entrypoints. Keep issue packets immutable after assembly where possible.

### Integration Points

Supabase canonical/newsletter tables, CFBData, optional Odds API, OpenAI editorial output, MJML, and
Resend. GitHub Actions supplies production inputs and secrets.

---

## Sizing

**Size:** XL

**Estimated Story Count:** 4

**Derived Point Total:** 19

_The point total is derived by reconcile after stories are created._

**Complexity Factors:**

- Three editions with different data contracts.
- Persistent issue/subscriber/delivery state and retry behavior.
- HTML safety and provider-boundary tests.

---

## Story Breakdown

<!-- Story links are maintained by artifact.py. -->
---
- [x] [US-01M2QX66: Select scheduled newsletter editions](../stories/US-01M2QX66-select-scheduled-newsletter-editions.md)
- [x] [US-01M2QX6F: Persist newsletter issues and deliveries idempotently](../stories/US-01M2QX6F-persist-newsletter-issues-and-deliveries-idempotently.md)
- [x] [US-01M2QXAG: Render fact-backed newsletter editions safely](../stories/US-01M2QXAG-render-fact-backed-newsletter-editions-safely.md)
- [x] [US-01M2QXFG: Separate test newsletter delivery from production recipients](../stories/US-01M2QXFG-separate-test-newsletter-delivery-from-production-recipients.md)

## Test Plan

Test specs will cover cadence, each edition data contract, persistence/idempotency, rendering safety,
and test/send entrypoint configuration.

---

## Resolved Questions

- No live recipient or Resend sink is approved for this epic. Default tests use a transport spy and isolated
  database; manual live smoke is separately authorized and never silently claimed green.
- Every canonical newsletter query scopes through `sports.slug = 'football'` and the exact persisted Duke
  team `teams.slug = 'duke'`; display-name matching is presentation-only.
- Production requires explicit HTTPS `NEWSLETTER_UNSUBSCRIBE_URL` and `NEWSLETTER_PREFERENCES_URL`; missing
  values fail before send. Local fixtures may use `https://example.invalid/...` or omit footer links.

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | SDLC Studio onboarding | Decomposed recurring editions, rendering, and delivery requirements into an epic. |
| 2026-09-17 | Three Amigos refinement | Chose atomic delivery claims, football/Duke query scope, fail-closed production URLs/recipients, and local-only automated transport evidence. |
