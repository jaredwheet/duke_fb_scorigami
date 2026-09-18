import 'dotenv/config';
import { loadMediaGuide } from './loadGuide.js';
import { getGuideSourceHash, importMediaGuideClaims } from './mediaGuideRepository.js';

export { importMediaGuideClaims };

async function main() {
  const guide = loadMediaGuide();
  const supabase = (await import('../supabaseClient.js')).default;
  const result = await importMediaGuideClaims({
    client: supabase,
    guide,
    sourceHash: getGuideSourceHash(guide),
  });
  console.log(`Imported ${result.claim_count} verified media-guide claim(s) for ${guide.edition}.`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch((error) => {
    console.error('Media-guide claim import failed:', error);
    process.exitCode = 1;
  });
}
