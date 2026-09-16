import { buildHeadlineDirective, detectEvents } from './eventDetector.js';

test('prioritizes a new Scorigami as a tier-one directive', () => {
  const result = detectEvents({
    canonicalKey: 'football:2026:duke-virginia',
    facts: {
      scorigami: {
        isNew: true,
        score: '24-10',
        occurrenceCount: 0,
      },
      narrative: { comeback: true },
      statisticalHooks: [{ key: 'yardage_milestone', priority: 20 }],
    },
  });

  expect(result.primary).toMatchObject({
    directiveKey: 'scorigami_final',
    tier: 1,
    priority: 100,
  });
  expect(result.directives).toHaveLength(3);
});

test('returns narrative and statistical directives without calculating facts', () => {
  const directive = buildHeadlineDirective({
    canonicalKey: 'football:2026:duke-tulane',
    facts: {
      narrative: { upset: true },
      statisticalHooks: [{ key: 'third_down_record', facts: { rate: 0.8 } }],
    },
  });

  expect(directive).toMatchObject({
    directiveKey: 'upset',
    tier: 2,
    facts: { upset: true },
  });
});

test('returns no directive when verified facts contain no hook', () => {
  expect(buildHeadlineDirective({ facts: {} })).toBeNull();
});
