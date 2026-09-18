# PL-01M2TQG4: Validate and import cited media-guide claims

> **Status:** Complete
> **Story:** [US-01M2QXMY: Validate and import cited media-guide claims](../stories/US-01M2QXMY-validate-and-import-cited-media-guide-claims.md)
> **Epic:** [EP-01M2QXHW: Constrained Editorial and Media References](../epics/EP-01M2QXHW-constrained-editorial-and-media-references.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1
> **Language:** JavaScript ES modules, SQL migrations, Node.js 22, Jest 30

## Overview

Validate the reviewed 2026 artifact/citations, compute exact PDF and claim hashes, import claims atomically and
idempotently through a service-role RPC, and keep generated extraction outside runtime.

## Acceptance Criteria Summary

| AC | Name | Description |
| --- | --- | --- |
| AC1 | Artifact/citation contract | Checked-in 2026 PDF/JSON validates, citations resolve, pages are bounded, IDs are unique, and preview is ready. |
| AC2 | Claim import | 33 verified rows retain edition/citation/pages/source hash/claim hash and import is idempotent/atomic. |
| AC3 | Runtime boundary | Clean-cwd guide-backed rendering uses curated JSON, not generated extraction output. |

## Implementation Tasks

| # | Task | File | Status |
| --- | --- | --- |
| 1 | Add reviewed source SHA-256 and validate exact 2026 title/page/date/hash, citation resolution/page bounds, and global claim IDs. | `data/media-guides/2026.json`, `src/mediaGuide/schema.js` | [x] |
| 2 | Build canonical cited rows with explicit citation ID/page end/source hash/claim hash and module-anchored PDF hashing. | `src/mediaGuide/mediaGuideRepository.js` | [x] |
| 3 | Refactor import into an injectable adapter and atomic service-role RPC; fail closed on source/claim/key-set drift. | `src/mediaGuide/importGuideClaims.js`, `supabase/migrations/20260918170000_media_guide_claim_hashes.sql` | [x] |
| 4 | Add exact artifact/citation/hash/idempotency/clean-cwd tests and isolated migration evidence. | `src/mediaGuide/mediaGuide.test.js` | [x] |
| 5 | Run exact selectors and full Jest; run the real import twice only where service-role credentials are available. | QMY tests/import | [x] 3 selectors; full suite 35 suites/173 tests; isolated RPC evidence |

## Edge Case Handling

| Edge | Strategy |
| --- | --- |
| Unknown citation ID | Reject before any write. |
| Page outside 1..308/reversed range | Reject before any write. |
| Blank/duplicate claim ID | Reject globally across all seven collections. |
| PDF source drift | Compare exact bytes to committed `source.sha256`; reject before RPC. |
| Re-import same artifact | RPC sees matching hashes and leaves identity/rows unchanged. |
| Changed/removed claim | RPC raises drift; no overwrite/delete synchronization. |
| Missing migration/table | RPC/import fails before external persistence; no partial edition row. |
| Generated output | Runtime and tests use checked-in JSON; `data/generated/` is never required. |

**Coverage:** 8/8 listed interactions handled

## Verification

| AC | Selector | Status |
| --- | --- | --- |
| AC1 | `npm test -- --runInBand src/mediaGuide/mediaGuide.test.js -t "^QMY AC1 validates the checked-in 2026 PDF and JSON through curation and preview$"` | Pass |
| AC2 | `npm test -- --runInBand src/mediaGuide/mediaGuide.test.js -t "^QMY AC2 builds 33 unique verified claim rows with bounded citations$"` | Pass; isolated synthetic RPC import evidence |
| AC3 | `npm test -- --runInBand src/mediaGuide/mediaGuide.test.js -t "^QMY AC3 renders guide-backed newsletter context from a clean cwd without generated pages$"` | Pass |

## Definition of Done

- [x] All exact selectors and full Jest pass.
- [x] Base and forward migrations are applied/evidenced in disposable and required import environments.
- [x] Two isolated RPC imports retain one edition/33 claims with stable identities and hashes; local CLI import remains credential-gated.
- [ ] Independent plan/delivery reviews approve; reviewer-of-record sign-off remains terminal.

## Resolved Questions

- Only reviewed 2026 is supported; future editions require a new artifact/version/citation decision.
- Claims import requires migrations; artifact-backed rendering does not.
- Claim-set drift fails closed rather than silently deleting or overwriting historical claims.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added exact selectors, source/claim hashes, citation bounds, atomic RPC, and drift/idempotency phases. |
| 2026-09-18 | TDD implementation | Added artifact/schema/hash/import code, 15 media-guide tests, production/test migrations, and isolated RPC evidence. |
