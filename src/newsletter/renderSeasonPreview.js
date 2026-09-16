import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mjml2html from 'mjml';

const templatePath = fileURLToPath(new URL('../../templates/2026-season-outlook.mjml', import.meta.url));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildRows(rows, columns) {
  return rows.map((row) => `
    <tr style="border-bottom:1px solid #b5ad9f;">
      ${columns.map(([key, align = 'left']) => `<td align="${align}" style="padding:5px 4px;">${escapeHtml(row[key])}</td>`).join('')}
    </tr>
  `).join('');
}

export async function renderSeasonPreview(data) {
  const template = await readFile(templatePath, 'utf8');
  const context = data.context || {};
  const review = data.previousSeason || {};
  const values = {
    headline: escapeHtml(data.headline),
    subheadline: escapeHtml(data.subheadline),
    previous_record: escapeHtml(`${review.record?.wins ?? '-'}-${review.record?.losses ?? '-'} last season; ${context.returningLettermen ?? '-'} lettermen return.`),
    outlook: escapeHtml(context.notes?.[1] || 'The media guide provides the preseason baseline; live results take precedence once the season begins.'),
    record_summary: escapeHtml(`${context.previousConferenceFinish || 'ACC season'} after a ${context.previousConferenceRecord?.wins ?? '-'}-${context.previousConferenceRecord?.losses ?? '-'} conference campaign.`),
    featured_rows: buildRows(data.featuredPlayers || [], [['name'], ['position'], ['class'], ['hometown']]),
    position_rows: buildRows(data.positionalBreakdown || [], [['position'], ['total', 'right'], ['returning', 'right'], ['portal', 'right'], ['signee', 'right']]),
    portal_rows: buildRows(data.portalAdditions || [], [['name'], ['position'], ['previousProgram']]),
    schedule_rows: buildRows(data.schedule || [], [['date'], ['opponent'], ['site'], ['network'], ['time']]),
    review_rows: buildRows((review.notableFacts || []).map((statement) => ({ statement })), [['statement']]),
    history_rows: buildRows(data.historicalFacts || [], [['statement']]),
    player_history_rows: buildRows(data.historicalPlayers || [], [['name'], ['position'], ['era'], ['honors']]),
  };
  const rendered = template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => values[key] ?? '');
  const result = await mjml2html(rendered, { validationLevel: 'strict' });
  if (result.errors?.length) throw new Error(`MJML validation failed: ${JSON.stringify(result.errors)}`);
  return result.html;
}
