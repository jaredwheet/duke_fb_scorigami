# Product Requirements Document

**Project:** duke_fb_scorigami  
**Version:** 1.0.0  
**Last Updated:** 2026-09-17  
**Status:** Draft  
**Mode:** Generate (brownfield migration blueprint; validation pending)

> This document is reverse-engineered from the current repository. Confidence markers describe
> evidence in source and tests, not production validation. A generated requirement is not trusted
> until executable tests pass against the existing implementation.

---

## 1. Project Overview

### Product Name

Duke FB Scorigami

### Purpose

Ingest Duke football data, identify unique and historically rare final scores, publish verified
score updates to X, and deliver scheduled Duke football newsletters. The implementation also
provides deterministic sports facts, editorial directives, constrained AI-assisted wording, and
media-guide reference data.

### Tech Stack

- [HIGH] JavaScript ES modules running on Node.js 22.
- [HIGH] Jest 30 is the test framework; Jest runs in a Node environment without source transforms.
- [HIGH] Supabase/Postgres stores legacy tweet/game state and the newer canonical publishing model.
- [HIGH] GitHub Actions runs scheduled and manually dispatched batch jobs.
- [HIGH] External providers include College Football Data, Winsipedia, optional sports/weather/odds
  providers, X, Resend, and OpenAI.
- [HIGH] MJML and Resend render and deliver email newsletters; Sharp/Puppeteer support image output.

### Architecture Pattern

[HIGH] Batch-oriented modular Node application. GitHub Actions starts short-lived scripts that call
external providers, normalize and persist data in Supabase, calculate deterministic facts, and
publish to X or Resend. No active web UI or long-running application entrypoint was found in the
repository. Legacy and canonical data paths coexist during migration.

---

## 2. Problem Statement

### Problem Being Solved

Duke football scores, historical context, and publication state must be assembled reliably from
multiple data sources. Manual score-history checks and newsletter assembly are error-prone, while
scheduled retries must not duplicate posts or email deliveries. Numeric claims need to remain
code-generated and verifiable even when editorial prose is produced by an AI provider.

### Target Users

- Duke football fans who consume score-history posts and newsletters [MEDIUM].
- A newsletter reader who needs useful game recaps, ACC context, historical facts, and upcoming-game
  information [MEDIUM].
- An operator who runs ingestion, fact detection, test newsletters, and scheduled jobs [HIGH].
- An editor or maintainer who reviews source-backed claims and editorial copy [MEDIUM].
- A developer who maintains provider adapters, deterministic calculations, migrations, and delivery
  recovery [HIGH].

### Context

The repository is an existing implementation rather than a greenfield product. The README describes
an interactive interface, but no frontend or active web entrypoint was found [HIGH]. The current
delivery surfaces are X and email workflows. Production behavior depends on Supabase migrations and
provider credentials that are not available in local source inspection.

---

## 3. Feature Inventory

Status in this table describes implementation presence. It does not mean the feature has passed a
live provider or deployment test.

| Feature | Description | Status | Priority | Location |
|---------|-------------|--------|----------|----------|
| Historical Scorigami Detection | Detects whether a Duke/opponent score pair is new and finds prior occurrences. | Complete | Must-have | `src/scorigami.js`, `src/gameUtils.js` |
| X Score Publishing | Publishes pregame, live, final, and recovered-game updates with duplicate protection and media fallback. | Complete | Must-have | `src/index.js`, `src/twitterClient.js`, `src/db.js` |
| Canonical Data Ingestion | Normalizes CFBData schedules and optional enrichment into canonical Supabase tables. | Complete | Must-have | `src/ingestion/` |
| Deterministic Facts and Directives | Calculates score, record, comeback, upset, late-game, and statistical facts and prioritizes editorial directives. | Complete | Must-have | `src/facts/`, `src/eventDetector.js` |
| Scheduled and Manual Operations | Runs X, newsletter, ingestion, and newsletter-test jobs through GitHub Actions. | Complete | Must-have | `.github/workflows/` |
| Newsletter Editions and Delivery | Renders and sends Sunday, Wednesday, and Friday editions with persisted issue and delivery state. | Complete | Must-have | `src/newsletter/` |
| Constrained AI Editorial | Produces structured editorial wording from immutable facts and rejects unsupported output. | Complete | Should-have | `src/ai/` |
| Media-Guide Reference Data | Extracts, curates, validates, previews, and optionally imports citation-backed 2026 guide claims. | Complete | Should-have | `src/mediaGuide/`, `data/media-guides/` |
| Canonical Sports Publishing Schema | Stores games, participants, source records, analytics, facts, directives, subscribers, issues, and deliveries. | Complete | Must-have | `supabase/migrations/` |
| Interactive Interface | README-described interactive exploration surface. | Not Started | Nice-to-have | No implementation located |

