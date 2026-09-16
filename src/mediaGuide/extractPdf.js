import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pdf } from 'pdf-parse';

export async function extractMediaGuide(filePath) {
  const result = await pdf(await readFile(filePath));
  return {
    source: {
      file: filePath,
      pageCount: result.total,
      info: result.info || {},
    },
    pages: result.pages.map(({ num, text }) => ({ pdfPage: num, text })),
  };
}

async function main() {
  const input = resolve(process.argv[2] || 'data/2026_Duke_Football_Media_Guide.pdf');
  const output = resolve(process.argv[3] || 'data/generated/media-guide/2026-raw-pages.json');
  const extracted = await extractMediaGuide(input);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(extracted, null, 2)}\n`);
  console.log(`Extracted ${extracted.source.pageCount} page(s) to ${output}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Media-guide extraction failed:', error);
    process.exitCode = 1;
  });
}
