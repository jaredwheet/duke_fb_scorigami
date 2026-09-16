import { renderDevilInDetails } from './renderNewsletter.js';

test('renders the Sunday MJML template into HTML', async () => {
  const html = await renderDevilInDetails({
    headline: 'A test headline',
    issue_number: '42',
  });

  expect(html).toContain('A test headline');
  expect(html).toContain('31');
  expect(html).toContain('SCORIGAMI WATCH');
  expect(html).toContain('NEXT UP');
  expect(html).toContain('white-space:nowrap');
  expect(html).toContain('>TIME</th>');
});

test('renders optional guide-backed history sections', async () => {
  const html = await renderDevilInDetails({
    guide_context: {
      recordWatch: { statement: 'Test Runner set a new Duke record.', citation: { pageStart: 127 } },
      comeback: { comeback: true, largestDeficit: 14, trailingAt: 'Q2 05:00' },
      lateGame: { lateGameWin: true, period: 4, time: '00:30' },
      opponentHistory: { statement: 'Duke leads the series 45-37-5.' },
      historicalFact: { statement: 'Duke won a historic game.' },
    },
  });

  expect(html).toContain('RECORD WATCH');
  expect(html).toContain('FROM THE DUKE RECORD');
  expect(html).toContain('Test Runner set a new Duke record.');
  expect(html).toContain('Duke leads the series 45-37-5.');
  expect(html).toContain('LATE GAME');
  expect(html).toContain('with 00:30 to play in the fourth quarter');
  expect(html).toContain('Duke trailed by 14 points in the second quarter before rallying.');
  expect(html).toContain('font-size:14px;line-height:1.45');
});

test('renders ACC standings and final results', async () => {
  const html = await renderDevilInDetails({
    acc_context: {
      standings: [{ team: 'Duke', rank: 12, conferenceRecord: '1-0', overallRecord: '2-0' }],
      results: [{ winner: 'Clemson', loser: 'Boston College', score: '31-14' }],
      editorialBlurb: 'Clemson moved into the ACC race with a strong result.',
    },
  });

  expect(html).toContain('ACC STANDINGS');
  expect(html).toContain("YESTERDAY'S RESULTS");
  expect(html).toContain('Boston College');
  expect(html).toContain('#12 Duke');
  expect(html).toContain('>WINNER</th>');
  expect(html).toContain('>LOSER</th>');
  expect(html).toContain('31-14');
  expect(html).toContain('1-0');
  expect(html).toContain('Clemson moved into the ACC race');
});

test('renders the win-expectancy chart section when an inline image is provided', async () => {
  const html = await renderDevilInDetails({ win_expectancy: { imageSource: 'cid:duke-win-expectancy', caption: 'Chart caption' } });

  expect(html).toContain('WIN EXPECTANCY');
  expect(html).toContain('cid:duke-win-expectancy');
  expect(html).toContain('Chart caption');
});