### Feature Details

#### Historical Scorigami Detection

**User Story:** As a Duke football fan, I want a final score to be compared with Duke's historical
score pairs so that I can tell whether the result is unique or recurring.

**Acceptance Criteria:**

- [ ] Given a game with Duke and opponent scores, the score details identify Duke's score, the
  opponent's score, the opponent, home/away orientation, and a stable score key.
- [ ] Given historical games containing either home or away representations of the same score pair,
  the detector treats the pair as the same Duke score result regardless of ordering.
- [ ] Given the current game is included in the lookup input, the detector excludes that game when
  determining whether the score pair occurred previously.
- [ ] Given no prior occurrence matches the score pair, the result marks it as a Scorigami and reports
  zero prior occurrences.
- [ ] Given one or more prior occurrences, the result reports the occurrence count and can identify
  the most recent occurrence for editorial context.

**Dependencies:** Historical game data in Supabase; normalized game score fields.  
**Status:** Complete  
**Confidence:** [HIGH] source and focused tests exist; live database validation is pending.

#### X Score Publishing

**User Story:** As an operator, I want scheduled jobs to publish verified Duke game updates without
duplicate posts so that the account remains timely and trustworthy.

**Acceptance Criteria:**

- [ ] On Wednesday when the reference date is Wednesday and the Chicago time hour is 12, the job
  finds the next scheduled Duke game and sends at most one pregame reminder for that game.
- [ ] Given a live game with a complete score, the job posts a live update keyed by game and score
  and does not repost a key already recorded in `tweeted_scores`.
- [ ] Given a completed game with a complete score, the job inserts the game if the same date/week/
  Duke-score/opponent-score record is not already stored and posts a final message keyed by score.
- [ ] Given a new final score pair, the job attempts a Wallace Wade card, falls back to a deterministic
  Scorigami card when image editing or upload fails, and falls back to text-only posting when both
  media paths fail.
- [ ] Given `BACKFILL_DAYS`, the job recovers completed games within that window; when the variable
  is absent or invalid it uses the configured default of 30 days.
- [ ] Every successful post stores the provider tweet ID, URL, content type, and template version.

**Dependencies:** CFBData, Supabase, X credentials, image assets, and migrations.  
**Status:** Complete  
**Confidence:** [HIGH] source and utility tests exist; live X behavior and concurrent-run safety are
not validated.

#### Canonical Data Ingestion

**User Story:** As a data maintainer, I want provider data normalized into stable canonical records so
that facts and newsletters use one consistent source of truth.

**Acceptance Criteria:**

- [ ] Given a target season, ingestion requests the CFBData schedule and normalizes sport, team,
  game, participant, source, and analytics records with stable keys.
- [ ] Given `INGEST_DETAILS=true`, ingestion requests and persists supported team, player, play-by-
  play, line, record, ranking, and related details; otherwise it performs the configured summary path.
- [ ] Re-running ingestion for the same provider records updates or reuses canonical rows rather than
  creating duplicate games, teams, participants, sources, or analytics.
- [ ] Optional providers are used only when configured and do not replace authoritative CFBData
  schedule and score fields.
- [ ] A failed provider request is surfaced as a failed batch; the implementation does not silently
  treat incomplete provider data as verified canonical data.

**Dependencies:** CFBData credentials, Supabase schema, optional provider configuration.  
**Status:** Complete  
**Confidence:** [HIGH] normalization tests and source inspection; transactional recovery is an open
question.

#### Deterministic Facts and Editorial Directives

