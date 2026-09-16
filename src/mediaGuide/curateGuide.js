import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractMediaGuide } from './extractPdf.js';
import { loadMediaGuide } from './loadGuide.js';
import { validateMediaGuide } from './schema.js';

const requiredMarkers = [
  '2026 SCHEDULE',
  '2026 ROSTER',
  '2025 STATISTICS',
  'SERIES LEDGERS',
  'MILESTONE GAMES',
  'PASSING RECORDS',
];

export async function buildCurationReport({ rawPages, guide = loadMediaGuide() }) {
  validateMediaGuide(guide);
  const pageText = (rawPages?.pages || []).map((page) => page.text).join('\n');
  const missingMarkers = requiredMarkers.filter((marker) => !pageText.includes(marker));
  return {
    edition: guide.edition,
    curatedClaims: guide.seasonContext.length + guide.seasonReviews.length + guide.opponentSeries.length + guide.programRecords.length + guide.historicalFacts.length + (guide.historicalPlayers || []).length + guide.comebackHistory.length,
    sourcePageCount: rawPages?.source?.pageCount || null,
    missingMarkers,
    status: missingMarkers.length === 0 ? 'ready' : 'review_required',
  };
}

async function main() {
  const rawPath = resolve(process.argv[2] || 'data/generated/media-guide/2026-raw-pages.json');
  let rawPages;
  try {
    rawPages = JSON.parse(await readFile(rawPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    rawPages = await extractMediaGuide(resolve('data/2026_Duke_Football_Media_Guide.pdf'));
  }
  const report = await buildCurationReport({ rawPages });
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'ready') process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Media-guide curation failed:', error);
    process.exitCode = 1;
  });
}
