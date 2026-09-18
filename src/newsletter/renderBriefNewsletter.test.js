import { renderBriefNewsletter } from './renderBriefNewsletter.js';

test('newsletter escape protects brief provider-controlled text', async () => {
  const html = await renderBriefNewsletter({
    subject: 'Watercooler',
    edition_name: 'THE WALLACE WADE WATERCOOLER',
    headline: 'The archive speaks',
    brief_sections: [{ label: 'FROM THE ARCHIVES', detail: '<verified fact>' }],
  });

  expect(html).toContain('THE WALLACE WADE WATERCOOLER');
  expect(html).toContain('&lt;verified fact&gt;');
});

test('renders a brief edition when optional sections are absent', async () => {
  await expect(renderBriefNewsletter({ brief_sections: null })).resolves.toContain('DUKE FOOTBALL DISPATCH');
});

test('newsletter optional sections cover watercooler and bulletin fallbacks', async () => {
  const watercooler = await renderBriefNewsletter({
    edition_name: 'THE WALLACE WADE WATERCOOLER',
    brief_sections: [{ label: 'ARCHIVE', detail: 'Verified archive fallback.' }],
  });
  const bulletin = await renderBriefNewsletter({
    edition_name: 'THE VICTORY BELL BULLETIN',
    brief_sections: [{ label: 'THE LINE', detail: 'Lines unavailable.', rows: [] }],
  });

  expect(watercooler).toContain('THE WALLACE WADE WATERCOOLER');
  expect(bulletin).toContain('THE VICTORY BELL BULLETIN');
  expect(bulletin).toContain('Lines unavailable.');
});