**User Story:** As an editor, I want every numeric newsletter claim to come from deterministic facts
so that generated prose cannot invent statistics.

**Acceptance Criteria:**

- [ ] Given canonical games and guide claims, fact refresh calculates score-history, records,
  comebacks, late-game outcomes, upsets, and statistical hooks using code rather than an AI model.
- [ ] Fact refresh handles Supabase result pagination beyond a single 500-row page.
- [ ] Each fact is persisted with a stable fact key and logic version so a repeat refresh is
  idempotent and changes in logic are distinguishable.
- [ ] Event detection emits a prioritized `headline_directive` or an explicit empty result based on
  verified facts and does not claim an event when the required evidence is absent.
- [ ] Editorial directives identify the fact-backed event and provide downstream agents with the
  evidence needed to write copy without recalculating it.

**Dependencies:** Canonical game data, deterministic fact modules, guide claims where applicable.  
**Status:** Complete  
**Confidence:** [HIGH] focused fact and event tests exist.

#### Newsletter Editions and Delivery

**User Story:** As a Duke football newsletter reader, I want recurring editions that contain timely,
source-backed game context without receiving duplicate deliveries.

**Acceptance Criteria:**

- [ ] The cadence identifies the Sunday 7:00 AM, Wednesday noon, and Friday 9:00 AM Eastern
  publication windows and selects the correct edition from a reference date.
- [ ] The Sunday edition can render the Devil in the Details game recap and season context.
- [ ] The Wednesday edition can render the Wallace Wade Watercooler with upcoming-game and program
  context.
- [ ] The Friday edition can render the Victory Bell Bulletin with closing lines, pregame win
  probabilities, season statistics, and configured fallbacks.
- [ ] Newsletter content includes only fact-packet values for scores, standings, leaders, odds, and
  other numeric claims.
- [ ] The persistence layer creates or reuses an issue keyed by edition/date, associates issue games
  and sections, and records subscriber delivery attempts.
- [ ] A completed delivery is not sent again on a scheduled retry; failed attempts remain observable
  for retry handling.
- [ ] HTML rendering escapes user/provider-controlled text and produces valid email output for
  optional and missing content sections.

**Dependencies:** Canonical Supabase tables, CFBData, Resend, optional odds/OpenAI providers, MJML.  
**Status:** Complete  
**Confidence:** [HIGH] broad unit coverage and source inspection; live email delivery is pending.

#### Constrained AI Editorial

**User Story:** As an editor, I want varied readable newsletter copy while retaining deterministic
control over facts and claims.

**Acceptance Criteria:**

- [ ] The orchestrator gives recap, turning-point, Scorigami, history, and ACC agents the same
  immutable issue fact packet and structured output contract.
- [ ] The validator rejects unsupported numbers, unsupported internal/source language, and output that
  violates the required editorial shape.
- [ ] A missing, unavailable, or invalid model response produces deterministic fallback copy rather
  than preventing an otherwise renderable newsletter.
- [ ] Moment scouting may discover external evidence, but an external claim remains untrusted until
  the editorial validator accepts it.
- [ ] AI code does not calculate canonical scores, standings, records, or other numeric facts.

**Dependencies:** OpenAI credentials and model configuration; fact packet and validator.  
**Status:** Complete  
**Confidence:** [HIGH] orchestrator tests cover fallback and agent merging; live provider behavior is
not validated.

#### Media-Guide Reference Data

**User Story:** As an editor, I want reviewed media-guide claims with citations so that historical
context can be reused without parsing a PDF during every newsletter run.

**Acceptance Criteria:**

- [ ] The extraction command writes page-level generated text under `data/generated/` without making
  that derived output part of the application runtime contract.
- [ ] The curation command validates the structured 2026 guide artifact and its required contracts.
- [ ] The application loads the reviewed guide artifact for roster, history, series, records,
  comeback, and editorial context.
- [ ] Guide claims can be imported into Supabase with source page citations and verification metadata
  after the claims migration is applied.
- [ ] The season-preview command prints the structured 2026 preview contract.

