# Technical Requirements Document

**Project:** duke_fb_scorigami  
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2026-09-17  
**PRD Reference:** [PRD](prd.md)  
**Mode:** Generate (brownfield architecture extraction; validation pending)

> This document describes the architecture present in the repository. It is an assessment of the
> current system, not approval of every existing design choice. Confidence markers identify source
> evidence versus inference.

---

## 1. Executive Summary

### Purpose

Capture the technical architecture required to ingest Duke football data, persist canonical sports
records and publication state, calculate deterministic facts, publish X updates, and deliver
newsletters through short-lived scheduled and manual Node.js jobs.

### Scope

In scope: source modules, runtime commands, GitHub Actions, Supabase migrations and persistence
boundaries, external integrations, media-guide artifacts, AI editorial validation, tests, security
controls, and operational constraints. Out of scope: a frontend or public API, neither of which was
found in the current repository [HIGH], and provider-side infrastructure outside the configured
services.

### Key Decisions Observed

- [HIGH] Use Node.js 22 ES modules and Jest 30 across all batch workflows.
- [HIGH] Use Supabase/Postgres for legacy and canonical persistence, with idempotent keys and a
  migration path from legacy Duke tables.
- [HIGH] Keep numeric sports facts code-generated; use AI only for constrained editorial wording
  after validation.
- [HIGH] Run operational batches through GitHub Actions rather than a long-running service.

---

## 2. Project Classification

**Project Type:** `desktop_application` (batch/CLI application)

**Classification Rationale:** The repository exposes executable Node scripts and package commands,
does not expose an active inbound API or frontend, and is invoked by GitHub Actions and operators
rather than by a browser or mobile client [HIGH].

**Architecture Implications:**

- **Default Pattern:** Layered or clean architecture for a CLI/batch application.
- **Pattern Used:** Hybrid modular monolith: domain modules run as short-lived jobs under GitHub
  Actions; external services and Supabase provide the system boundaries [HIGH].
- **Deviation Rationale:** A single repository and shared data model keep the current publishing
  product small and operationally simple. The code is separated by domain (`facts`, `ingestion`,
  `newsletter`, `ai`, `mediaGuide`) without independently deployable services [HIGH].

---

## 3. Architecture Overview

### System Context

GitHub Actions starts one of the operational Node jobs. A job reads configuration and provider data,
normalizes or selects canonical records in Supabase, calculates deterministic facts, optionally asks
OpenAI for constrained wording or image edits, and writes to X or Resend. Operators can run the same
commands locally with `.env` values and test date/backfill controls. The media guide is a versioned
local reference artifact with an optional claims import path.

### Architecture Pattern

`hybrid modular monolith`

**Rationale:** The implementation is one Node.js repository with internal domain modules and several
batch entrypoints. Scheduling is externalized to GitHub Actions, persistence is managed by Supabase,
and provider calls are synchronous request/response integrations. There is no service mesh, message
queue, or independently deployable application [HIGH].

### Component Overview

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| X workflow | Pregame, live, final, and recent-game recovery processing | `src/index.js`, Node.js 22 |
| Game/provider adapters | Fetch schedules, venues, stats, historical data, and optional enrichments | CFBData, Winsipedia, Axios/fetch |
| Legacy persistence | Store Duke games and X publication metadata | Supabase tables `duke_football_games`, `tweeted_scores` |
| Canonical ingestion | Normalize provider payloads and upsert sport/team/game/source/analytics rows | `src/ingestion/`, Supabase/Postgres |
| Fact engine | Calculate verified score and narrative facts and editorial directives | `src/facts/`, `src/eventDetector.js` |
| Newsletter data | Build edition-specific issue packets and persist issue state | `src/newsletter/`, Supabase/Postgres |
| AI editorial layer | Generate and validate structured prose; discover optional moments | `src/ai/`, OpenAI |
| Newsletter renderer/delivery | Render MJML/HTML and send email | MJML, Resend |
| Media-guide pipeline | Extract, curate, load, preview, and import cited claims | PDF parser, JSON, Supabase |
| GitHub Actions | Schedule, dispatch, inject secrets, and bound jobs | Actions, Node 22 runners |

### Data Flow

1. CFBData and optional provider adapters return source payloads.
2. Ingestion normalizes stable sport, team, game, participant, source, and analytics identities.
3. Supabase stores canonical records; fact refresh reads them and upserts deterministic facts and
   directives.
4. X and newsletter paths assemble verified data and issue packets.
5. Optional AI produces structured language, which the validator checks against the packet.
6. X or Resend performs the external side effect; delivery state is persisted for retry/idempotency.

