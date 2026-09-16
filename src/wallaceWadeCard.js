import fetch from 'node-fetch';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { editWallaceWadeScreen } from './openaiImageEditor.js';

const sourceImageUrl = new URL('../assets/wallace-wade.webp', import.meta.url);
const logoCache = new Map();

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function teamSlug(teamName) {
  const overrides = {
    'Duke': 'duke',
    'Miami (FL)': 'miami-fl',
    'NC State': 'north-carolina-state',
    'North Carolina State': 'north-carolina-state',
    'UConn': 'connecticut',
    'Virginia Tech': 'virginia-tech',
  };
  if (overrides[teamName]) return overrides[teamName];
  return teamName
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getTeamLogo(teamName) {
  const slug = teamSlug(teamName);
  if (logoCache.has(slug)) return logoCache.get(slug);

  try {
    const response = await fetch(`https://www.winsipedia.com/images/team-logos/${slug}.png`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const logo = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(34, 34, { fit: 'contain' })
      .png()
      .toBuffer();
    logoCache.set(slug, logo);
    return logo;
  } catch (error) {
    console.warn(`Unable to load ${teamName} logo:`, error.message);
    return null;
  }
}

function formatDate(startDate) {
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return 'FINAL';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).toUpperCase();
}

function getMask(width, height) {
  const mask = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#000000"/>
      <rect x="365" y="180" width="540" height="350" fill="transparent"/>
    </svg>
  `;
  return sharp(Buffer.from(mask)).png().toBuffer();
}

function initial(teamName) {
  return escapeXml(String(teamName || '?').trim().charAt(0).toUpperCase());
}

function buildOverlay({ dukeScore, oppScore, opponent, startDate, dukeLogo, opponentLogo }) {
  const safeOpponent = escapeXml(String(opponent || 'Opponent').toUpperCase());
  const opponentFontSize = safeOpponent.length > 20 ? 27 : safeOpponent.length > 14 ? 31 : 35;
  const date = escapeXml(formatDate(startDate));
  const dukeFallback = dukeLogo ? '' : `<circle cx="305" cy="553" r="17" fill="#003087"/><text x="305" y="561" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="19" font-weight="800">D</text>`;
  const opponentFallback = opponentLogo
    ? ''
    : `<circle cx="815" cy="553" r="17" fill="#E57200"/><text x="815" y="561" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="18" font-weight="800">${initial(opponent)}</text>`;

  return `
    <svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="screenShade" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="#06152B" stop-opacity="0.70"/>
          <stop offset="1" stop-color="#020A18" stop-opacity="0.72"/>
        </linearGradient>
        <pattern id="scanlines" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 0H8" stroke="#5AC8FA" stroke-opacity="0.10"/>
        </pattern>
      </defs>

      <rect x="365" y="180" width="540" height="350" fill="url(#screenShade)"/>
      <rect x="365" y="180" width="540" height="350" fill="url(#scanlines)"/>
      <rect x="365" y="180" width="540" height="350" fill="none" stroke="#5AC8FA" stroke-opacity="0.75" stroke-width="4"/>
      <text x="635" y="238" text-anchor="middle" fill="#5AC8FA" font-family="Arial, sans-serif" font-size="27" font-weight="800" letter-spacing="4">DUKE SCORIGAMI</text>
      <text x="635" y="292" text-anchor="middle" fill="#BFD0E5" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">FINAL SCORE</text>
      <text x="635" y="408" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="116" font-weight="900">${dukeScore} - ${oppScore}</text>
      <text x="635" y="468" text-anchor="middle" fill="#BFD0E5" font-family="Arial, sans-serif" font-size="31" font-weight="700">DUKE  |  ${safeOpponent}</text>
      <rect x="478" y="485" width="315" height="35" rx="17" fill="#F04444"/>
      <text x="635" y="510" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="17" font-weight="800" letter-spacing="2">FIRST-EVER SCORE PAIR</text>

      <rect x="280" y="526" width="170" height="55" fill="#06152B" fill-opacity="0.92"/>
      ${dukeFallback}
      <text x="326" y="562" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="15" font-weight="800">DUKE</text>
      <text x="438" y="565" text-anchor="end" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="27" font-weight="900">${dukeScore}</text>

      <rect x="790" y="526" width="170" height="55" fill="#06152B" fill-opacity="0.92"/>
      ${opponentFallback}
      <text x="836" y="562" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${opponentFontSize}" font-weight="800">${safeOpponent}</text>
      <text x="948" y="565" text-anchor="end" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="27" font-weight="900">${oppScore}</text>
    </svg>
  `;
}

export async function createWallaceWadeCard({ dukeScore, oppScore, opponent, startDate }) {
  const sourceImage = await readFile(sourceImageUrl);
  const sourceMetadata = await sharp(sourceImage).metadata();
  const width = sourceMetadata.width || 1200;
  const height = sourceMetadata.height || 800;
  const mask = await getMask(width, height);
  let background = sourceImage;

  try {
    background = await editWallaceWadeScreen(sourceImage, mask);
    background = await sharp(background)
      .resize(width, height, { fit: 'cover' })
      .png()
      .toBuffer();
  } catch (error) {
    console.warn('OpenAI Wallace Wade edit failed; using the reference photo:', error.message);
  }

  const [dukeLogo, opponentLogo] = await Promise.all([
    getTeamLogo('Duke'),
    getTeamLogo(opponent),
  ]);
  const composites = [{ input: Buffer.from(buildOverlay({
    dukeScore,
    oppScore,
    opponent,
    startDate,
    dukeLogo,
    opponentLogo,
  })) }];
  if (dukeLogo) composites.push({ input: dukeLogo, top: 536, left: 288 });
  if (opponentLogo) composites.push({ input: opponentLogo, top: 536, left: 798 });

  return sharp(background).composite(composites).png().toBuffer();
}