**Dependencies:** Versioned PDF and JSON artifact; optional media-guide claims migration.  
**Status:** Complete  
**Confidence:** [HIGH] media-guide tests and checked-in artifacts exist; future-season behavior is
not implemented.

#### Scheduled and Manual Operations

**User Story:** As an operator, I want repeatable workflows with explicit inputs and bounded runtime
so that scheduled publication and data refresh can run unattended.

**Acceptance Criteria:**

- [ ] Scheduled X and newsletter workflows run every 15 minutes with non-canceling concurrency groups.
- [ ] Manual X dispatch accepts `backfill_days`; manual ingestion accepts season and detail inputs;
  manual newsletter testing accepts edition and test-date inputs.
- [ ] Every operational workflow checks out the repository, uses Node.js 22, runs `npm ci`, and has
  a ten-minute job timeout.
- [ ] Workflow secrets are injected through GitHub Actions secrets and are not committed to source.
- [ ] Manual canonical ingestion runs fact detection after ingestion completes.

**Dependencies:** GitHub Actions, repository secrets, provider availability.  
**Status:** Complete  
**Confidence:** [HIGH] workflow files are present; hosted workflow execution is pending.

---

## 4. Functional Requirements

### Core Behaviours

- **FR-001 Data authority:** CFBData and persisted canonical records are authoritative for current
  schedule, score, play-by-play, and statistics. Winsipedia and optional providers enrich rather than
  silently override authoritative fields [HIGH].
- **FR-002 Deterministic numeric facts:** Score pairs, standings, records, game outcomes, analytics,
  and newsletter numeric values must be calculated or selected by code from validated data [HIGH].
- **FR-003 Historical score identity:** A score pair is identified from Duke's score and the
  opponent's score, independent of home/away representation [HIGH].
- **FR-004 Publication idempotency:** X posts and newsletter deliveries use persisted identity keys so
  scheduled retries do not intentionally repeat completed work [HIGH].
- **FR-005 Newsletter cadence:** The publication scheduler selects the edition from the configured
  Eastern-time cadence and supports a deterministic test date [HIGH].
- **FR-006 Editorial validation:** AI output must conform to structured schemas and pass numeric and
  source-language validation before it is included in a newsletter [HIGH].
- **FR-007 Fallback operation:** Missing optional AI, odds, image, or enrichment providers must use
  deterministic fallback paths where implemented and must not create unsupported facts [HIGH].
- **FR-008 Migration compatibility:** Legacy Duke game and tweet tables remain usable while canonical
  sports publishing tables are populated and backfilled [HIGH].
- **FR-009 Reference citations:** Media-guide claims retain source-page and verification metadata when
  imported into the claims store [HIGH].
- **FR-010 Operator controls:** Batch scripts accept environment-controlled season, date, backfill,
  edition, and detail inputs without requiring source edits [HIGH].

### Input/Output Specifications

- `node src/index.js` reads provider credentials and optional `FAKE_DATE`/`BACKFILL_DAYS`; it emits
  logs and provider publication side effects [HIGH].
- `npm run ingest` reads `INGEST_YEAR` and `INGEST_DETAILS`; it writes canonical Supabase records
  [HIGH].
- `npm run detect:facts` reads canonical Supabase records and writes facts/directives [HIGH].
- `npm run newsletter:send` reads newsletter and provider configuration, renders an issue, and sends
  through Resend [HIGH].
- `npm run newsletter:test` reads test edition/date and recipient configuration and sends a test
  newsletter through the configured test path [HIGH].
- `npm test` runs the Jest suite in Node with `dotenv/config` setup [HIGH].

### Business Logic Rules

- A final score is a Scorigami only when its normalized Duke/opponent pair has no earlier historical
  occurrence [HIGH].
- A scheduled retry must check persisted delivery state before sending [HIGH].
- A missing or invalid AI response never authorizes an unverified numeric claim [HIGH].
- X messages are trimmed to the provider's 280-character limit before publication [HIGH].
- A final Scorigami publication prefers the Wallace Wade image path, then the deterministic card, then
  text-only output [HIGH].
- Database migrations must be applied before code paths that depend on their tables or columns are run
  [HIGH].

---

## 5. Non-Functional Requirements

### Performance