---

## 4. Technology Stack

### Core Technologies

| Category | Technology | Version | Rationale |
| ---------- | ----------- | --------- | ----------- |
| Language | JavaScript ES modules | Node 22 runtime | Existing repository and workflow runtime [HIGH] |
| Test framework | Jest | 30.x | Existing test scripts and focused unit suite [HIGH] |
| Database | Supabase/Postgres | Managed/current project version | SQL relationships, JSON payloads, constraints, and managed access [HIGH] |
| Job orchestration | GitHub Actions | `actions/checkout@v5`, `actions/setup-node@v5` | Existing schedule/manual execution and secret injection [HIGH] |
| Email rendering | MJML | `package.json` range | Responsive email templates and HTML generation [HIGH] |
| Email delivery | Resend | `package.json` range | Existing newsletter send path [HIGH] |
| X client | `twitter-api-v2` | `package.json` range | Existing text/media publication path [HIGH] |
| AI client | OpenAI | `package.json` range | Optional editorial/image/moment provider [HIGH] |
| Image processing | Sharp/Puppeteer | `package.json` ranges | Deterministic cards and image support [HIGH] |

### Build & Development

| Tool | Purpose |
|------|---------|
| `npm ci` | Reproducible dependency installation in local and hosted jobs |
| `npm test` | Run the Jest suite |
| `node src/index.js` | Run the legacy X workflow |
| `npm run ingest` | Run canonical ingestion |
| `npm run detect:facts` | Recalculate deterministic facts/directives |
| `npm run newsletter:test` | Send a configured test newsletter |
| `npm run newsletter:send` | Send the scheduled newsletter path |
| `npm run extract:guide` | Extract PDF text to ignored generated output |
| `npm run curate:guide` | Validate/curate the media-guide artifact |
| `npm run guide:preview` | Print the season-preview contract |
| `npm run import:guide` | Import guide claims after the migration is applied |

There is no separate compile or build step [HIGH]. Jest uses `transform: {}` and `dotenv/config` in
`jest.config.js` [HIGH].

### Infrastructure Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Job runner | GitHub Actions | Scheduled/manual execution |
| Database | Supabase | Managed Postgres and service-role access |
| Sports source | College Football Data | Schedules and game data |
| Social network | X | Public score publications |
| Email provider | Resend | Newsletter delivery |
| Model provider | OpenAI | Optional editorial and image assistance |

---

## 5. API Contracts

### API Style

No inbound REST, GraphQL, gRPC, or WebSocket API is implemented [HIGH]. The application makes
outbound REST/HTTP requests to providers and invokes Supabase client operations. Package dependency
on Express is not evidence of an active server and should be reconciled [MEDIUM].

### Authentication

Outbound provider API keys and OAuth-style X credentials are supplied through environment variables.
Supabase uses a project URL plus server-only service-role key. There is no application-user session or
JWT authorization layer in the repository [HIGH].

### Outbound Operations Overview

| Operation | Boundary | Description | Auth |
|-----------|----------|-------------|------|
| Schedule/game requests | CFBData client | Current schedule, game, venue, stats, and related data | `CFB_DATA_KEY` |
| Historical requests | Winsipedia client | Historical schedule/enrichment data | Provider configuration |
| Canonical queries/upserts | Supabase client | Persist and retrieve data, facts, directives, issues, and deliveries | `SUPABASE_URL` + service role |
| Text/media post | X client | Publish text, upload image, and publish media post | Four X credentials |
| Newsletter send | Resend client | Send rendered HTML issue | `RESEND_API_KEY` |
| Editorial/image request | OpenAI client | Generate constrained copy or image edit | `OPENAI_API_KEY` |

### Error Response Format

There is no shared inbound HTTP error envelope. Provider and Supabase errors are generally thrown or
returned to the batch caller; workflow failure is the operational error signal [HIGH]. Each boundary
must preserve the original error context and avoid converting unavailable data into verified facts.

---

## 6. Data Architecture

### Data Models

#### Legacy Duke Games and Tweet State

| Field/Concept | Type | Constraints | Description |
|---------------|------|-------------|-------------|
| Game date/season/week | Date/integer | Existing legacy schema | Identifies the historical game |
| Duke/opponent scores | Numeric | Score-pair comparison | Supports Scorigami and prior occurrence lookup |
| Team objects | JSON/object | Legacy shape | Stores team identity and rating context |
| `tweeted_scores` game/score key | Text | Unique publication identity | Prevents repeated pregame/live/final work |
| Tweet metadata | Text/null | Provider identifiers | Tweet ID, URL, content type, template version |

#### Canonical Sports Publishing

