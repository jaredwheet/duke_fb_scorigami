import { loadMediaGuide } from './loadGuide.js';
import { calculateComebackFact, calculateRecordWatch } from './guideFacts.js';
import { buildGuideClaimRows } from './mediaGuideRepository.js';
import { buildOpponentHistory, buildSeasonPreviewData, buildGuideContext } from '../newsletter/guideContext.js';

test('loads the reviewed 2026 guide artifact with citations', () => {
  const guide = loadMediaGuide();

  expect(guide.source.pageCount).toBe(308);
  expect(guide.seasonContext[0].schedule).toHaveLength(12);
  expect(guide.citations['record-book'].pageStart).toBe(127);
  expect(guide.opponentSeries).toHaveLength(12);
});

test('flattens reviewed guide sections into importable cited claims', () => {
  const rows = buildGuideClaimRows(loadMediaGuide());

  expect(rows.length).toBe(33);
  expect(rows).toContainEqual(expect.objectContaining({ claim_key: 'series-clemson', category: 'opponent_series', page_start: 36, verification_status: 'verified' }));
  expect(rows).toContainEqual(expect.objectContaining({ claim_key: 'single-game-rushing-yards', category: 'program_record', page_start: 127 }));
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
