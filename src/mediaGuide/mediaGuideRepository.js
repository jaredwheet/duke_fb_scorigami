import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadMediaGuide } from './loadGuide.js';

function citationFor(guide, citationId) {
  const citation = guide.citations?.[citationId] || {};
  return {
    page_start: citation.pageStart,
    page_end: citation.pageEnd || citation.pageStart,
    source_label: citation.label || null,
  };
}

export function buildGuideClaimRows(guide) {
  const collections = [
    ['season_context', guide.seasonContext],
    ['season_review', guide.seasonReviews],
    ['opponent_series', guide.opponentSeries],
    ['program_record', guide.programRecords],
    ['historical_fact', guide.historicalFacts],
    ['historical_player', guide.historicalPlayers || []],
    ['comeback_history', guide.comebackHistory],
  ];

  return collections.flatMap(([category, claims]) => claims.map((claim) => ({
    claim_key: claim.id,
    category,
    payload: claim,
    ...citationFor(guide, claim.citationId),
    verification_status: 'verified',
  })));
}

export function getGuideSourceHash(guide, readFile = readFileSync) {
  const contents = readFile(guide.source.file);
  return createHash('sha256').update(contents).digest('hex');
}

export async function loadMediaGuideClaims({ client, edition = 2026, guide = loadMediaGuide() } = {}) {
  if (!client) return buildGuideClaimRows(guide);

  const { data: editionRow, error: editionError } = await client
    .from('media_guide_editions')
    .select('id, edition_year')
    .eq('edition_year', edition)
    .maybeSingle();
  if (editionError || !editionRow) return buildGuideClaimRows(guide);

  const { data: claims, error: claimError } = await client
    .from('media_guide_claims')
    .select('claim_key, category, payload, page_start, page_end, source_label, verification_status')
    .eq('edition_id', editionRow.id)
    .eq('verification_status', 'verified');
  if (claimError || !claims?.length) return buildGuideClaimRows(guide);
  return claims;
}
