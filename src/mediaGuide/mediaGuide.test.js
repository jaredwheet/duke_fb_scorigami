import { loadMediaGuide } from './loadGuide.js';
import { calculateComebackFact, calculateRecordWatch } from './guideFacts.js';
import { buildGuideClaimRows, getGuideSourceHash, importMediaGuideClaims } from './mediaGuideRepository.js';
import { buildCurationReport } from './curateGuide.js';
import { extractMediaGuide } from './extractPdf.js';
import { validateMediaGuide } from './schema.js';
import { buildOpponentHistory, buildSeasonPreviewData, buildGuideContext } from '../newsletter/guideContext.js';
import { fileURLToPath } from 'node:url';

test('loads the reviewed 2026 guide artifact with citations', () => {
  const guide = loadMediaGuide();

  expect(guide.source.pageCount).toBe(308);
  expect(guide.seasonContext[0].schedule).toHaveLength(12);
  expect(guide.citations['record-book'].pageStart).toBe(127);
  expect(guide.opponentSeries).toHaveLength(12);
});

test('QMY AC1 validates the checked-in 2026 PDF and JSON through curation and preview', async () => {
  const pdfPath = fileURLToPath(new URL('../../data/2026_Duke_Football_Media_Guide.pdf', import.meta.url));
  const report = await buildCurationReport({ rawPages: await extractMediaGuide(pdfPath) });

  expect(report).toMatchObject({ edition: 2026, sourcePageCount: 308, curatedClaims: 33, missingMarkers: [], status: 'ready' });
  expect(buildSeasonPreviewData({ guide: loadMediaGuide() })).toMatchObject({ season: 2026 });
});

test('QMY AC1 marks curation review-required when a required source marker is absent', async () => {
  const guide = loadMediaGuide();
  await expect(buildCurationReport({ guide, rawPages: { source: { pageCount: 308 }, pages: [{ text: '2026 SCHEDULE' }] } }))
    .resolves.toMatchObject({ status: 'review_required', missingMarkers: expect.arrayContaining(['2026 ROSTER']) });
});

test('QMY AC1 rejects a claim with an unresolved citation ID', () => {
  const guide = structuredClone(loadMediaGuide());
  guide.seasonContext[0].citationId = 'missing-citation';
  expect(() => validateMediaGuide(guide)).toThrow('citationId does not resolve');
});

test('QMY AC1 rejects citation pages outside the checked-in source', () => {
  const guide = structuredClone(loadMediaGuide());
  guide.citations.preview.pageEnd = 309;
  expect(() => validateMediaGuide(guide)).toThrow('pageEnd exceeds source.pageCount');
});

test('QMY AC1 rejects blank and duplicate claim IDs', () => {
  const blank = structuredClone(loadMediaGuide());
  blank.seasonContext[0].id = '   ';
  expect(() => validateMediaGuide(blank)).toThrow('id is required');

  const duplicate = structuredClone(loadMediaGuide());
  duplicate.seasonReviews[0].id = duplicate.seasonContext[0].id;
  expect(() => validateMediaGuide(duplicate)).toThrow('id is duplicated');
});

test('flattens reviewed guide sections into importable cited claims', () => {
  const rows = buildGuideClaimRows(loadMediaGuide());

  expect(rows.length).toBe(33);
  expect(rows).toContainEqual(expect.objectContaining({ claim_key: 'series-clemson', category: 'opponent_series', page_start: 36, verification_status: 'verified' }));
  expect(rows).toContainEqual(expect.objectContaining({ claim_key: 'single-game-rushing-yards', category: 'program_record', page_start: 127 }));
});

test('QMY AC2 builds 33 unique verified claim rows with bounded citations', () => {
  const guide = loadMediaGuide();
  const rows = buildGuideClaimRows(guide, getGuideSourceHash(guide));
  expect(rows).toHaveLength(33);
  expect(new Set(rows.map((row) => row.claim_key)).size).toBe(33);
  expect(rows.every((row) => row.verification_status === 'verified')).toBe(true);
  expect(rows.every((row) => row.source_sha256 === guide.source.sha256 && /^[0-9a-f]{64}$/.test(row.claim_sha256))).toBe(true);
  expect(rows.every((row) => row.page_start >= 1 && row.page_end <= 308 && row.page_end >= row.page_start)).toBe(true);
  expect(rows).toContainEqual(expect.objectContaining({ citation_id: 'series-ledgers', page_start: 36, page_end: 38 }));
});

