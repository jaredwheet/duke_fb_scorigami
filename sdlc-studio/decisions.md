# Project Decisions Log

The canonical, append-only home for load-bearing decisions every later artifact and
delegated agent inherits - both **product** decisions (scope cuts, the answers to the
PRD's open questions) and **implementation conventions** (error-envelope shape, ID scheme,
token strategy, migration style, test harness). One record, two views: an open question
lives in `PRD §Open Questions`; when resolved it is promoted here with a back-link, never
duplicated as free text in both. This block is injected into the handoff context delegated
agents read, so a decision is referenced once, not pasted N times.

## Decisions

| ID | Decision | Rationale | Status | Supersedes | Date |
| --- | --- | --- | --- | --- | --- |
| D0001 | Leave the sprint token capacity at 0 during brownfield onboarding | The project has no measured sprint telemetry yet. A zero token capacity is the documented unbounded/advisory setting and avoids treating an unmeasured forecast as a meaningful gate; wall-clock and unit appetite remain the run controls until the first sprint records actuals. | accepted | -- | 2026-09-17 |
| D0002 | Keep provider-version provenance and Winsipedia enrichment outside US-01M2QXGN | This story owns the pure CFBData normalization contract only. Provider-version provenance belongs to canonical source persistence, and Winsipedia belongs to its own enrichment adapter; neither changes the stable CFBData identity contract needed by this story. | accepted | -- | 2026-09-17 |
| D0003 | Canonical ingestion is per-game recoverable; legacy base-table ownership is external and tracked as BG-01M2R2M9 | Live Supabase confirms the legacy tables and canonical uniqueness constraints exist, but the repository migration ledger does not contain their base-table creation. This story will prove per-game failure observability and rerun reuse, while clean-install migration reproducibility remains a tracked migration bug rather than an invented schema change. | accepted | -- | 2026-09-17 |
| D0004 | X publishing uses at-most-once atomic claim/finalize state, FAKE_DATE controls the reference clock and football season, and default evidence uses local doubles rather than an external X sink. | The current select-post-insert flow can duplicate public side effects under concurrency or post-success metadata failure. Claiming the identity before posting prevents blind retries while a visible uncertain state supports operator reconciliation. A single controlled reference date keeps schedule-year, next-game, and backfill behavior reproducible. No X sink is approved in this workspace, so tests must not send external messages; manual smoke remains separately authorized. | accepted | -- | 2026-09-17 |
| D0005 | Q8 returns bounded in-memory editorial validation diagnostics; durable provenance and rejection-audit persistence belongs to Q7's delivery/audit boundary, while QMY owns verified media-guide claim provenance. | Three Amigos consultation found that Q8 must make validation disposition and stable reason codes explicit, but adding a Supabase audit schema to the validator would expand its scope and couple it to delivery. Q8 therefore returns sectionResults and bounded provenance metadata for Q7 to persist before external send; QMY remains responsible for guide edition, citation, hash, and verification state. Raw prompts, raw model responses, and credentials are not persisted in this epic. | accepted | -- | 2026-09-18 |
| D0006 | Future media-guide editions require a separately reviewed and versioned artifact/citation contract; this epic supports only the reviewed 2026 guide. | The current curated JSON and citation model are explicitly 2026-specific. Supporting 2027 without a reviewed artifact, schema/version, and citation contract would turn a source boundary into an unreviewed live scraper or stale fallback. | accepted | -- | 2026-09-18 |
| D0007 | The media-guide claims migration is required in environments that run claims import; local artifact-backed rendering remains valid without the claims table. | The checked-in reviewed artifact is the runtime source for local rendering, while importGuideClaims requires the additive claims table. This keeps deployment prerequisites explicit without making newsletter rendering depend on generated or imported pages. | accepted | -- | 2026-09-18 |
| D0008 | Q7 uses a finite 30-second provider timeout with no in-process retry; the scheduled job is the retry mechanism, and editorial audit persistence is append-only and must succeed before external delivery. | A hung provider cannot consume the ten-minute newsletter job indefinitely, while in-process retries multiply provider cost and complicate delivery identity. The existing delivery claim boundary already supplies scheduled retry behavior. Append-only audit rows preserve prior fallback diagnoses; audit failure must fail closed before Resend so a sent issue always has its editorial disposition record. | accepted | -- | 2026-09-18 |
| D0009 | QMY accepts only the reviewed 2026 media-guide artifact and imports verified claims atomically through a service-role migration function; claim identity is edition plus claim_key and source/claim hashes reject drift. | The checked-in artifact is the reviewed runtime source, generated extraction is derived only, and future editions require a new reviewed contract. Atomic import prevents an edition row from surviving a failed claim write. Exact PDF bytes and canonical claim payloads provide reproducible provenance; unverified or uncited claims never enter the verified import path. | accepted | -- | 2026-09-18 |

## Notes

- Decisions are numbered globally and zero-padded: `D{NNNN}`.
- Append with `scripts/decisions.py add`; list with `scripts/decisions.py list`.
- `Status`: `accepted` | `superseded` | `revisited`. A superseding decision names the one
  it replaces in `Supersedes`.
- Distinct from the sprint per-tranche ledger (`scripts/ledger.py`), which is scoped to
  a single delivery run; this is the durable project spine.
