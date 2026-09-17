import sharp from 'sharp';

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderRows(rows, startY, width, rowHeight) {
  return rows.map((row, index) => {
    const y = startY + (index * rowHeight);
    return `
      <line x1="30" y1="${y + rowHeight - 1}" x2="${width - 30}" y2="${y + rowHeight - 1}" stroke="#d9d2c3" />
      <text x="${width / 2}" y="${y + 23}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#101820">${escapeXml(row.label)}</text>
      <text x="190" y="${y + 23}" text-anchor="end" font-family="Georgia, serif" font-size="22" font-weight="800" fill="#003087">${escapeXml(row.duke ?? '—')}</text>
      <text x="${width - 190}" y="${y + 23}" text-anchor="start" font-family="Georgia, serif" font-size="22" font-weight="800" fill="#8b2f2f">${escapeXml(row.opponent ?? '—')}</text>
    `;
  }).join('');
}

export async function renderBulletinMatchupChart({ dukeName = 'Duke', opponentName = 'Opponent', rows = [] } = {}) {
  const width = 760;
  const offense = rows.filter((row) => !/allowed/i.test(row.label));
  const defense = rows.filter((row) => /allowed/i.test(row.label));
  const sectionHeight = (list) => 52 + (list.length * 48);
  const height = 132 + sectionHeight(offense) + (defense.length > 0 ? sectionHeight(defense) : 0);
  let y = 0;
  const sections = (title, list) => {
    if (list.length === 0) return '';
    const section = `
      <rect x="0" y="${y}" width="${width}" height="34" fill="#101820" />
      <text x="${width / 2}" y="${y + 23}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="3" fill="#f8f4ea">${title}</text>
      ${renderRows(list, y + 42, width, 48)}
    `;
    y += sectionHeight(list);
    return section;
  };

  const body = `${sections('OFFENSE', offense)}${sections('DEFENSE', defense)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f8f4ea" />
    <rect width="100%" height="100" fill="#003087" />
    <text x="${width / 2}" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="800" letter-spacing="2" fill="#ffffff">DUKE VS ${escapeXml(opponentName).toUpperCase()}</text>
    <text x="${width / 2}" y="65" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" letter-spacing="3" fill="#d9d2c3">SEASON-TO-DATE STAT COMPARISON</text>
    <circle cx="125" cy="58" r="28" fill="#ffffff" /><text x="125" y="66" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="800" fill="#003087">D</text>
    <circle cx="${width - 125}" cy="58" r="28" fill="#ffffff" /><text x="${width - 125}" y="66" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="800" fill="#8b2f2f">${escapeXml(opponentName).slice(0, 3).toUpperCase()}</text>
    <text x="190" y="94" text-anchor="end" font-family="Arial, sans-serif" font-size="11" letter-spacing="2" font-weight="700" fill="#ffffff">${escapeXml(dukeName).toUpperCase()}</text>
    <text x="${width - 190}" y="94" text-anchor="start" font-family="Arial, sans-serif" font-size="11" letter-spacing="2" font-weight="700" fill="#ffffff">${escapeXml(opponentName).toUpperCase()}</text>
    <g transform="translate(0, 100)">${body}</g>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
