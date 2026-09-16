import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mjml2html from 'mjml';

const templatePath = fileURLToPath(new URL('../../templates/devil-in-the-details.mjml', import.meta.url));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildQuarterRows(rows = []) {
  return rows.map((row) => `
    <tr style="border-bottom:1px solid #607080;">
      <td width="30%" style="padding:6px 4px;white-space:nowrap;">${escapeHtml(row.team)}</td>
      <td width="14%" align="right" style="padding:6px 4px;white-space:nowrap;">${escapeHtml(row.q1)}</td>
      <td width="14%" align="right" style="padding:6px 4px;white-space:nowrap;">${escapeHtml(row.q2)}</td>
      <td width="14%" align="right" style="padding:6px 4px;white-space:nowrap;">${escapeHtml(row.q3)}</td>
      <td width="14%" align="right" style="padding:6px 4px;white-space:nowrap;">${escapeHtml(row.q4)}</td>
      <td width="14%" align="right" style="padding:6px 4px;font-weight:700;white-space:nowrap;">${escapeHtml(row.final)}</td>
    </tr>
  `).join('');
}

function buildScoringRows(rows = []) {
  const quarterNames = ['FIRST QUARTER', 'SECOND QUARTER', 'THIRD QUARTER', 'FOURTH QUARTER'];
  let previousQuarter = null;
  return rows.map((row) => {
    const quarterHeading = previousQuarter === row.quarter ? '' : `<tr><th colspan="3" align="left" style="padding:8px 0 3px;font-size:10px;letter-spacing:1px;">${escapeHtml(quarterNames[(row.quarter || 1) - 1] || 'SCORING PLAYS')}</th></tr>`;
    previousQuarter = row.quarter;
    return `
      ${quarterHeading}
      <tr style="border-bottom:1px solid #607080;">
        <td width="16%" style="padding:4px 6px 4px 0;white-space:nowrap;vertical-align:top;">${escapeHtml(row.team)}</td>
        <td width="24%" style="padding:4px 6px 4px 0;white-space:nowrap;vertical-align:top;">${escapeHtml(row.period)}</td>
        <td width="60%" style="padding:4px 0;vertical-align:top;">${escapeHtml(row.description)}</td>
      </tr>
    `;
  }).join('');
}

function buildLeaderRows(title, rows = []) {
  if (rows.length === 0) return '';
  return `
    <tr>
      <td colspan="2" style="padding:7px 4px 3px;font-weight:700;border-bottom:1px solid #101820;">${escapeHtml(title)}</td>
    </tr>
    ${rows.map((row) => `
      <tr>
        <td style="padding:4px 4px;">${escapeHtml(row.name)}</td>
        <td align="right" style="padding:4px 4px;">${escapeHtml(row.line)}</td>
      </tr>
    `).join('')}
  `;
}

function buildAccRows(rows = []) {
  return rows.map((row) => `
    <tr style="border-bottom:1px solid #b5ad9f;">
      <td style="padding:5px 4px;">${escapeHtml(row.away)}</td>
      <td style="padding:5px 4px;">${escapeHtml(row.home)}</td>
      <td align="right" style="padding:5px 4px;font-weight:700;">${escapeHtml(row.score)}</td>
    </tr>
  `).join('');
}

function formatGameMoment(value) {
  const match = String(value || '').match(/^Q([1-4])\s+(\d{2}:\d{2})$/);
  if (!match) return null;
  const quarter = ['first', 'second', 'third', 'fourth'][Number(match[1]) - 1];
  return `with ${match[2]} left in the ${quarter} quarter`;
}

function buildGuideSections(context = null) {
  if (!context) return '';
  const blocks = [];

  if (context.recordWatch) {
    blocks.push(`
      <mj-section background-color="#003087" padding="20px 24px">
        <mj-column>
          <mj-text color="#ffffff" font-size="12px" letter-spacing="3px" font-weight="700">RECORD WATCH</mj-text>
          <mj-text color="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="22px" line-height="1.2" font-weight="800" padding-top="8px">${escapeHtml(context.recordWatch.statement)}</mj-text>
          <mj-text color="#ffffff" font-size="10px" padding-top="8px">Media guide, p. ${escapeHtml(context.recordWatch.citation?.pageStart)}</mj-text>
        </mj-column>
      </mj-section>
    `);
  }

  const facts = [
    context.comeback?.comeback
      ? { label: 'COMEBACK', detail: `Duke erased a ${context.comeback.largestDeficit}-point deficit${formatGameMoment(context.comeback.trailingAt) ? ` ${formatGameMoment(context.comeback.trailingAt)}` : ''}.` }
      : null,
    context.lateGame?.lateGameWin
      ? { label: 'LATE GAME', detail: Number(context.lateGame.period) >= 5
        ? 'Duke took the lead in overtime.'
        : `Duke took the lead with ${context.lateGame.time} left in the ${['first', 'second', 'third', 'fourth'][Number(context.lateGame.period) - 1]} quarter.` }
      : null,
    context.opponentHistory
      ? { label: 'SERIES', detail: context.opponentHistory.statement }
      : null,
    context.historicalFact
      ? { label: 'DUKE HISTORY', detail: context.historicalFact.statement }
      : null,
  ].filter(Boolean);

  if (facts.length > 0) {
    blocks.push(`
      <mj-section background-color="#f8f4ea" padding="20px 24px 18px">
        <mj-column>
          <mj-text font-size="12px" letter-spacing="3px" font-weight="700">FROM THE DUKE RECORD</mj-text>
          ${facts.map((fact) => `
            <mj-text font-size="11px" line-height="1.2" letter-spacing="2px" font-weight="700" padding-top="16px">${escapeHtml(fact.label)}</mj-text>
            <mj-text font-size="14px" line-height="1.45" padding-top="5px">${escapeHtml(fact.detail)}</mj-text>
          `).join('')}
        </mj-column>
      </mj-section>
    `);
  }

  return blocks.join('');
}

