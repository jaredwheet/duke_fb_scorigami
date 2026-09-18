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

test('newsletter HTML uses fact-packet values without recalculation', async () => {
  const html = await renderDevilInDetails({
    headline: 'Packet headline',
    quarters: [{ team: 'Packet Team', q1: 0, q2: 1, q3: 2, q4: 3, final: 99 }],
    numbers: [{ value: 0, label: 'PACKET ZERO', detail: 'From the verified packet.' }],
    next_opponent: 'Packet Opponent',
  });

  expect(html).toContain('Packet headline');
  expect(html).toContain('Packet Team');
  expect(html).toContain('>99</td>');
  expect(html).toContain('PACKET ZERO');
  expect(html).toContain('Packet Opponent');
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

test('newsletter HTML preserves a numeric zero fact value', async () => {
  const html = await renderDevilInDetails({
    numbers: [{ value: 0, label: 'ZERO FACT', detail: 'Verified zero.' }],
  });

  expect(html).toContain('ZERO FACT');
  expect(html).toContain('>0</td>');
});

test('newsletter optional sections remain valid when absent', async () => {
  const html = await renderDevilInDetails({
    guide_context: null,
    win_expectancy: null,
    leaders: { passing: [], rushing: [], receiving: [], defense: [] },
    numbers: [],
    acc_context: { standings: [], results: [] },
  });

  expect(html).toContain('<!doctype html>');
  expect(html).not.toContain('RECORD WATCH');
  expect(html).not.toContain('WIN EXPECTANCY');
});

test('newsletter escape protects provider-controlled text', async () => {
  const html = await renderDevilInDetails({
    headline: '<script>alert("x")</script>',
    narrative: 'Opponent & Duke',
    next_opponent: 'Virginia <Rivals>',
  });

  expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  expect(html).toContain('Opponent &amp; Duke');
  expect(html).toContain('Virginia &lt;Rivals&gt;');
});
