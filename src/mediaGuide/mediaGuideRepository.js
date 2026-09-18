import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMediaGuide } from './loadGuide.js';
import { validateMediaGuide } from './schema.js';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

function sourcePath(guide) {
  return isAbsolute(guide.source.file) ? guide.source.file : resolve(repositoryRoot, guide.source.file);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function citationFor(guide, citationId) {
  const citation = guide.citations[citationId];
  return {
    citation_id: citationId,
    page_start: citation.pageStart,
    page_end: citation.pageEnd || citation.pageStart,
    source_label: citation.label,
  };
}

export function getGuideSourceHash(guide, readFile = readFileSync) {
  validateMediaGuide(guide);
  const actual = createHash('sha256').update(readFile(sourcePath(guide))).digest('hex');
  if (actual !== guide.source.sha256) throw new Error(`Media-guide source hash mismatch for ${guide.source.file}`);
  return actual;
}

export function getGuideClaimHash({ guide, claim, category, sourceHash }) {
  const citation = citationFor(guide, claim.citationId);
  const canonical = canonicalize({
    schema_version: guide.schemaVersion,
    edition: guide.edition,
    claim_key: claim.id,
    category,
    payload: claim,
    citation,
    source_sha256: sourceHash,
  });
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

export function buildGuideClaimRows(guide, sourceHash = guide.source.sha256) {
  validateMediaGuide(guide);
  if (sourceHash !== guide.source.sha256) throw new Error('Media-guide source hash does not match reviewed artifact');
  const collections = [
    ['season_context', guide.seasonContext],
    ['season_review', guide.seasonReviews],
    ['opponent_series', guide.opponentSeries],
    ['program_record', guide.programRecords],
    ['historical_fact', guide.historicalFacts],
    ['historical_player', guide.historicalPlayers || []],
    ['comeback_history', guide.comebackHistory],
  ];

  return collections.flatMap(([category, claims]) => claims.map((claim) => {
    const citation = citationFor(guide, claim.citationId);
    return {
      claim_key: claim.id,
      category,
      payload: claim,
      ...citation,
      source_sha256: sourceHash,
      claim_sha256: getGuideClaimHash({ guide, claim, category, sourceHash }),
      verification_status: 'verified',
    };
  }));
}

export async function importMediaGuideClaims({ client, guide = loadMediaGuide(), sourceHash = getGuideSourceHash(guide) } = {}) {
  if (!client) throw new Error('A service-role Supabase client is required for media-guide import');
  const rows = buildGuideClaimRows(guide, sourceHash);
  const { data, error } = await client.rpc('import_media_guide_claims', {
    p_edition_year: guide.edition,
    p_title: guide.title,
    p_source_file: guide.source.file,
    p_page_count: guide.source.pageCount,
    p_source_sha256: sourceHash,
    p_reviewed_at: guide.source.reviewedAt,
    p_claims: rows,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function loadMediaGuideClaims({ client, edition = 2026, guide = loadMediaGuide() } = {}) {
  if (!client) return buildGuideClaimRows(guide);

  const { data: editionRow, error: editionError } = await client
    .from('media_guide_editions')
    .select('id, edition_year')
    .eq('edition_year', edition)
    .maybeSingle();
  if (editionError) throw editionError;
  if (!editionRow) throw new Error(`No imported media-guide edition ${edition} is available`);

  const { data: claims, error: claimError } = await client
    .from('media_guide_claims')
    .select('claim_key, category, payload, citation_id, page_start, page_end, source_label, source_sha256, claim_sha256, verification_status')
    .eq('edition_id', editionRow.id)
    .eq('verification_status', 'verified');
  if (claimError) throw claimError;
  if (!claims?.length) throw new Error(`No verified media-guide claims are available for edition ${edition}`);
  return claims;
}
