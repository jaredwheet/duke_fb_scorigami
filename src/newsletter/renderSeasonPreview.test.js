import { loadMediaGuide } from '../mediaGuide/loadGuide.js';
import { buildSeasonPreviewData } from './guideContext.js';
import { renderSeasonPreview } from './renderSeasonPreview.js';

test('renders the guide-backed season preview', async () => {
  const html = await renderSeasonPreview(buildSeasonPreviewData({ guide: loadMediaGuide() }));

  expect(html).toContain('2026 DUKE FOOTBALL OUTLOOK');
  expect(html).toContain('Nate Sheppard');
  expect(html).toContain('Tulane');
  expect(html).toContain('PORTAL ADDITIONS');
  expect(html).toContain('2025 REVIEW');
  expect(html).toContain('HISTORICAL PLAYERS');
  expect(html).toContain('Ace Parker');
});