| Model | Key identity | Purpose |
|-------|--------------|---------|
| `sports` | Sport slug | Root sport classification; football is seeded |
| `teams` | Sport/slug | Stable team identity and provider mapping |
| `games` | Sport/canonical game key | Canonical schedule and result |
| `game_participants` | Game/role/team | Home, away, and participant metadata |
| `game_source_records` | Provider/external ID | Raw or normalized source evidence |
| `game_analytics` | Game/analytics key | Enrichment and analytical records |
| `game_facts` | Game/fact key/logic version | Deterministic verified facts |
| `editorial_directives` | Game/directive identity | Prioritized fact-backed editorial instructions |

#### Newsletter and Reference Claims

| Model | Purpose |
|-------|---------|
| `newsletter_subscribers` / `subscriber_preferences` | Recipient and edition preferences |
| `newsletter_issues` | Edition/date issue identity and lifecycle |
| `newsletter_issue_games` | Games selected for an issue |
| `newsletter_deliveries` | Subscriber send state, attempts, and failures |
| `media_guide_editions` | Versioned guide metadata |
| `media_guide_claims` | Citation-backed claim text, page, hash, and verification state |

### Storage Strategy

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| Current and historical sports data | Supabase/Postgres | Relational identity, joins, indexes, and managed persistence |
| Provider source payloads | Canonical source-record tables | Traceability and repeatable normalization |
| Delivery state | Supabase/Postgres | Retry and duplicate protection across short-lived jobs |
| Media-guide source | Versioned repository PDF/JSON | Human-reviewed, reproducible editorial reference |
| Generated PDF text | `data/generated/` | Local derived extraction; intentionally ignored |
| Local configuration | Ignored `.env` | Secret injection without committing values |

### Migrations

SQL migrations under `supabase/migrations/` add post metadata, canonical sports publishing tables,
legacy backfill, and media-guide claims. The legacy post-metadata migration assumes legacy base tables
already exist [HIGH]. Migration application order and clean-install ownership must be resolved before
the persistence layer can be reproduced from an empty Supabase project.

---

## 7. Integration Patterns

### External Services

| Service | Purpose | Protocol | Auth |
|---------|---------|----------|------|
| College Football Data | Schedule, scores, venues, stats, plays, lines, records, rankings | HTTPS REST | API key |
| Winsipedia | Historical schedule/context | HTTPS/web parsing | Provider endpoint/config |
| SportsDataverse | Optional enrichment | HTTPS | Optional API key |
| Visual Crossing | Optional weather/context | HTTPS | Optional API key |
| The Odds API | Optional odds fallback | HTTPS | Optional API key |
| Supabase | Persistence and queries | HTTPS client/Postgres API | Service-role key |
| X | Posts and media upload | HTTPS API | X credentials |
| Resend | Email delivery | HTTPS API | API key |
| OpenAI | Editorial/image/moment assistance | HTTPS API | Optional API key |

### Event Architecture

There is no message queue or event bus. Time-based GitHub Actions triggers start batches, and
Supabase rows are the durable coordination mechanism. The canonical ingestion workflow explicitly
runs fact detection after ingestion. X and newsletter workflows use separate non-canceling concurrency
groups [HIGH].

### Retry and Fallback Patterns

- X checks persisted publication state before side effects; database uniqueness is the final duplicate
  defense [HIGH].
- Newsletter persistence records delivery attempts and prevents completed resend [HIGH].
- AI, image, odds, and optional enrichment paths fall back where implemented [HIGH].
- Provider retry limits and a global backoff policy are not documented [MEDIUM].

---

## 8. Infrastructure

### Deployment Topology

There is no long-running application deployment. GitHub-hosted Ubuntu runners check out the repository,
install Node dependencies, inject repository secrets, and run one batch command. Supabase, X, Resend,
and other providers are external managed services [HIGH].

### Environment Strategy

| Environment | Purpose | Characteristics |
|-------------|---------|-----------------|
| Local | Development and focused tests | `.env`, Jest mocks/fixtures, optional `FAKE_DATE`; live scripts can contact providers |
| GitHub Actions manual | Ingestion and newsletter testing | Explicit workflow inputs and repository secrets |
| GitHub Actions scheduled | Production X and newsletter delivery | 15-minute cron, Node 22, `npm ci`, ten-minute timeout, non-canceling concurrency |
| Supabase production | Durable data and delivery state | Required migrations and server-only service-role access |

No separate staging environment, preview deployment, or container image was found [HIGH].

### Scaling Strategy

