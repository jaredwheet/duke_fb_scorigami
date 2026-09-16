import { loadMediaGuide } from './loadGuide.js';
import { buildSeasonPreviewData } from '../newsletter/guideContext.js';

console.log(JSON.stringify(buildSeasonPreviewData({ guide: loadMediaGuide() }), null, 2));