- [HIGH] GitHub Actions operational jobs have a ten-minute timeout.
- [HIGH] X and newsletter schedules run at 15-minute intervals, so a successful job should finish
  within the interval under normal provider latency.
- [MEDIUM] No formal p95 latency, throughput, or maximum season-size target is defined. Pagination
  beyond 500 rows exists for fact refresh, but broader capacity is unmeasured.

### Security

- [HIGH] Provider keys, service-role credentials, recipient addresses, and local `.env` values must
  remain outside version control.
- [HIGH] Supabase service-role credentials are server-only and must not be exposed in client-facing
  code.
- [HIGH] Migrations enable RLS on inspected legacy and canonical tables.
- [MEDIUM] The migrations inspected do not define public RLS policies; intended client/public access
  is unresolved and service-role access currently carries the runtime path.
- [HIGH] External source text and AI output are untrusted until validation.

### Scalability

- [HIGH] Canonical identity keys and upserts support repeat ingestion.
- [HIGH] Fact refresh explicitly handles pagination beyond one Supabase page.
- [MEDIUM] Ingestion is not transactional across all related records, so partial writes may remain
  after a failure.
- [MEDIUM] Newsletter queries are not explicitly scoped by sport, which is safe only while the tables
  contain the intended Duke football data.

### Availability

- [HIGH] Scheduled workflows use non-canceling concurrency groups to avoid canceling an active batch.
- [HIGH] Editorial, image, and optional provider fallbacks preserve partial publication capability.
- [MEDIUM] No formal delivery SLA, retry budget, alerting policy, or rollback procedure is documented.

---

## 6. AI/ML Specifications

### Models and Providers

- OpenAI is optional for editorial agents, moment search, and image editing [HIGH].
- `OPENAI_EDITORIAL_MODEL`, `OPENAI_MOMENT_SEARCH_MODEL`, and `OPENAI_IMAGE_MODEL` select model
  behavior where configured [HIGH].
- Without a usable OpenAI response, deterministic editorial and image fallbacks are used [HIGH].

### Prompt Patterns

- Agents receive a shared immutable fact packet and produce structured sections for recap, moment,
  Scorigami, history, and ACC context [HIGH].
- External web or Reddit moment evidence is treated as untrusted input rather than a fact source
  [HIGH].
- The validator rejects unsupported numbers and internal/source language before output is used [HIGH].

### Context Management

- Canonical facts, issue data, and editorial directives are assembled before model invocation [HIGH].
- The model is an editorial wording layer, not the owner of score calculations or numeric truth
  [HIGH].
- Exact prompt/version retention and model-response audit retention are not documented [LOW].

---

## 7. Data Architecture

### Data Models

Legacy and canonical stores coexist:

- Legacy `duke_football_games` stores historical Duke game score/context records [HIGH].
- Legacy `tweeted_scores` stores X publication identity and metadata [HIGH].
- Canonical foundation tables include `sports`, `teams`, `games`, `game_participants`,
  `game_source_records`, `game_analytics`, `game_facts`, and `editorial_directives` [HIGH].
- Newsletter tables include `newsletter_subscribers`, `subscriber_preferences`, `newsletter_issues`,
  `newsletter_issue_games`, and `newsletter_deliveries` [HIGH].
- Media-guide persistence includes `media_guide_editions` and `media_guide_claims` [HIGH].

### Relationships and Constraints

- Canonical games identify a sport and stable game key, then relate to participant roles, provider
  source records, analytics, facts, and editorial directives [HIGH].
- Newsletter issues relate to edition/date, selected games and sections, subscribers, and delivery
  attempts [HIGH].
- Unique keys support idempotent canonical ingestion, fact refresh, issue creation, and delivery
  recording [HIGH].
- Legacy X duplicate prevention uses a select-before-insert check protected by database uniqueness;
  the application-level claim is not atomic [HIGH].

### Storage Mechanisms

- Supabase/Postgres is the production persistence layer [HIGH].
- The repository also contains SQLite-related dependencies and legacy/unused code, but no current
  primary SQLite workflow was established [MEDIUM].
- Checked-in media-guide JSON and PDF files are reference artifacts; generated PDF extraction output
  under `data/generated/` is ignored [HIGH].

