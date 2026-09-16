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

function buildBoxScoreRows(rows = []) {
  return rows
    .map((row) => `${escapeHtml(row.label)}: ${escapeHtml(row.value)}`)
    .join('<br />');
}

export async function renderDevilInDetails(data = {}) {
  const template = await readFile(templatePath, 'utf8');
  const values = {
    subject: 'Devil in the Details: Duke Football',
    preview_text: 'The latest Duke football score and the numbers behind it.',
    issue_date: new Date().toLocaleDateString('en-US'),
    issue_number: 'TEST',
    headline: 'The score has spoken.',
    dek: 'A sample Sunday edition generated from verified game facts.',
    box_score_rows: buildBoxScoreRows([
      { label: 'FINAL', value: 'Duke 24, Virginia 10' },
      { label: 'SCORE PAIR', value: 'First occurrence in Duke football history' },
      { label: 'STATUS', value: 'Scorigami' },
    ]),
    analysis: 'The editorial layer receives facts that were calculated by code. It does not calculate the statistics itself.',
    source_url: 'https://www.winsipedia.com/duke/schedule/2026',
    footer_text: 'This is a test edition of the Duke Football publication pilot.',
    ...data,
  };

  const rendered = template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => values[key] ?? '');
  const result = await mjml2html(rendered, { validationLevel: 'strict' });
  const errors = result.errors || [];
  if (errors.length > 0) {
    throw new Error(`MJML validation failed: ${JSON.stringify(errors)}`);
  }
  return result.html;
}
