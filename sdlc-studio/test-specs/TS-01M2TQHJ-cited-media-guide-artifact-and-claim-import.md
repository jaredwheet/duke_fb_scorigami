# TS-01M2TQHJ: Cited Media-Guide Artifact and Claim Import

> **Status:** Complete
> **Epic:** [EP-01M2QXHW: Constrained Editorial and Media References](../epics/EP-01M2QXHW-constrained-editorial-and-media-references.md)
> **Story:** [US-01M2QXMY: Validate and import cited media-guide claims](../stories/US-01M2QXMY-validate-and-import-cited-media-guide-claims.md)
> **Created:** 2026-09-18
> **Created-by:** sdlc-studio new
> **Raised-by:** OpenCode; agent; v1

## AC Coverage Matrix

| AC | Description | Test Cases | Status |
| --- | --- | --- | --- |
| AC1 | Reviewed artifact, source hash, citations, pages, and claim IDs validate. | TC001-TC004 | Pass |
| AC2 | 33 claims retain citation/hash/verification metadata and import atomically/idempotently. | TC005-TC008 | Pass |
| AC3 | Runtime does not depend on generated extraction output. | TC009 | Pass |

**Coverage:** 3/3 ACs mapped.

## Test Cases

| TC | Case | Expected |
| --- | --- | --- |
| TC001 | Checked-in PDF/JSON curation and preview | 308 pages, 33 claims, required markers, and ready preview contract. |
| TC002 | Unknown citation/page/duplicate ID fixtures | Validation rejects before import. |
| TC003 | Source hash | Exact PDF bytes match committed lowercase SHA-256. |
| TC004 | Claim rows | 33 unique rows have citation ID/pages, source hash, claim hash, and `verified`. |
| TC005 | Import twice | One edition, 33 claims, stable IDs/hashes/no duplicates. |
| TC006 | Source/key-set/claim drift | RPC rejects without modifying existing rows. |
| TC007 | Missing/partial migration | Import fails closed without a partial edition row. |
| TC008 | SQL boundary | RLS, service-role execution, constraints, and atomic function contract are present. |
| TC009 | Clean cwd runtime | Curated JSON renders/loads without `data/generated/`. |

**Automation:** `src/mediaGuide/mediaGuide.test.js`; TC005-TC008 require disposable `supabase-test`/import evidence.

## Environment

| Requirement | Details |
| --- | --- |
| Prerequisites | Node.js 22, Jest 30, reviewed 2026 PDF/JSON, service-role Supabase test credentials. |
| External Services | No public provider; isolated Supabase only for import/migration cases. |
| Test Data | 33 reviewed claims, valid/invalid citation fixtures, source/claim hashes, drifted payload/key sets. |

## Automation Status

| TC | Status | Implementation |
| --- | --- | --- |
| TC001-TC004, TC009 | Automated | `src/mediaGuide/mediaGuide.test.js` |
| TC005-TC008 | Isolated complete | Production/test migrations and RPC evidence |

## Traceability

| Artefact | Reference |
| --- | --- |
| Epic | [EP-01M2QXHW](../epics/EP-01M2QXHW-constrained-editorial-and-media-references.md) |
| Story | [US-01M2QXMY](../stories/US-01M2QXMY-validate-and-import-cited-media-guide-claims.md) |
| Plan | [PL-01M2TQG4](../plans/PL-01M2TQG4-validate-and-import-cited-media-guide-claims.md) |

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-18 | sdlc-studio | Created via `new` (deterministic). |
| 2026-09-18 | OpenCode; agent; v1 | Added artifact/citation/hash/idempotency/migration/runtime-boundary cases. |
| 2026-09-18 | OpenCode; agent; v1 | 15 media-guide tests pass; atomic RPC migrations and isolated 33-row evidence recorded. |
