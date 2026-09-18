# Test Strategy Document

> **Project:** duke_fb_scorigami  
> **Version:** 1.0.0  
> **Last Updated:** 2026-09-17  
> **Owner:** Engineering and QA seats (to be generated)  
> **Status:** Draft (generated from the existing test suite; validation pending)

## Overview

The project is a Node.js 22 ES-module batch application that calculates deterministic Duke football
facts, calls external providers, persists state in Supabase, posts to X, and sends newsletters. The
current suite is a colocated Jest 30 unit suite. It provides useful coverage for pure calculations,
normalization, rendering, validation, and persistence contracts, but it does not yet prove live
Supabase migrations, provider integrations, GitHub Actions, or external delivery behavior.

This strategy preserves the existing fast unit suite, adds boundary-level tests around provider and
database contracts, and requires generated brownfield specifications to be validated against the real
implementation before they are marked Done.

## Test Objectives

- Prove deterministic score, fact, directive, cadence, and normalization behavior from concrete
  fixtures.
- Prove generated PRD/TRD requirements against the existing implementation rather than treating
  extracted documentation as truth.
- Protect idempotency for X posts, canonical ingestion, facts, newsletter issues, and deliveries.
- Verify that invalid or unavailable optional AI/provider output falls back without inventing numeric
  facts.
- Exercise migration and Supabase boundary contracts in an isolated test environment without sending
  real external messages.
- Keep `npm test` fast and reliable enough to run on every code change.

## Scope

### In Scope

- Pure score, game, team, fact, event, cadence, odds, win-expectancy, and formatting logic.
- Ingestion normalization and provider parsing contracts.
- Newsletter issue assembly, persistence decisions, HTML/MJML rendering, escaping, and fallback
  sections.
- AI packet construction, structured output validation, fallback editorial, and evidence rejection.
- Media-guide parsing, citation contracts, curated artifact validation, and preview output.
- Supabase migration shape, uniqueness/idempotency constraints, and repository/client boundary tests.
- GitHub Actions configuration checks and safe smoke execution with provider boundaries stubbed.
- Secret-safety and configuration validation.

### Out of Scope

- Sending real X posts or real emails from automated tests.
- Calling production Supabase, CFBData, X, Resend, OpenAI, or optional provider APIs in the default
  test command.
- Browser/UI E2E coverage until an actual frontend is implemented.
- Performance claims for provider infrastructure that cannot be measured locally.
- Proving provider availability or rate limits without a separately authorized live test.

---

## Test Levels

### Coverage Targets

| Level | Target | Rationale |
| ------- | -------- | ----------- |
| Unit | 90% of changed deterministic modules | Numeric and editorial guard logic is the highest-risk code. |
| Integration | 85% of persistence/provider adapters in scope | Mocks alone cannot prove schema and boundary behavior. |
| E2E | 100% of implemented operational workflows have a smoke scenario | There is no current UI; workflow paths are the user-visible surface. |

These are proposed gates. Current configuration does not enforce coverage thresholds, so baseline
coverage must be measured before converting the targets into blocking CI checks.

### Unit Testing

| Attribute | Value |
|-----------|-------|
| Coverage Target | 90% of changed deterministic modules |
| Framework | Jest 30 |
| Execution | `npm test`; individual files/selectors may be passed to Jest during development |
| Location | Colocated `src/**/*.test.js` files, matching current repository style |
| Boundary rule | Mock network, time, filesystem, and provider edges; do not mock the function under test |

Unit tests must cover happy paths, missing data, malformed provider data, duplicate identity, ordering,
date/time-zone boundaries, fallback paths, and every business rule that can change a numeric claim.

### Integration Testing

| Attribute | Value |
|-----------|-------|
| Scope | Supabase migrations/client contracts, repository persistence, provider adapters, and job composition |
| Framework | Jest 30 with isolated fixtures and controlled boundary doubles; Supabase test project/container when available |
| Execution | A separate integration command to be added; never part of the default live-send path |
| Data isolation | Per-test fixtures or disposable schema; no production data |
| Required first slices | Canonical upsert/idempotency, newsletter delivery state, legacy tweet uniqueness, migration order |

Integration tests must distinguish a provider failure from an assertion failure and must not silently
pass when the boundary was never called.

### End-to-End Testing

There is no frontend or inbound API, so browser E2E is not applicable to the current implementation.
The operational E2E surface is a smoke suite that invokes each entrypoint with provider clients stubbed
and verifies the expected persistence/publication intent:

