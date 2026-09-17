import { renderBriefNewsletter } from './renderBriefNewsletter.js';

test('renders a named brief edition with escaped section content', async () => {
  const html = await renderBriefNewsletter({
    subject: 'Watercooler',
    edition_name: 'THE WALLACE WADE WATERCOOLER',
    headline: 'The archive speaks',
    brief_sections: [{ label: 'FROM THE ARCHIVES', detail: '<verified fact>' }],
  });

  expect(html).toContain('THE WALLACE WADE WATERCOOLER');
  expect(html).toContain('&lt;verified fact&gt;');
});
