import 'dotenv/config';
import { loadMediaGuide } from './loadGuide.js';
import { buildGuideClaimRows, getGuideSourceHash } from './mediaGuideRepository.js';

const guide = loadMediaGuide();
const supabase = (await import('../supabaseClient.js')).default;
const sourceHash = getGuideSourceHash(guide);

const { data: edition, error: editionError } = await supabase
  .from('media_guide_editions')
  .upsert({
    edition_year: guide.edition,
    title: guide.title,
    source_file: guide.source.file,
    page_count: guide.source.pageCount,
    source_sha256: sourceHash,
    reviewed_at: guide.source.reviewedAt,
  }, { onConflict: 'edition_year' })
  .select('id')
  .single();
if (editionError) throw editionError;

const claims = buildGuideClaimRows(guide).map((claim) => ({
  edition_id: edition.id,
  ...claim,
}));
const { error: claimError } = await supabase
  .from('media_guide_claims')
  .upsert(claims, { onConflict: 'edition_id,claim_key' });
if (claimError) throw claimError;

console.log(`Imported ${claims.length} verified media-guide claim(s) for ${guide.edition}.`);