---

## 8. Integration Map

| Service | Purpose | Data Direction | Requiredness | Evidence |
|---------|---------|----------------|--------------|----------|
| College Football Data | Schedule, scores, venues, box scores, play-by-play, stats, lines, records, rankings | Read | Required for live ingestion/publication paths | [HIGH] |
| Winsipedia | Historical schedule/history enrichment | Read | Optional enrichment | [HIGH] |
| SportsDataverse / Visual Crossing / Odds API | Optional sports, weather, and odds enrichment | Read | Optional | [HIGH] |
| Supabase/Postgres | Legacy state, canonical games/facts, newsletter and claims state | Read/write | Required | [HIGH] |
| X/Twitter | Posts and media uploads | Write | Required for X workflow | [HIGH] |
| Resend | Newsletter email delivery | Write | Required for email workflow | [HIGH] |
| OpenAI | Editorial wording, moment discovery, image editing | Read/write API | Optional with fallbacks | [HIGH] |
| GitHub Actions | Scheduled/manual orchestration and secret injection | Starts jobs | Required for hosted operation | [HIGH] |

### Authentication Methods

- Provider API keys and X credentials are environment variables injected locally or by GitHub Actions
  secrets [HIGH].
- Supabase uses `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` [HIGH].
- Resend uses `RESEND_API_KEY` and a configured recipient/from address [HIGH].

### Third-Party Dependencies

The dependency contract is defined by `package.json` and includes Supabase, Axios, Cheerio,
dotenv, MJML, node-fetch, OpenAI, PDF parsing, Puppeteer, Resend, Sharp, SQLite packages, and the
Twitter API client [HIGH]. The operational necessity of unused/legacy dependencies such as Express,
SQLite, Axios, and Puppeteer should be reconciled [MEDIUM].

---