Scale is primarily bounded by GitHub Actions job duration, provider rate limits, Supabase query volume,
and the size of the historical/canonical dataset. Stable keys and pagination support repeat processing.
The implementation does not currently define horizontal worker scaling, distributed locks, a queue, or
transactional batch boundaries [MEDIUM].

---

## 9. Security Considerations

### Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Provider secret committed to source | Medium | High | `.env` ignored; Actions repository secrets; agent instructions prohibit commits |
| Service-role key exposed to client | Low in current batch topology | Critical | No client app found; server-only import boundary |
| Unsupported AI number published | Medium | High | Immutable fact packet and editorial validator |
| Untrusted external source treated as fact | Medium | High | Moment evidence remains untrusted until validation |
| Duplicate X/email side effect on retry | Medium | Medium/High | Persisted keys, unique constraints, completed-delivery checks |
| RLS misconfiguration exposes data | Unknown | High | RLS enabled; policies and public access require explicit review |
| Partial ingestion leaves inconsistent graph | Medium | Medium | Stable upserts; full transaction boundary remains a review item |
| Provider outage blocks schedule | Medium | Medium | Optional-service fallbacks; no universal outage policy documented |

### Security Controls

| Control | Implementation |
|---------|----------------|
| Authentication | API keys and X credentials from environment/Actions secrets |
| Authorisation | Supabase service-role server path; RLS enabled in inspected migrations; public policies unresolved |
| Encryption at rest | Managed provider responsibility; not configured in repository |
| Encryption in transit | HTTPS provider clients and Supabase API |
| Secret logging | No intentional secret logging found; live execution must still be monitored |
| Input/output validation | Deterministic schemas and editorial validation before publication |

---

## 10. Performance Requirements

### Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Workflow completion | Under 10 minutes | GitHub Actions job timeout and run duration |
| Schedule freshness | Run every 15 minutes | GitHub Actions cron history |
| Newsletter duplicate delivery | Zero completed-issue resends | `newsletter_deliveries` and provider audit |
| X duplicate publication | Zero duplicate identity keys | `tweeted_scores`, unique constraints, X audit |
| Provider throughput | Not specified | Must be established from observed provider limits |
| Availability | Not specified | Must be established with delivery monitoring |

No formal p50/p95 response-time or volume targets exist because this is a batch system rather than an
inbound request service [MEDIUM].

---

## 11. Architecture Assessment

**Detected Pattern:** Hybrid modular monolith with scheduled batch execution.  
**Detected Project Type:** Desktop/CLI batch application.

### Alignment with Best Practices

| Aspect | Finding | Status |
|--------|---------|--------|
| Pattern matches project type | Short-lived scripts fit a low-volume scheduled publisher and avoid unnecessary service decomposition. | Good |
| Clear layer separation | Domain directories exist for ingestion, facts, newsletter, AI, media guide, and provider adapters. | Good |
| API standards | No inbound API contract is needed for the current surface; Express dependency and README UI claim are unresolved. | Warning |
| Database choice | Supabase/Postgres fits relational games, facts, and delivery state. | Good |
| Idempotency | Canonical and newsletter paths have stable identities; legacy X check/insert is not atomic. | Warning |
| Security boundary | Server-only service-role usage and secret injection are appropriate; RLS policy intent is undocumented. | Warning |
| Testability | Focused unit tests cover deterministic modules; live boundaries and workflows are untested. | Warning |
| Deployment simplicity | Actions plus managed services match the batch topology. | Good |

### Architecture Smells

| Smell | Found | Notes |
|-------|-------|-------|
| Big Ball of Mud | No | Root is organized into domain directories; no evidence of an unlayered root sprawl. |
| Distributed Monolith | No | No independently deployable service fleet was found. |
| Hardcoded Secrets | No evidence | Secrets are environment-driven; this must remain a release gate. |
| Missing Error Handling | Warning | Error paths exist, but there is no unified provider retry/error contract. |
| Circular Dependencies | Not established | Requires static dependency analysis before asserting absence. |
| God Object | No clear instance | `src/index.js` is a workflow coordinator but is under 1,000 lines. |
| Missing Transaction Boundary | Yes | Ingestion can leave partial related writes after a failure. |
| Legacy Schema Ownership | Yes | Post-metadata migration assumes base tables outside the checked-in migration set. |
| Documentation Mismatch | Yes | README advertises an interactive interface not located in source. |

### Recommendations

1. [REVIEW] Define and test an atomic claim/insert strategy for legacy X publication state before
   relying on concurrent scheduled invocations.
2. [REVIEW] Document or enforce the clean-install Supabase migration order, including ownership of
   legacy base tables and RLS policies.
