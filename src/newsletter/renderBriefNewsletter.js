import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mjml2html from 'mjml';

const templatePath = fileURLToPath(new URL('../../templates/newsletter-brief.mjml', import.meta.url));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildSectionRows(sections = []) {
  return (sections || []).map((section) => {
    const rows = section.rows?.length > 0
      ? `
        <tr style="border-bottom:1px solid #d9d2c3;">
          <th align="left" style="padding:5px 4px;font-size:10px;letter-spacing:1px;">${escapeHtml(section.label)}</th>
          ${section.rows[0].duke != null || section.rows[0].opponent != null
            ? `<th align="right" style="padding:5px 4px;font-size:10px;letter-spacing:1px;">DUKE</th><th align="right" style="padding:5px 4px;font-size:10px;letter-spacing:1px;">OPP.</th>`
            : '<th align="right" colspan="2" style="padding:5px 4px;font-size:10px;letter-spacing:1px;">DETAIL</th>'}
        </tr>
        ${section.rows.map((row) => row.duke != null || row.opponent != null
          ? `<tr><td style="padding:5px 4px;font-size:12px;">${escapeHtml(row.label)}</td><td align="right" style="padding:5px 4px;font-size:12px;font-weight:700;">${escapeHtml(row.duke ?? '—')}</td><td align="right" style="padding:5px 4px;font-size:12px;font-weight:700;">${escapeHtml(row.opponent ?? '—')}</td></tr>`
          : `<tr><td style="padding:5px 4px;font-size:12px;letter-spacing:1px;">${escapeHtml(row.label)}</td><td align="right" colspan="2" style="padding:5px 4px;font-size:13px;font-weight:700;">${escapeHtml(row.value ?? row.detail ?? '')}</td></tr>`).join('')}
      `
      : `
        <tr style="border-bottom:1px solid #b5ad9f;"><td style="padding:10px 4px 4px;font-size:11px;letter-spacing:2px;font-weight:700;">${escapeHtml(section.label)}</td></tr>
        <tr><td style="padding:4px 4px 12px;font-size:14px;line-height:1.5;">${escapeHtml(section.detail)}</td></tr>
      `;
    return rows;
  }).join('');
}

export async function renderBriefNewsletter(data = {}) {
  const template = await readFile(templatePath, 'utf8');
  const values = {
    subject: data.subject || 'Duke Football',
    preview_text: data.preview_text || '',
    edition_name: data.edition_name || 'DUKE FOOTBALL DISPATCH',
    issue_date: data.issue_date || '',
    headline: data.headline || '',
    subheadline: data.subheadline || '',
    brief_lead: data.brief_lead || '',
    section_rows: buildSectionRows(data.brief_sections),
    footer_text: data.footer_text || 'A quick read on Duke football.',
    unsubscribe_url: data.unsubscribe_url || process.env.NEWSLETTER_UNSUBSCRIBE_URL || 'https://example.invalid/unsubscribe',
    preferences_url: data.preferences_url || process.env.NEWSLETTER_PREFERENCES_URL || 'https://example.invalid/preferences',
  };
  const rendered = template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => key === 'section_rows' ? values[key] : escapeHtml(values[key]));
  const result = await mjml2html(rendered, { validationLevel: 'strict' });
  if (result.errors?.length) throw new Error(`Brief newsletter template validation failed: ${result.errors.map((error) => error.message).join('; ')}`);
  return result.html;
}
