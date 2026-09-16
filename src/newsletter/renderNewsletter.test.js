import { renderDevilInDetails } from './renderNewsletter.js';

test('renders the Sunday MJML template into HTML', async () => {
  const html = await renderDevilInDetails({
    headline: 'A test headline',
    issue_number: '42',
  });

  expect(html).toContain('A test headline');
  expect(html).toContain('Duke 24, Virginia 10');
  expect(html).toContain('VIEW THE FULL SCORE HISTORY');
});
