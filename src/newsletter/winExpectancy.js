import sharp from 'sharp';

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameTeam(value, name) {
  return String(value || '').toLowerCase() === String(name || '').toLowerCase();
}

function orderedPlays(plays) {
  return (plays || []).map((play, index) => ({ play, index })).sort((left, right) => {
    const leftWallclock = Date.parse(left.play.wallclock || '');
    const rightWallclock = Date.parse(right.play.wallclock || '');
    if (Number.isFinite(leftWallclock) && Number.isFinite(rightWallclock) && leftWallclock !== rightWallclock) return leftWallclock - rightWallclock;
    const periodDifference = number(left.play.period) - number(right.play.period);
    if (periodDifference !== 0) return periodDifference;
    const leftClock = (number(left.play.clock?.minutes) || 0) * 60 + (number(left.play.clock?.seconds) || 0);
    const rightClock = (number(right.play.clock?.minutes) || 0) * 60 + (number(right.play.clock?.seconds) || 0);
    if (leftClock !== rightClock) return rightClock - leftClock;
    return left.index - right.index;
  });
}

function timeRemaining(play) {
  const period = number(play.period);
  if (period == null || period >= 5) return 0;
  const minutes = number(play.clock?.minutes) || 0;
  const seconds = number(play.clock?.seconds) || 0;
  return Math.max(0, (4 - period) * 900 + minutes * 60 + seconds);
}

function expectancyForPlay(play, dukeName, opponentName) {
  const dukeScore = number(play.offense === dukeName ? play.offenseScore : play.defenseScore);
  const opponentScore = number(play.offense === opponentName ? play.offenseScore : play.defenseScore);
  if (dukeScore == null || opponentScore == null) return null;

  const remaining = timeRemaining(play);
  const scale = 6 + (18 * remaining / 3600);
  const possession = sameTeam(play.offense, dukeName) ? 0.18 : sameTeam(play.offense, opponentName) ? -0.18 : 0;
  const probability = 1 / (1 + Math.exp(-((dukeScore - opponentScore) / scale + possession)));
  return {
    probability,
    expectancy: Math.max(-50, Math.min(50, (probability - 0.5) * 100)),
    period: number(play.period),
    time: `${String(number(play.clock?.minutes) || 0).padStart(2, '0')}:${String(number(play.clock?.seconds) || 0).padStart(2, '0')}`,
    playText: play.playText || null,
  };
}

export function calculateWinExpectancySnapshots({
  plays = [],
  dukeName = 'Duke',
  opponentName,
  dukeScore,
  opponentScore,
} = {}) {
  const snapshots = [{ progress: 0, expectancy: 0, probability: 0.5, label: 'Kickoff' }];
  const gamePlays = orderedPlays(plays);
  for (const { play } of gamePlays) {
    const result = expectancyForPlay(play, dukeName, opponentName);
    if (!result) continue;
    const remaining = timeRemaining(play);
    snapshots.push({
      ...result,
      progress: 1 - (remaining / 3600),
    });
  }

  const finalDukeScore = number(dukeScore);
  const finalOpponentScore = number(opponentScore);
  if (finalDukeScore != null && finalOpponentScore != null) {
    const finalExpectancy = finalDukeScore === finalOpponentScore
      ? 0
      : finalDukeScore > finalOpponentScore ? 50 : -50;
    snapshots.push({
      progress: 1,
      expectancy: finalExpectancy,
      probability: finalExpectancy > 0 ? 1 : finalExpectancy < 0 ? 0 : 0.5,
      label: 'Final',
    });
  }

  return snapshots;
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function renderWinExpectancySvg(snapshots, { width = 720, height = 300 } = {}) {
  const margin = { top: 32, right: 18, bottom: 34, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = (progress) => margin.left + Math.max(0, Math.min(1, progress)) * plotWidth;
  const y = (expectancy) => margin.top + ((50 - Math.max(-50, Math.min(50, expectancy))) / 100) * plotHeight;
  const midpoint = y(0);
  const points = snapshots.map((snapshot) => `${x(snapshot.progress).toFixed(1)},${y(snapshot.expectancy).toFixed(1)}`);
  const line = points.join(' ');
  const linePath = points.join(' L ');
  const area = points.length > 0
    ? `M ${linePath} L ${x(snapshots.at(-1).progress).toFixed(1)},${midpoint.toFixed(1)} L ${x(snapshots[0].progress).toFixed(1)},${midpoint.toFixed(1)} Z`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f8f4ea"/>
    <text x="${margin.left}" y="18" font-family="Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="2" fill="#101820">DUKE WIN EXPECTANCY</text>
    <text x="${width - margin.right}" y="18" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="#607080">PLAY-BY-PLAY MODEL</text>
    <line x1="${margin.left}" y1="${y(50)}" x2="${width - margin.right}" y2="${y(50)}" stroke="#d9d2c3" stroke-width="1"/>
    <line x1="${margin.left}" y1="${midpoint}" x2="${width - margin.right}" y2="${midpoint}" stroke="#101820" stroke-width="1.5"/>
    <line x1="${margin.left}" y1="${y(-50)}" x2="${width - margin.right}" y2="${y(-50)}" stroke="#d9d2c3" stroke-width="1"/>
    <text x="${margin.left - 8}" y="${y(50) + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="#003087">DUKE</text>
    <text x="${margin.left - 8}" y="${midpoint + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="#607080">50/50</text>
    <text x="${margin.left - 8}" y="${y(-50) + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="#8b2f2f">OPP.</text>
    <path d="${area}" fill="#003087" opacity="0.10"/>
    <polyline points="${line}" fill="none" stroke="#003087" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${margin.left}" y="${height - 10}" font-family="Arial, sans-serif" font-size="10" fill="#607080">KICKOFF</text>
    <text x="${width - margin.right}" y="${height - 10}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="#607080">FINAL</text>
    <title>${escapeXml('Duke win expectancy from kickoff to final')}</title>
  </svg>`;
}

export async function renderWinExpectancyChart(snapshots, options = {}) {
  return sharp(Buffer.from(renderWinExpectancySvg(snapshots, options))).png().toBuffer();
}
