import sharp from 'sharp';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatDate(startDate) {
  if (!startDate) return '';
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).toUpperCase();
}

export async function createScorigamiCard({ dukeScore, oppScore, opponent, startDate }) {
  const safeOpponent = escapeXml(String(opponent || 'Opponent').toUpperCase());
  const date = escapeXml(formatDate(startDate));
  const opponentFontSize = safeOpponent.length > 20 ? 40 : safeOpponent.length > 14 ? 48 : 58;
  const svg = `
    <svg width="1600" height="900" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#050B14"/>
          <stop offset="0.58" stop-color="#0A1830"/>
          <stop offset="1" stop-color="#002B78"/>
        </linearGradient>
        <linearGradient id="dukeRow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#003087"/>
          <stop offset="1" stop-color="#0757C9"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#background)"/>
      <rect width="1600" height="18" fill="#5AC8FA"/>
      <rect y="882" width="1600" height="18" fill="#003087"/>
      <path d="M0 0H1600V150H0Z" fill="#FFFFFF" opacity="0.025"/>
      <path d="M1160 900L1600 460V900Z" fill="#5AC8FA" opacity="0.08"/>

      <text x="96" y="105" fill="#9DB5D1" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="6">DUKE FOOTBALL  |  FINAL</text>
      <rect x="1120" y="62" width="384" height="70" rx="35" fill="#F04444"/>
      <circle cx="1160" cy="97" r="10" fill="#FFFFFF"/>
      <text x="1190" y="108" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="800" letter-spacing="2">SCORIGAMI ALERT</text>

      <text x="1504" y="220" text-anchor="end" fill="#5AC8FA" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="3">SCOREBOARD</text>

      <rect x="96" y="270" width="1408" height="300" rx="18" fill="#0E223D" stroke="#24476F" stroke-width="2"/>
      <rect x="96" y="270" width="1408" height="142" rx="18" fill="url(#dukeRow)"/>
      <rect x="96" y="412" width="1408" height="158" fill="#102943"/>
      <line x1="96" y1="412" x2="1504" y2="412" stroke="#31557D" stroke-width="2"/>
      <text x="148" y="365" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="800">DUKE</text>
      <text x="1450" y="372" text-anchor="end" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="112" font-weight="800">${dukeScore}</text>
      <text x="148" y="510" fill="#BFD0E5" font-family="Arial, Helvetica, sans-serif" font-size="${opponentFontSize}" font-weight="700">${safeOpponent}</text>
      <text x="1450" y="520" text-anchor="end" fill="#BFD0E5" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="700">${oppScore}</text>

      <text x="96" y="670" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700">FIRST-EVER IN DUKE FOOTBALL HISTORY</text>
      <text x="96" y="750" fill="#8FA8C3" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="600">${date || 'FINAL'}  |  DUKEFBSCORIGAMI</text>
      <text x="1504" y="750" text-anchor="end" fill="#8FA8C3" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="600">@DUKEFBSCORIGAMI</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
