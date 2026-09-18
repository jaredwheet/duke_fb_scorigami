# TS-01M2QZEE: Provider Game Normalization

> **Status:** Ready
> **Created-by:** sdlc-studio new
> **Raised-by:** sdlc-studio; agent; v1
> **Epic:** [EP-01M2QXM7: Canonical Sports Data and Verified Facts](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md)
> **Story:** [US-01M2QXGN: Normalize provider games into canonical records](../stories/US-01M2QXGN-normalize-provider-games-into-canonical-records.md)
> **Created:** 2026-09-17
> **Last Updated:** 2026-09-17

## Overview

This spec covers the pure CFBData-to-canonical normalization contract. It intentionally avoids live
CFBData, Supabase, and enrichment providers. The ten planned unit cases are now automated in the
colocated Jest suite and remain subject to final AC verification.

## Scope

### Stories Covered

| Story | Title | Priority |
| --- | --- | --- |
| [US-01M2QXGN](../stories/US-01M2QXGN-normalize-provider-games-into-canonical-records.md) | Normalize provider games into canonical records | Medium |

### AC Coverage Matrix

| Story | AC | Description | Test Cases | Status |
| --- | --- | --- | --- | --- |
| US-01M2QXGN | AC1 | Complete CFBData game emits canonical identities and fields. | TC0001 | Covered |
| US-01M2QXGN | AC2 | Same payload produces identical canonical keys and equivalent values. | TC0002 | Covered |
| US-01M2QXGN | AC3 | Missing optional enrichment leaves authoritative fields intact and values absent. | TC0003 | Covered |

**Coverage:** 3/3 ACs mapped to test cases; all 3 are automated.

### Test Types Required

| Type | Required | Rationale |
| ------ | ---------- | --------- |
| Unit | Yes | Normalization functions are pure and deterministic. |
| Integration | No | Persistence and provider calls are explicitly out of scope for this story. |
| E2E | No | No inbound API or user-facing UI is involved. |

### Strategy Heuristics

- [ ] **Production-state-shape integration test** - not applicable: this story does not read production state or a database.
- [ ] **Rejects-old-shape contract test** - not applicable: no new wire/schema shape is introduced; this story preserves the existing internal record contract.
- [ ] **Regression test per fixed bug** - no known defect is being fixed; this is extracted behavior coverage.

---

## Environment

| Requirement | Details |
| ------------- | --------- |
| Prerequisites | Node.js 22, `npm ci`, existing Jest 30 configuration. |
| External Services | None; all tests use in-memory CFBData fixtures. |
| Test Data | Complete game fixture, minimal missing-field fixture, null-score fixture, non-ASCII team fixture, and repeated payload. |

---

## Test Cases

### TC0001: Complete provider game becomes a canonical master game

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXGN AC1

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A completed CFBData game has IDs, season, date, Duke/Tulane teams, scores, and home/away fields. | Fixture is accepted without network or database setup. |
| When | `buildMasterGameObject` normalizes the fixture. | It returns football sport data, a season/date/home/away canonical key, final status, two participants, and a CFBData source record. |
| Then | Assert canonical identity and source metadata. | Existing `src/ingestion/normalize.test.js` passes and names the observable contract. |

**Assertions:**

- [ ] `canonicalKey` contains `football:2026:` and both team slugs.
- [ ] Status is `final`; participant roles are `home` and `away` with scores 17 and 3.
- [ ] Source provider is `cfbdata` and external game ID is `401858209`.

**Automation:** Existing `src/ingestion/normalize.test.js`; strengthen if required.

---

### TC0002: Keeps canonical identity stable for repeated payloads

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXGN AC2

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | The same complete CFBData payload is held in one immutable fixture. | Both calls receive byte-equivalent input. |
| When | Call `buildMasterGameObject` with two independent frozen copies of that payload. | Each normalized result has the same canonical key, team identity, participant fields, source ID, and payload hash. |
| Then | Compare stable fields, assert the hash equals `getPayloadHash` and is a 64-character SHA-256 hex value, and compare the untouched inputs. | No value depends on invocation order, caller-input mutation, or wall-clock time. |

**Assertions:**