## 9. Configuration Reference

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SUPABASE_URL` | Supabase project URL | Yes for Supabase imports | None; import fails |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key | Yes for Supabase imports | None; import fails |
| `CFB_DATA_KEY` | College Football Data API key | Yes for provider workflows | None |
| `TWITTER_API_KEY` | X API key | Yes for X publishing | None |
| `TWITTER_API_SECRET` | X API secret | Yes for X publishing | None |
| `TWITTER_ACCESS_TOKEN` | X access token | Yes for X publishing | None |
| `TWITTER_ACCESS_SECRET` | X access secret | Yes for X publishing | None |
| `RESEND_API_KEY` | Resend API key | Yes for email sending | None |
| `NEWSLETTER_TO` | Automated newsletter recipient | Yes for production delivery | No fallback; production fails closed |
| `NEWSLETTER_TEST_TO` | Test recipient | Yes for test delivery | None |
| `RESEND_FROM_EMAIL` | Newsletter sender | Depends on send path | Workflow supplies Resend test sender |
| `OPENAI_API_KEY` | OpenAI access | Optional | Deterministic fallback |
| `OPENAI_EDITORIAL_MODEL` | Editorial model | Optional | Workflow default `gpt-4o-mini` |
| `OPENAI_MOMENT_SEARCH_MODEL` | Moment-search model | Optional | Provider/library default |
| `OPENAI_IMAGE_MODEL` | Image-edit model | Optional | Provider/library default |
| `ODDS_API_ENDPOINT` / `ODDS_API_KEY` | Odds provider configuration | Optional | Fallback/no odds |
| `SPORTS_DATAVERSE_ENDPOINT` / `SPORTS_DATAVERSE_API_KEY` | SportsDataverse enrichment | Optional | No enrichment |
| `VISUAL_CROSSING_API_KEY` | Weather enrichment | Optional | No enrichment |
| `MOMENT_SOURCE_URLS` | Configured external moment sources | Optional | No configured sources |
| `FAKE_DATE` | Deterministic reference date for local scheduled runs | Optional | Current date |
| `BACKFILL_DAYS` | Completed-game recovery window | Optional | 30 |
| `INGEST_YEAR` | Canonical ingestion season | Required for ingestion intent | Workflow default 2026 |
| `INGEST_DETAILS` | Enable detailed ingestion enrichment | Optional | Workflow input |
| `NEWSLETTER_TEST_EDITION` | Test edition selector | Required for selected test path | Workflow default Sunday |
| `NEWSLETTER_TEST_DATE` | Test issue date | Optional | Current/reference date |
| `NEWSLETTER_USE_LIVE_DATA` | Enable live test data | Optional | Workflow sets `true` |

### Feature Flags

There is no centralized feature-flag service. Runtime behavior is selected through environment
variables, provider key availability, edition/date inputs, and the migration/schema state [HIGH].

---

## 10. Quality Assessment

### Tested Functionality

[HIGH] Static inspection identified focused Jest coverage across facts, event detection, newsletter
cadence and rendering, issue persistence, AI orchestration, ingestion normalization/providers, game
and team utilities, tweet trimming, scorecard generation, and media-guide contracts. The repository
contains 25 test files; the full suite was not run during this initialization, so current pass status
is unknown.

### Untested Areas

- Live Supabase migrations, RLS policy behavior, and production schema compatibility.
- GitHub Actions execution, secret injection, concurrency, and timeout behavior.
- Real X, Resend, OpenAI, CFBData, and optional-provider failures and rate limits.
- Concurrent legacy X runs proving that no duplicate post is sent between the select and insert.
- Full transactional recovery for partial canonical ingestion.
- Future media-guide editions beyond 2026.

### Technical Debt

- [REVIEW] `package.json` declares `main: "index.js"`, but the repository entrypoint is
  `src/index.js` and no root `index.js` was found.
- [REVIEW] Legacy X idempotency checks and inserts are separate operations; database uniqueness is
  the final defense rather than an atomic application claim.
- [REVIEW] `FAKE_DATE` changes date comparisons but the schedule path may still default to the actual
  calendar year.
- [REVIEW] Canonical ingestion can leave related partial records after a mid-batch failure because
  the full workflow is not transactional.
- [REVIEW] Newsletter queries are not explicitly filtered by sport.
- [INFO] Newsletter unsubscribe/preferences links contain `example.com` placeholders.
- [INFO] Media-guide loading is hard-coded to the 2026 edition.
- [INFO] Media-guide import source hashing depends on the current working directory.
- [REVIEW] RLS is enabled in inspected migrations but public policies and intended client access are
  not documented.
- [REVIEW] Legacy schema migrations assume pre-existing `duke_football_games` and `tweeted_scores`
  tables; ownership and clean-install order are unresolved.
- [INFO] Legacy/unused source and dependencies remain, including `src/fetchGames.js`, an unused
  parser path, Express, SQLite packages, and potentially Puppeteer.
- [INFO] README claims an interactive interface not found in the current implementation.
- [REVIEW] Existing GitHub Actions workflows do not include a dedicated `npm test` quality workflow.

---

## 11. Open Questions

1. Is an interactive web interface still an intended product surface, or should the README be revised
   to describe the current X/newsletter batch product?
2. Which migration creates the legacy `duke_football_games` and `tweeted_scores` tables, and what is
   the supported clean-install migration order?
3. Which Supabase RLS policies are required for any client or public read path, if any?
4. Should legacy X publication claims be changed to an atomic database claim or transactional
   operation before enabling concurrent schedules?
5. What delivery SLO, alerting, retry budget, and operator rollback procedure apply to X and email?
6. Should the product support media-guide editions other than 2026, and what artifact/versioning
   contract should govern them?
7. Should the CI pipeline run `npm test` on pull requests and manual operational workflows remain
   separate?
8. Are the optional providers and unused dependencies still supported product scope or candidates for
   removal?
9. Should newsletter data queries be explicitly scoped to football and Duke as canonical tables grow?
10. Which generated requirements will be promoted from `Draft` after test-spec and code verification?

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-09-17 | 1.0.0 | Generated brownfield PRD from the existing Node.js, Supabase, workflow, test, and reference-data implementation. |

---

> **Confidence Markers:** [HIGH] clear from code/tests | [MEDIUM] inferred from patterns or docs | [LOW] speculative
>
> **Status Values:** Complete | Partial | Stubbed | Broken | Not Started
