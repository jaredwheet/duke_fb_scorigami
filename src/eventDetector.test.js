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
      historic: { isRecord: true, recordWatch: { status: 'record' } },
      narrative: { comeback: true, upset: true, lateGameWin: true },
    },
  });

  expect(result.primary).toMatchObject({
    directiveKey: 'scorigami_final',
    tier: 1,
    priority: 100,
  });
  expect(result.directives).toHaveLength(5);
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

test('emits a late-game directive when verified facts include a late lead change', () => {
  const result = detectEvents({
    canonicalKey: 'football:2026:duke-clemson',
    facts: { narrative: { lateGameWin: true, period: 4, time: '00:30' } },
  });

  expect(result.primary).toMatchObject({ directiveKey: 'late_game_win', tier: 2 });
});

test('returns no directive when verified facts contain no hook', () => {
  expect(buildHeadlineDirective({ facts: {} })).toBeNull();
});

test('directive tie-breaking is stable by key after tier and priority', () => {
  const facts = {
    statisticalHooks: [
      { key: 'z_signal', priority: 50, facts: { source: 'z' } },
      { key: 'a_signal', priority: 50, facts: { source: 'a' } },
    ],
  };
  const result = detectEvents({
    canonicalKey: 'football:2026:duke-tulane',
    facts,
  });
  const reversed = detectEvents({ canonicalKey: 'football:2026:duke-tulane', facts: {
    statisticalHooks: [...facts.statisticalHooks].reverse(),
  } });

  expect(result.primary).toMatchObject({ directiveKey: 'a_signal', tier: 3, priority: 50 });
  expect(reversed.primary.directiveKey).toBe('a_signal');
});

test('safeguard does not emit a score directive without a score fact', () => {
  expect(buildHeadlineDirective({ facts: { scorigami: { isNew: true } } })).toBeNull();
});