const defaultData = {
  subject: 'Devil in the Details: Duke Football',
  preview_text: 'The latest Duke football score and the numbers behind it.',
  issue_date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  issue_number: 'TEST',
  headline: 'DUKE COMES ALIVE IN THE FOURTH',
  subheadline: 'Blue Devils erase a 14-point deficit to win 31–27.',
  narrative: 'A sample Sunday lead written from verified game facts. The turning point, win-probability swing, and player context will be supplied by the editorial layer without changing the underlying numbers.',
  quarters: [
    { team: 'Duke', q1: 7, q2: 7, q3: 0, q4: 17, final: 31 },
    { team: 'Virginia', q1: 14, q2: 3, q3: 7, q4: 3, final: 27 },
  ],
  scoring_plays: [
    { team: 'DUKE', period: 'Q1 10:14', description: '12-yard touchdown pass (kick good)' },
    { team: 'VIR', period: 'Q4 02:18', description: 'Field goal, 38 yards' },
  ],
  numbers: [
    { value: '17', label: 'FOURTH-QUARTER POINTS', detail: 'The final-quarter surge.' },
    { value: '4', label: 'SACKS ALLOWED', detail: 'A long afternoon in the pocket.' },
    { value: '+3', label: 'TURNOVER MARGIN', detail: 'The hidden scoreboard.' },
  ],
  leaders: {
    passing: [{ name: 'Duke QB', line: '24-36, 286 YDS, 2 TD, 1 INT' }],
    rushing: [{ name: 'Duke RB', line: '18 CAR, 104 YDS, 1 TD' }],
    receiving: [{ name: 'Duke WR', line: '7 REC, 118 YDS, 1 TD' }],
    defense: [{ name: 'Duke LB', line: '11 TKL, 2 SACKS' }],
  },
  scorigami_status: 'FAMILIAR TERRITORY.',
  scorigami_context: '31–27 has happened twice before in Duke football history. The most recent occurrence was 2021.',
  acc_scores: [
    { away: 'Clemson', home: 'Boston College', score: '24–17' },
    { away: 'Virginia Tech', home: 'North Carolina', score: '31–28' },
    { away: 'Miami', home: 'Louisville', score: '27–20' },
  ],
  next_opponent: 'Virginia Tech',
  next_details: 'Saturday, September 26 · 3:30 PM ET · Wallace Wade Stadium · TV: TBD',
  source_url: 'https://www.winsipedia.com/duke/schedule/2026',
  footer_text: 'This is a test edition of the Duke Football publication pilot.',
  unsubscribe_url: 'https://example.com/unsubscribe',
  preferences_url: 'https://example.com/preferences',
};

export async function renderDevilInDetails(data = {}) {
  const template = await readFile(templatePath, 'utf8');
  const input = { ...defaultData, ...data };
  const values = {
    ...input,
    quarter_rows: buildQuarterRows(input.quarters),
    scoring_rows: buildScoringRows(input.scoring_plays),
    guide_sections: buildGuideSections(input.guide_context),
    passing_rows: buildLeaderRows('PASSING', input.leaders?.passing),
    rushing_rows: buildLeaderRows('RUSHING', input.leaders?.rushing),
    receiving_rows: buildLeaderRows('RECEIVING', input.leaders?.receiving),
    defense_rows: buildLeaderRows('DEFENSE', input.leaders?.defense),
    acc_rows: buildAccRows(input.acc_scores),
    number_one_value: input.numbers?.[0]?.value || '',
    number_one_label: input.numbers?.[0]?.label || '',
    number_one_detail: input.numbers?.[0]?.detail || '',
    number_two_value: input.numbers?.[1]?.value || '',
    number_two_label: input.numbers?.[1]?.label || '',
    number_two_detail: input.numbers?.[1]?.detail || '',
    number_three_value: input.numbers?.[2]?.value || '',
    number_three_label: input.numbers?.[2]?.label || '',
    number_three_detail: input.numbers?.[2]?.detail || '',
  };

  const rendered = template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
    const value = values[key] ?? '';
    return key.endsWith('_rows') || key.endsWith('_sections') ? value : escapeHtml(value);
  });
  const result = await mjml2html(rendered, { validationLevel: 'strict' });
  const errors = result.errors || [];
  if (errors.length > 0) {
    throw new Error(`MJML validation failed: ${JSON.stringify(errors)}`);
  }
  return result.html;
}