- [ ] Canonical keys are equal.
- [ ] Participant/team/source identity objects are equivalent.
- [ ] `getPayloadHash` output matches the normalized `payloadHash`.
- [ ] The normalized hash is 64 lowercase hexadecimal characters.
- [ ] The caller-owned input fixtures remain unchanged.

**Automation:** New test in `src/ingestion/normalize.test.js` named `keeps canonical identity stable for repeated payloads`.

---

### TC0003: Missing optional enrichment does not invent data

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXGN AC3

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A valid game payload has no optional enrichment values and no configured enricher result. | The base schedule, score, team, and source fields remain available. |
| When | Normalize through `buildMasterGameObject` with the default empty enrichment object. | `enrichments` is empty/absent by contract; no provider-derived value is manufactured. |
| Then | Assert canonical key, season, week, start time, status, scores, source metadata, and empty enrichment. | The test proves authoritative schedule fields survive without live provider access. |

**Assertions:**

- [ ] Scores and status retain their provider-derived values.
- [ ] Canonical key, season, week, and start time retain their provider-derived values.
- [ ] Source provider and external game ID remain present.
- [ ] `enrichments` has no fabricated provider record.
- [ ] No optional field defaults to a misleading numeric or textual value.

**Automation:** New named test in `src/ingestion/normalize.test.js`; repoint the story Verify line after it exists.

---

### TC0011: Provider status branches remain explicit

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXGN data requirement

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A scheduled payload, a started payload, and an explicit in-progress payload. | Each payload has the same valid identity fields but a different status signal. |
| When | Normalize each payload. | Status values are `scheduled`, `in_progress`, and `in_progress` respectively. |
| Then | Assert the status branch output. | Normalization does not collapse non-final games into `final`. |

**Assertions:**

- [ ] `completed: false` with no started signal becomes `scheduled`.
- [ ] `started: true` becomes `in_progress`.
- [ ] `status: in_progress` becomes `in_progress`.

**Automation:** New unit test.

---

### TC0004: Missing external game ID is rejected

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXGN edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A payload has no truthy `id`. | The input is not a valid canonical source record. |
| When | `normalizeCfbDataGame` is called. | It throws `CFBData game is missing an external id`. |
| Then | Assert no normalized record is returned. | A keyless game cannot reach persistence. |

**Assertions:**

- [ ] Exact error message is asserted.
- [ ] No partial canonical object is accepted.

**Automation:** New unit test.

---

### TC0005: Missing team names use stable fallback identity

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXGN edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A valid game has a team ID but an empty/missing team name. | The team still has an external identity. |
| When | Normalization runs. | Slug falls back to `team-<id>` and display name to `Unknown team`. |
| Then | Repeat with the same input. | Fallback identity is stable. |

**Assertions:**

- [ ] Fallback slug includes the team ID.
- [ ] Fallback name is exactly `Unknown team`.

**Automation:** New unit test.

---

### TC0006: Missing start date uses deterministic date key

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXGN edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A valid game has no `startDate`. | No wall-clock date should be needed. |
| When | Normalization runs. | `startAt` is null and the canonical date component is `unknown-<game id>`. |
| Then | Normalize twice. | The date component remains identical. |

**Assertions:**

- [ ] No test depends on the current calendar date.
- [ ] Canonical key contains the deterministic unknown-date token.

**Automation:** New unit test.

---

### TC0007: Null or absent scores remain null

**Type:** Unit | **Priority:** High | **Story:** US-01M2QXGN edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | Home or away points are null or omitted. | The source does not establish a numeric score. |
| When | Normalization runs. | The corresponding participant score is `null`, not zero or `NaN`. |
| Then | Assert both null and omitted variants. | Downstream facts can distinguish missing scores from a zero score. |

**Assertions:**

- [ ] Null input yields null output.
- [ ] Omitted input yields null output.
- [ ] No `NaN` or numeric zero is introduced.

**Automation:** New unit test.

---

### TC0008: Slugify handles non-ASCII and punctuation

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXGN edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | A team name contains diacritics, ampersands, spaces, or punctuation. | The name is a valid provider label but not a stable URL-safe slug. |
| When | `slugify` runs. | It normalizes diacritics, maps ampersands to `and`, lowercases, and collapses punctuation to hyphens. |
| Then | Assert exact representative outputs. | Slugs are ASCII-stable and do not begin/end with hyphens. |

**Assertions:**

