import { buildIssuePacket } from './issuePacket.js';
import { validateEditorialPackage } from './validateEditorial.js';

function buildPacket(options = {}) {
  return buildIssuePacket({
    current_score: '31-27',
    current_opponent: 'Illinois',
    quarters: [{ final: 31 }, { final: 27 }],
    numbers: [{ value: 14, label: 'TEST NUMBER', detail: 'A verified number.' }],
    scorigami_context: 'The score has happened before.',
    guide_context: {},
    acc_context: {},
    ...options.issueData,
  }, options);
}

function editorialPackage() {
  return {
    recap: {
      headline: 'Duke takes the last word',
      subheadline: 'Duke wins 31-27.',
      narrative: 'Duke made the scoreboard do the talking with 14.0 points in the final quarter.',
      factsUsed: ['game.score'],
      warnings: [],
    },
    scorigami: { context: 'The score has happened before.', factsUsed: ['scorigami'], warnings: [] },
    history: { context: 'The series history remains indexed.', factsUsed: ['history'], warnings: [] },
    acc: { blurb: 'The ACC results are in.', factsUsed: ['acc'], warnings: [] },
    moment: { blurb: 'Duke made the key play.', factsUsed: ['moment'], warnings: [] },
  };
}

test('Q8 AC2 rejects unsupported numbers including untrusted evidence', () => {
  const packet = buildPacket({ externalSources: [{ evidence: 'Duke gained 999 yards.' }] });
  const normalized = validateEditorialPackage({ packet, editorial: editorialPackage() });
  expect(normalized.approved).toBe(true);

  const unsupported = editorialPackage();
  unsupported.recap.narrative = 'Duke gained 999 yards.';
  const result = validateEditorialPackage({ packet, editorial: unsupported });

  expect(result.approved).toBe(false);
  expect(result.sectionIssues.recap.join(' ')).toContain('unsupported_number');
  expect(result.sectionResults.recap.rejectionReasons.join(' ')).toContain('unsupported_number');

  const negativePacket = buildPacket({ issueData: { numbers: [{ value: -3.5, label: 'MARGIN', detail: 'A verified negative margin.' }] } });
  const wrongSign = editorialPackage();
  wrongSign.recap.narrative = 'Duke posted 3.5 in the verified margin.';
  expect(validateEditorialPackage({ packet: negativePacket, editorial: wrongSign }).approved).toBe(false);
});

test('Q8 AC3 rejects internal source language in every section', () => {
  const fields = [
    ['recap', 'headline'],
    ['recap', 'subheadline'],
    ['recap', 'narrative'],
    ['scorigami', 'context'],
    ['history', 'context'],
    ['acc', 'blurb'],
    ['moment', 'blurb'],
  ];
  const forbidden = ['agent', 'prompt', 'source', 'payload', 'canonical', 'provider', 'CFBData', 'Supabase', 'media guide', 'assistant', 'system', 'developer'];

  for (const [section, field] of fields) {
    for (const term of forbidden) {
      const editorial = editorialPackage();
      editorial[section][field] = `${term} says Duke won.`;
      const result = validateEditorialPackage({ packet: buildPacket(), editorial });
      expect(result.sectionIssues[section].join(' ')).toContain('forbidden_internal_language');
    }
  }
});
