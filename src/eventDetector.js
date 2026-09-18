export const EVENT_LOGIC_VERSION = 'v2';

function directive({ key, tier, priority, facts, issueTypes = ['sunday'] }) {
  return {
    directiveKey: key,
    tier,
    priority,
    issueTypes,
    facts,
    logicVersion: EVENT_LOGIC_VERSION,
  };
}

export function detectEvents(masterGame, { logicVersion = EVENT_LOGIC_VERSION } = {}) {
  const facts = masterGame?.facts || {};
  const directives = [];

  if (facts.scorigami?.isNew === true && facts.scorigami.score != null) {
    directives.push(directive({
      key: 'scorigami_final',
      tier: 1,
      priority: 100,
      facts: {
        score: facts.scorigami.score,
        occurrenceCount: facts.scorigami.occurrenceCount ?? 0,
        previousOccurrence: facts.scorigami.previousOccurrence ?? null,
      },
      issueTypes: ['sunday', 'watercooler'],
    }));
  }

  if (facts.historic?.isRecord === true) {
    directives.push(directive({
      key: 'program_record',
      tier: 1,
      priority: 90,
      facts: facts.historic,
      issueTypes: ['sunday', 'watercooler'],
    }));
  }

  if (facts.narrative?.comeback === true) {
    directives.push(directive({
      key: 'comeback',
      tier: 2,
      priority: 70,
      facts: facts.narrative,
      issueTypes: ['sunday'],
    }));
  }

  if (facts.narrative?.lateGameWin === true) {
    directives.push(directive({
      key: 'late_game_win',
      tier: 2,
      priority: 72,
      facts: facts.narrative,
      issueTypes: ['sunday', 'watercooler'],
    }));
  }

  if (facts.narrative?.upset === true) {
    directives.push(directive({
      key: 'upset',
      tier: 2,
      priority: 65,
      facts: facts.narrative,
      issueTypes: ['sunday', 'watercooler'],
    }));
  }

  for (const hook of facts.statisticalHooks || []) {
    if (!hook?.key) continue;
    directives.push(directive({
      key: hook.key,
      tier: 3,
      priority: hook.priority ?? 10,
      facts: hook.facts || {},
      issueTypes: hook.issueTypes || ['sunday'],
    }));
  }

  const orderedDirectives = directives
    .map((candidate) => ({ ...candidate, logicVersion }))
    .sort((a, b) => a.tier - b.tier
      || b.priority - a.priority
      || (a.directiveKey < b.directiveKey ? -1 : a.directiveKey > b.directiveKey ? 1 : 0));
  return {
    logicVersion,
    gameKey: masterGame?.canonicalKey || null,
    primary: orderedDirectives[0] || null,
    directives: orderedDirectives,
  };
}

export function buildHeadlineDirective(masterGame, options = {}) {
  const result = detectEvents(masterGame, options);
  return result.primary
    ? {
      ...result.primary,
      gameKey: result.gameKey,
      logicVersion: result.logicVersion,
    }
    : null;
}