- [ ] Diacritics are removed with NFKD normalization.
- [ ] Ampersand becomes `and`.
- [ ] Repeated punctuation does not produce duplicate separators.

**Automation:** New unit test.

---

### TC0009: Repeated team identity is reusable across games

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXGN edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | Two game payloads contain the same team ID and name in different games. | The source records differ by game, but the team identity inputs are the same. |
| When | Normalize both payloads. | Both participant team objects carry equal external ID and slug values. |
| Then | Compare the team identity fields. | Downstream persistence can reuse one canonical team row instead of creating a per-game team identity. |

**Assertions:**

- [ ] Equal team IDs produce equal team slugs and external IDs.
- [ ] Different game keys do not collapse into one game record.

**Automation:** New unit test.

---

### TC0010: Payload hash changes only with payload content

**Type:** Unit | **Priority:** Medium | **Story:** US-01M2QXGN edge case

| Step | Action | Expected Result |
| ------ | -------- | ----------------- |
| Given | Two references contain the same serialized payload and a third changes one payload value. | The first two represent identical serialized content; the third does not. |
| When | Compute `getPayloadHash` for each. | Identical serialized content has the same hash and changed content has a different hash. |
| Then | Do not compare differently ordered object keys. | Key-order canonicalization remains outside this story's contract. |

**Assertions:**

- [ ] Same serialized input produces equal SHA-256 output.
- [ ] A changed payload value produces a different output.

**Automation:** New unit test.

---

## Fixtures

```yaml
complete_game:
  id: 401858209
  season: 2026
  week: 2
  startDate: 2026-09-05T19:30:00Z
  completed: true
  homeTeam: Duke
  homeId: 150
  homePoints: 17
  awayTeam: Tulane
  awayId: 2655
  awayPoints: 3
minimal_game:
  id: 401858209
  season: 2026
  homeId: 150
  awayId: 2655
missing_id: {}
missing_date:
  id: 401858209
  season: 2026
  homeTeam: Duke
  homeId: 150
  awayTeam: Tulane
  awayId: 2655
null_scores:
  id: 401858209
  season: 2026
  homePoints: null
  awayPoints: null
```

---

## Automation Status

| TC | Title | Status | Implementation |
| --- | --- | --- | --- |
| TC0001 | Complete provider game becomes a canonical master game | Automated | `src/ingestion/normalize.test.js` |
| TC0002 | Keeps canonical identity stable for repeated payloads | Automated | `src/ingestion/normalize.test.js` |
| TC0003 | Missing optional enrichment does not invent data | Automated | `src/ingestion/normalize.test.js` |
| TC0004 | Missing external game ID is rejected | Automated | `src/ingestion/normalize.test.js` |
| TC0005 | Missing team names use stable fallback identity | Automated | `src/ingestion/normalize.test.js` |
| TC0006 | Missing start date uses deterministic date key | Automated | `src/ingestion/normalize.test.js` |
| TC0007 | Null or absent scores remain null | Automated | `src/ingestion/normalize.test.js` |
| TC0008 | Slugify handles non-ASCII and punctuation | Automated | `src/ingestion/normalize.test.js` |
| TC0009 | Repeated team identity is reusable across games | Automated | `src/ingestion/normalize.test.js` |
| TC0010 | Payload hash changes only with payload content | Automated | `src/ingestion/normalize.test.js` |
| TC0011 | Provider status branches remain explicit | Automated | `src/ingestion/normalize.test.js` |

---

## Traceability

| Artefact | Reference |
| ---------- | ----------- |
| PRD | [sdlc-studio/prd.md](../prd.md) |
| Epic | [EP-01M2QXM7](../epics/EP-01M2QXM7-canonical-sports-data-and-verified-facts.md) |
| Story | [US-01M2QXGN](../stories/US-01M2QXGN-normalize-provider-games-into-canonical-records.md) |
| TSD | [sdlc-studio/tsd.md](../tsd.md) |

---

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-09-17 | SDLC Studio story plan | Created the AC coverage matrix, unit test cases, fixtures, and current automation baseline. |
| 2026-09-17 | Three Amigos | Added repeated-team and payload-content hash cases and corrected relative links. |
| 2026-09-17 | TDD implementation | Automated all ten unit cases in `src/ingestion/normalize.test.js`. |