- `node src/index.js` with a fake reference date and fixture schedule.
- `npm run ingest` with a fixture CFBData response.
- `npm run detect:facts` with canonical fixture rows.
- `npm run newsletter:test` with a fixture issue and test recipient sink.
- `npm run newsletter:send` with a delivery sink that records, but does not send, messages.
- Media-guide extraction/curation/preview commands against the checked-in artifact.

### Operational Feature Coverage Matrix

| Feature Area | Existing Spec Files | Current Status | Validation Gap |
|--------------|---------------------|----------------|----------------|
| Score and Scorigami rules | `src/gameUtils.test.js`, `src/facts/scoreFacts.test.js`, `src/scorigamiCard.test.js` | Unit covered | Supabase historical query integration |
| Facts and directives | `src/facts/*.test.js`, `src/eventDetector.test.js` | Unit covered | Full canonical schema and rerun behavior |
| Ingestion | `src/ingestion/normalize.test.js`, provider tests | Unit/parser covered | Multi-table persistence and rollback |
| Newsletter data/rendering | `src/newsletter/*.test.js` | Broad unit covered | Resend and production Supabase boundary |
| AI editorial | `src/ai/orchestrator.test.js` | Fallback/merge covered | Live schema/provider and adversarial content cases |
| Media guide | `src/mediaGuide/mediaGuide.test.js` | Artifact contract covered | Import migration and path-independent execution |
| X workflow | Utility/card tests only | Partial | Full job with idempotency and provider sink |
| GitHub Actions | None | Missing | YAML/config and hosted smoke validation |

### API Contract Testing

There is no inbound application API. Provider contract tests must validate the request shape and the
normalized response shape at each outbound adapter. Supabase repository contract tests must validate
the selected columns, unique-key behavior, and error propagation against an isolated schema or a
faithful test double. A mocked response alone is not sufficient evidence that the repository's actual
query or migration contract works.

### Performance Testing

| Attribute | Value |
|-----------|-------|
| Scope | Ingestion and fact refresh over representative season/history sizes; newsletter render duration |
| Framework | Node/Jest timing for baseline; a separate load tool only if volume requires it |
| Target | Establish baseline first; operational jobs must remain below ten-minute Actions timeout |
| Data | Synthetic and sanitized checked-in fixtures; no production secret/data dump |

Performance tests are not currently implemented. Pagination beyond 500 rows and duplicate-safe reruns
are priority probes before tuning.

### Security Testing

| Attribute | Value |
|-----------|-------|
| Scope | Secret handling, server-only Supabase credentials, RLS/migration behavior, unsafe external/AI text, HTML escaping |
| Tools | Jest assertions, dependency audit, migration checks, static secret scan, GitHub Actions review |
| Blocking cases | Any committed credential, service-role exposure in client-facing code, unescaped email content, or unsupported numeric claim |
| Environment | Isolated test project or local database; no production writes |

---

## Test Environments

| Environment | Purpose | URL | Data |
|-------------|---------|-----|------|
| Local unit | Fast deterministic regression | None | Fixtures and mocks |
| Local integration | Persistence/provider boundary tests | Local or isolated Supabase endpoint | Disposable seeded data |
| GitHub pull request | Required quality gate to be added | Actions runner | Sanitized fixtures and no live side effects |
| GitHub manual smoke | Authorized boundary verification | Actions runner | Explicit test recipient and isolated provider/database configuration |
| Production schedules | Actual X/newsletter/ingestion jobs | Managed providers | Production data and secrets; never used by default tests |

## Test Data Strategy

### Approach

- Use small explicit fixtures for score pairs, game orientation, historical occurrences, dates near
  cadence boundaries, provider responses, fact packets, and newsletter sections.
- Use factory helpers for combinations such as home/away score orientation and duplicate delivery
  states; keep fixed JSON fixtures for provider contract payloads.
- Include malformed, incomplete, duplicate, empty, paginated, and out-of-order provider responses.
- Include at least one fixture for every fallback branch: missing OpenAI, invalid editorial output,
  failed image edit, failed image upload, unavailable odds, and empty optional sections.
- Never use a real recipient address, provider token, tweet ID, or production Supabase row in tests.

### Sensitive Data

Secrets are supplied only through the test runner environment or CI secret store and must not be
written to snapshots, logs, fixtures, artifacts, or error messages. Test recipients must be explicit
sink addresses or a fake transport. Any production-like data must be minimized and sanitized.

