import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateMediaGuide } from './schema.js';

const guidePath = fileURLToPath(new URL('../../data/media-guides/2026.json', import.meta.url));
let cachedGuide;
let cachedPath;

export function loadMediaGuide({ edition = 2026, path = guidePath } = {}) {
  if (edition !== 2026) throw new Error(`No curated media guide is available for ${edition}`);
  if (!cachedGuide || cachedPath !== path) {
    cachedGuide = JSON.parse(readFileSync(path, 'utf8'));
    validateMediaGuide(cachedGuide);
    cachedPath = path;
  }
  return cachedGuide;
}

export function clearMediaGuideCache() {
  cachedGuide = undefined;
  cachedPath = undefined;
}