3. [REVIEW] Add a dedicated pull-request `npm test` workflow and a safe integration-test environment
   for migration/provider boundaries.
4. [INFO] Add explicit sport/team filters to newsletter queries before expanding canonical data beyond
   Duke football.
5. [INFO] Decide whether to remove stale UI claims and unused dependencies or restore the intended
   interface.
6. [INFO] Establish future media-guide versioning and avoid current-working-directory assumptions in
   source hashing.

---

## 12. Architecture Decision Records

### ADR-001: Retain a Modular Node Batch Application

**Status:** Accepted (observed)  
**Context:** The product runs scheduled and manually triggered data/publication jobs with modest
volume and a shared data model.  
**Decision:** Keep one Node.js repository with explicit domain modules and short-lived GitHub Actions
jobs rather than splitting into independently deployed services.  
**Consequences:** Lower operational complexity and shared contracts; jobs share release and dependency
risk, and domain boundaries must be preserved by convention.

### ADR-002: Use Supabase/Postgres as Durable State

**Status:** Accepted (observed)  
**Context:** Games, participants, facts, directives, subscribers, issues, and deliveries require
relational identity, constraints, and retry state.  
**Decision:** Use Supabase/Postgres for canonical and publication state while retaining a compatibility
path for legacy Duke tables.  
**Consequences:** Strong query and uniqueness support; migration order, RLS policies, and legacy schema
ownership must be made reproducible.

### ADR-003: Keep Numeric Truth Deterministic

**Status:** Accepted (observed)  
**Context:** AI-generated sports statistics can be plausible but unsupported.  
**Decision:** Calculate canonical numeric facts in code, pass them in immutable packets, and use AI only
for structured editorial wording after validation.  
**Consequences:** More reliable claims and deterministic fallback; editorial quality depends on packet
completeness and validator coverage.

### ADR-004: Use GitHub Actions for Scheduling

**Status:** Accepted (observed)  
**Context:** X and newsletter jobs need periodic execution but not a continuously running server.  
**Decision:** Run Node commands on 15-minute GitHub Actions schedules plus manual dispatches.  
**Consequences:** Simple deployment and secret injection; provider rate limits, job duration, missed
cron behavior, and workflow observability are operational concerns.

### ADR-005: Preserve Legacy and Canonical Paths During Migration

**Status:** Accepted (observed)  
**Context:** Existing X behavior uses legacy tables while the canonical publishing foundation is
being introduced.  
**Decision:** Add canonical tables and a backfill migration without immediately deleting legacy paths.
  
**Consequences:** Incremental adoption is possible; duplicate business rules, schema drift, and
different idempotency semantics must be actively reconciled.

---

## 13. Open Technical Questions

- [ ] **Q:** What migration creates the legacy `duke_football_games` and `tweeted_scores` tables?
  **Context:** Current post-metadata migration assumes both already exist.
- [ ] **Q:** Which RLS policies and client access modes are supported?
  **Context:** RLS is enabled but policy intent is not present in inspected migrations.
- [ ] **Q:** Should legacy X publication claim and insert be made atomic?
  **Context:** Separate select/insert operations can race under concurrent jobs.
- [ ] **Q:** What transaction boundary is required for canonical ingestion?
  **Context:** Related writes may be partially persisted after a failure.
- [ ] **Q:** What are the provider retry, rate-limit, alerting, and rollback rules?
  **Context:** Workflow failures currently provide the main operational signal.
- [ ] **Q:** Is a frontend or public API still in scope?
  **Context:** README language and dependencies suggest one, but no active implementation was found.
- [ ] **Q:** Which dependencies and optional providers are still supported?
  **Context:** Legacy source and packages remain beside the current batch architecture.

---

## 14. Implementation Constraints

### Must Have

- Preserve deterministic calculation of scores and numeric facts.
- Keep service-role credentials and all provider secrets server-side.
- Apply the required Supabase migrations before using dependent persistence paths.
- Preserve idempotent publication and newsletter delivery behavior.
- Run the existing Jest suite before accepting generated specifications or changes.
- Keep fallback paths for optional AI, odds, and image providers where current behavior depends on
  them.

### Won't Have (This Version)

- No new frontend or inbound public API is inferred from the current implementation.
- No microservice decomposition or queue is introduced without a separate approved change.
- No provider credentials or live external messages are used as part of local specification
  extraction.

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-09-17 | 1.0.0 | Generated technical architecture from the existing Node.js modules, migrations, workflows, tests, and provider boundaries. |

---

> **Confidence Markers:** [HIGH] clear from code/config/tests | [MEDIUM] inferred from architecture or docs | [LOW] speculative