---

## Automation Strategy

### Automation Candidates

- Every PRD acceptance criterion that describes deterministic behavior.
- Score normalization, historical identity, fact priority, and late-game safeguard rules.
- Idempotent ingestion, fact refresh, issue creation, and delivery state transitions.
- Newsletter cadence and rendering for all three editions.
- AI validator rejection of unsupported numbers and fallback behavior.
- Media-guide citation and season-preview contracts.
- YAML workflow invariants: Node 22, `npm ci`, timeout, concurrency, required secret names, and
  command targets.

### Manual Testing

- Human review of newsletter voice, visual output, and source-backed editorial relevance.
- Authorized test newsletter delivery to a controlled recipient.
- Authorized X test/private workflow verification without accidental public posts.
- Supabase migration review and RLS policy review by the owner of the database environment.
- Hosted GitHub Actions schedule and secret configuration verification.

### Automation Framework Stack

| Layer | Tool | Language |
|-------|------|----------|
| Operational smoke | Jest plus command-level fixtures | JavaScript |
| Provider contract | Jest and adapter doubles | JavaScript |
| Persistence integration | Jest plus isolated Supabase/Postgres environment | JavaScript/SQL |
| Unit | Jest 30 | JavaScript |
| Coverage | To be selected; Jest coverage output is the likely first option | JavaScript |

---

## CI/CD Integration

### Current Pipeline Stages

1. Scheduled/manual operational workflows run `npm ci` and a single job script.
2. No dedicated pull-request `npm test` workflow was found [HIGH].
3. No coverage, migration, security, or workflow-lint gate is currently evidenced [HIGH].

### Required Quality Gates

| Gate | Criteria | Blocking |
|------|----------|----------|
| Unit suite | `npm test` passes | Yes for code changes |
| Generated-spec validation | Every claimed executable AC has a passing test against current code | Yes before generated specs become Done |
| Integration contracts | Isolated persistence/provider contract suite passes | Yes for boundary/schema changes |
| Workflow configuration | YAML and command/secret invariants pass | Yes for workflow changes |
| Security scan | No committed secrets; service-role stays server-only | Yes |
| Coverage | Proposed thresholds met after a baseline is measured | Not yet; establish baseline first |
| Live smoke | Authorized provider test passes without unintended side effect | Manual/release-specific |

### Test Commands

- Default: `npm test`
- Focused Jest test: `npm test -- --runInBand <path-or-selector>`
- Operational scripts are not part of the default test command because they contact live services.

---

## Defect Management

### Severity Definitions

| Severity | Definition | SLA |
|----------|------------|-----|
| Critical | Credential exposure, duplicate public/email blast, data loss, or incorrect numeric claim at scale | Stop ship; immediate triage |
| High | Major publishing or canonical data path broken with no safe workaround | Fix before release |
| Medium | Feature impaired, boundary gap, or recoverable delivery issue | Schedule in next delivery batch |
| Low | Documentation mismatch, minor rendering issue, or cleanup | Backlog |

Any test failure during generated-spec validation must be classified as either a specification defect
or an implementation bug. Do not mark a generated artifact Done while its verification remains red or
unrun.

## Brownfield Validation Plan

1. Run `npm test` and record the baseline result without changing user worktree modifications.
2. Map each PRD feature acceptance criterion to an existing test or a new test specification.
3. Add missing unit tests for observable behavior before writing implementation changes.
4. Add isolated integration tests for Supabase migrations, uniqueness, and delivery state.
5. Add command-level smoke tests with all external side effects sunk or stubbed.
6. Run the acceptance-criteria verifier against the real code and record failures as spec corrections
   or bugs.
7. Reconcile artifact indexes and require independent review before treating the generated backlog as
   trusted.

## Related Specifications

- [Product Requirements Document](prd.md)
- [Technical Requirements Document](trd.md)
- [User Personas](personas.md)

## Tools & Infrastructure

| Purpose | Tool |
|---------|------|
| Test management | SDLC Studio test-spec artifacts |
| CI/CD | GitHub Actions |
| Unit/integration runner | Jest 30 |
| Coverage | Not currently configured; establish Jest coverage baseline |
| Database test environment | Isolated Supabase/Postgres environment to be selected |

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-09-17 | SDLC Studio onboarding | Generated test strategy from current Jest suite, workflows, integrations, and brownfield validation requirements. |
