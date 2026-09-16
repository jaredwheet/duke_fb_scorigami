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
      <td style="padding:6px 4px;">${escapeHtml(row.team)}</td>
      <td align="right" style="padding:6px 4px;">${escapeHtml(row.q1)}</td>
      <td align="right" style="padding:6px 4px;">${escapeHtml(row.q2)}</td>
      <td align="right" style="padding:6px 4px;">${escapeHtml(row.q3)}</td>
      <td align="right" style="padding:6px 4px;">${escapeHtml(row.q4)}</td>
      <td align="right" style="padding:6px 4px;font-weight:700;">${escapeHtml(row.final)}</td>
    </tr>
  `).join('');
}

function buildScoringRows(rows = []) {
  return rows.map((row) => `
    <tr>
      <td style="padding:4px 4px;">${escapeHtml(row.team)}</td>
      <td style="padding:4px 4px;">${escapeHtml(row.period)}</td>
      <td style="padding:4px 4px;">${escapeHtml(row.description)}</td>
    </tr>
  `).join('');
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
    return key.endsWith('_rows') ? value : escapeHtml(value);
  });
  const result = await mjml2html(rendered, { validationLevel: 'strict' });
  const errors = result.errors || [];
  if (errors.length > 0) {
    throw new Error(`MJML validation failed: ${JSON.stringify(errors)}`);
  }
  return result.html;
}