test('QMY AC2 persists edition hash and claim provenance exactly once across two imports', async () => {
  const calls = [];
  const client = {
    rpc: async (name, payload) => {
      calls.push({ name, payload });
      return { data: [{ edition_id: 7, claim_count: 33 }], error: null };
    },
  };
  const guide = loadMediaGuide();
  const sourceHash = getGuideSourceHash(guide);
  await importMediaGuideClaims({ client, guide, sourceHash });
  await importMediaGuideClaims({ client, guide, sourceHash });

  expect(calls).toHaveLength(2);
  expect(calls[0].name).toBe('import_media_guide_claims');
  expect(calls[0].payload.p_claims).toHaveLength(33);
  expect(calls[0].payload.p_claims).toEqual(calls[1].payload.p_claims);
  expect(calls[0].payload.p_source_sha256).toBe(guide.source.sha256);
});

test('QMY AC3 renders guide-backed newsletter context from a clean cwd without generated pages', () => {
  const previousCwd = process.cwd();
  try {
    process.chdir('/var/folders/_p/mzbw1d8x6y30795nmk12rp0r0000gn/T/opencode');
    expect(loadMediaGuide().edition).toBe(2026);
    expect(buildSeasonPreviewData({ guide: loadMediaGuide() }).season).toBe(2026);
  } finally {
    process.chdir(previousCwd);
  }
});

test('detects a guide-backed single-game record watch', () => {
  const guide = loadMediaGuide();
  const result = calculateRecordWatch({
    guide,
    season: 2026,
    dukeName: 'Duke',
    opponentName: 'North Carolina',
    detailsPayload: {
      playerStats: [{ teams: [{
        team: 'Duke',
        categories: [{
          name: 'rushing',
          types: [{ name: 'YDS', athletes: [{ name: 'Test Runner', stat: '260' }] }],
        }],
      }] }],
    },
  });

  expect(result).toMatchObject({
    id: 'single-game-rushing-yards',
    status: 'record',
    player: 'Test Runner',
    value: 260,
    rank: 1,
  });
  expect(result.statement).toContain('set a new Duke record');
});

test('detects verified comeback progression and historical reference', () => {
  const guide = loadMediaGuide();
  const result = calculateComebackFact({
    guide,
    dukeName: 'Duke',
    opponentName: 'Georgia Tech',
    dukeScore: 31,
    opponentScore: 27,
    plays: [
      { playNumber: 1, period: 1, offense: 'Georgia Tech', defense: 'Duke', offenseScore: 14, defenseScore: 0, clock: { minutes: 8, seconds: 0 } },
      { playNumber: 2, period: 2, offense: 'Duke', defense: 'Georgia Tech', offenseScore: 14, defenseScore: 14, clock: { minutes: 4, seconds: 0 } },
      { playNumber: 3, period: 4, offense: 'Duke', defense: 'Georgia Tech', offenseScore: 31, defenseScore: 27, clock: { minutes: 0, seconds: 0 } },
    ],
  });

  expect(result).toMatchObject({ comeback: true, largestDeficit: 14, trailingAt: 'Q1 08:00' });
  expect(result.historicalReference).toMatchObject({ largestDeficit: 20, season: 1954 });
});

test('applies the current meeting to a guide series only after the guide cutoff', () => {
  const guide = loadMediaGuide();
  const result = buildOpponentHistory({
    guide,
    opponent: 'N.C. State',
    season: 2026,
    dukeScore: 28,
    opponentScore: 21,
  });

  expect(result).toMatchObject({ record: '45-37-5', throughSeason: 2026 });
  expect(result.statement).toContain('Duke now leads');
  expect(result.statement).toContain('three straight');
  expect(result.statement).not.toContain('guide tracks');
});

test('builds a complete season-preview data contract', () => {
  const preview = buildSeasonPreviewData({ guide: loadMediaGuide() });

  expect(preview).toMatchObject({ season: 2026, schedule: expect.any(Array), previousSeason: { season: 2025 } });
  expect(preview.featuredPlayers).toContainEqual(expect.objectContaining({ name: 'Nate Sheppard' }));
  expect(preview.historicalFacts.length).toBeGreaterThan(0);
});

test('builds opponent and history context for a game issue', () => {
  const context = buildGuideContext({
    guide: loadMediaGuide(),
    game: { season: 2026 },
    participants: [
      { team: { slug: 'duke', name: 'Duke' }, score: 31 },
      { team: { slug: 'clemson', name: 'Clemson' }, score: 27 },
    ],
    detailsPayload: {
      plays: [
        { playNumber: 1, period: 2, offense: 'Clemson', defense: 'Duke', offenseScore: 14, defenseScore: 0, clock: { minutes: 5, seconds: 0 } },
        { playNumber: 2, period: 4, offense: 'Duke', defense: 'Clemson', offenseScore: 31, defenseScore: 27, clock: { minutes: 0, seconds: 0 } },
      ],
    },
    facts: { scorigami: {} },
  });

  expect(context.opponentHistory.record).toBe('19-37-1');
  expect(context.historicalFact.statement).toContain('first victory in Death Valley');
  expect(context.comeback.largestDeficit).toBe(14);
});
