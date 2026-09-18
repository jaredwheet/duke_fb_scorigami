import { jest } from '@jest/globals';
import { runEditorialOrchestrator } from './orchestrator.js';

function createEditorialClient(outputs) {
  return {
    chat: {
      completions: {
        create: async ({ response_format: responseFormat }) => ({
          choices: [{ message: { content: JSON.stringify(outputs[responseFormat.json_schema.name]) } }],
        }),
      },
    },
  };
}

function validEditorialOutputs(overrides = {}) {
  return {
    duke_recap_editor: {
      headline: 'DUKE TAKES THE LAST WORD',
      subheadline: 'Duke wins 31-27.',
      narrative: 'Duke made the scoreboard do the talking.',
      factsUsed: ['game.score'],
      warnings: [],
      ...overrides.recap,
    },
    duke_scorigami_editor: { context: 'The score has happened before.', factsUsed: ['scorigami'], warnings: [], ...overrides.scorigami },
    duke_history_editor: { context: 'The series history remains indexed.', factsUsed: ['history'], warnings: [], ...overrides.history },
    duke_acc_editor: { blurb: 'The ACC results are in.', factsUsed: ['acc'], warnings: [], ...overrides.acc },
    duke_turning_point_editor: { blurb: 'Duke made the key play.', factsUsed: ['moment'], warnings: [], ...overrides.moment },
  };
}

function editorialIssueData() {
  return {
    headline: 'Old headline',
    subheadline: 'Old subheadline',
    narrative: 'Old narrative',
    current_opponent: 'Illinois',
    current_score: '31-27',
    quarters: [{ final: 31 }, { final: 27 }],
    scorigami_context: 'The score has happened before.',
    guide_context: { opponentHistory: { statement: 'The series is now tied 2-2.' } },
    acc_context: { standings: [], results: [] },
    numbers: [{ value: 14, label: 'TEST NUMBER', detail: 'A verified number.' }],
  };
}

test('falls back to deterministic newsletter copy without an OpenAI key', async () => {
  const result = await runEditorialOrchestrator({
    headline: 'DUKE OUTLASTS ILLINOIS',
    subheadline: 'Duke won 31-27.',
    narrative: 'Duke rallied late.',
    scorigami_context: '27-31 has occurred twice before.',
    guide_context: { opponentHistory: { statement: 'The series is tied 2-2.' } },
    acc_context: { standings: [], results: [] },
    quarters: [],
    scoring_plays: [],
    numbers: [],
    leaders: {},
  }, { apiKey: null });

  expect(result.mode).toBe('deterministic-fallback');
  expect(result.issueData.headline).toBe('DUKE OUTLASTS ILLINOIS');
  expect(result.validation.approved).toBe(true);
});

test('runs specialized agents against one packet and merges only editorial fields', async () => {
  const client = {
    chat: {
      completions: {
        create: async ({ response_format }) => {
          const outputs = {
            duke_recap_editor: {
              headline: 'DUKE OUTLASTS ILLINOIS',
              subheadline: 'Duke wins 31-27.',
              narrative: 'Duke rallied late for the win.',
              factsUsed: ['game.score'],
              warnings: [],
            },
            duke_scorigami_editor: { context: '27-31 has happened twice before.', factsUsed: ['scorigami'], warnings: [] },
            duke_history_editor: { context: 'The series is now tied 2-2.', factsUsed: ['history'], warnings: [] },
            duke_acc_editor: { blurb: 'Clemson won its ACC opener.', factsUsed: ['acc'], warnings: [] },
            duke_turning_point_editor: { blurb: 'Duke made the key play.', factsUsed: ['moment'], warnings: [] },
            duke_moment_scout: { candidates: [], warnings: [] },
          };
          return { choices: [{ message: { content: JSON.stringify(outputs[response_format.json_schema.name]) } }] };
        },
      },
    },
    responses: {
      create: async () => ({ output_text: JSON.stringify({ candidates: [], warnings: [] }) }),
    },
  };
  const result = await runEditorialOrchestrator({
    headline: 'Old headline',
    subheadline: 'Old subheadline',
    narrative: 'Old narrative',
    current_opponent: 'Illinois',
    current_score: '31-27',
    scorigami_context: 'Old score context',
    guide_context: { opponentHistory: { statement: 'The series is now tied 2-2.' } },
    acc_context: { standings: [], results: [] },
  }, { client, apiKey: 'test-key', discoverSources: async () => [] });

  expect(result.mode).toBe('multi-agent');
  expect(result.validation.approved).toBe(true);
  expect(result.issueData.headline).toBe('DUKE OUTLASTS ILLINOIS');
  expect(result.issueData.acc_context.editorialBlurb).toBe('Clemson won its ACC opener.');
});

test('Q8 AC1 shared packet identity and deep immutability', async () => {
  const packets = [];
  const result = await runEditorialOrchestrator(editorialIssueData(), {
    client: createEditorialClient(validEditorialOutputs()),
    apiKey: 'test-key',
    discoverSources: async () => [],
    onPacket: (packet) => packets.push(packet),
  });

  expect(result.validation.approved).toBe(true);
  expect(packets).toHaveLength(5);
  expect(new Set(packets).size).toBe(1);
  expect(Object.isFrozen(packets[0])).toBe(true);
  expect(Object.isFrozen(packets[0].facts)).toBe(true);
  expect(Object.isFrozen(packets[0].facts.score)).toBe(true);
  expect(() => { packets[0].facts.score.duke = 999; }).toThrow(TypeError);
  expect(packets[1].facts.score.duke).toBe(31);
  expect(packets[0].version).toBe('v1');
});

test('Q8 AC4 local schema boundary and fallback validation', async () => {
  const malformedOutputs = validEditorialOutputs({
    recap: { factsUsed: 'game.score' },
  });
  const fallback = {
    recap: { headline: 'fallback', subheadline: 'fallback', narrative: 'fallback', factsUsed: ['game.score'], warnings: [] },
    scorigami: { context: '', factsUsed: ['scorigami'], warnings: [] },
    history: { context: '', factsUsed: ['history'], warnings: [] },
    acc: { blurb: '', factsUsed: ['acc'], warnings: [] },
    moment: { blurb: '', factsUsed: ['moment'], warnings: [] },
  };
  const recovered = await runEditorialOrchestrator(editorialIssueData(), {
    client: createEditorialClient(malformedOutputs),
    apiKey: 'test-key',
    discoverSources: async () => [],
  });

  expect(recovered.validation.approved).toBe(true);
  expect(recovered.sectionResults.recap.disposition).toBe('fallback');
  expect(recovered.sectionResults.recap.rejectionReasons.join(' ')).toContain('schema_type');

  await expect(runEditorialOrchestrator(editorialIssueData(), {
    client: createEditorialClient(malformedOutputs),
    apiKey: 'test-key',
    discoverSources: async () => [],
    fallbackBuilder: () => ({ ...fallback, recap: { ...fallback.recap, factsUsed: 'bad' } }),
  })).rejects.toThrow('Deterministic editorial fallback failed validation');
});

test('Q7 AC1 unset-or-empty OpenAI key makes editorial orchestration perform zero provider calls', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const chatCreate = jest.fn();
  const responseCreate = jest.fn();
  const discoverSources = jest.fn();
  const client = {
    chat: { completions: { create: chatCreate } },
    responses: { create: responseCreate },
  };
  try {
    for (const apiKey of [undefined, '', '   ']) {
      const result = await runEditorialOrchestrator(editorialIssueData(), {
        apiKey,
        client,
        discoverSources,
      });

      expect(result.mode).toBe('deterministic-fallback');
      expect(Object.values(result.sectionResults).every((section) => section.disposition === 'fallback')).toBe(true);
      expect(Object.values(result.sectionResults).every((section) => section.rejectionReasons.includes('provider_not_configured'))).toBe(true);
    }
  } finally {
    if (previousKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
  expect(chatCreate).not.toHaveBeenCalled();
  expect(responseCreate).not.toHaveBeenCalled();
  expect(discoverSources).not.toHaveBeenCalled();
});

test('Q7 AC2 malformed partial section falls back while valid sibling sections remain provider output', async () => {
  const outputs = validEditorialOutputs({ acc: { blurb: 'VALID SIBLING EDITORIAL COPY' } });
  const client = {
    chat: {
      completions: {
        create: async ({ response_format: responseFormat }) => responseFormat.json_schema.name === 'duke_recap_editor'
          ? { choices: [{ message: { content: '{not-json' } }] }
          : { choices: [{ message: { content: JSON.stringify(outputs[responseFormat.json_schema.name]) } }] },
      },
    },
  };
  const result = await runEditorialOrchestrator(editorialIssueData(), {
    client,
    apiKey: 'test-key',
    discoverSources: async () => [],
  });

  expect(result.sectionResults.recap).toMatchObject({ disposition: 'fallback', rejectionReasons: ['malformed_response'] });
  expect(result.issueData.acc_context.editorialBlurb).toBe('VALID SIBLING EDITORIAL COPY');
  expect(result.mode).toBe('multi-agent-partial-fallback');
});

test('Q7 EDGE provider timeout is bounded, falls back per section, and preserves the provider warning', async () => {
  const client = {
    chat: { completions: { create: () => new Promise(() => {}) } },
    responses: { create: () => new Promise(() => {}) },
  };
  const started = Date.now();
  const result = await runEditorialOrchestrator(editorialIssueData(), {
    client,
    apiKey: 'test-key',
    timeoutMs: 15,
    discoverSources: async () => [],
  });

  expect(Date.now() - started).toBeLessThan(500);
  expect(result.sectionResults.recap).toMatchObject({ disposition: 'fallback', rejectionReasons: ['provider_timeout'] });
  expect(result.validation.approved).toBe(true);
});

test('Q7 EDGE deterministic editorial fallback is identical across repeated runs', async () => {
  const first = await runEditorialOrchestrator(editorialIssueData(), { apiKey: null });
  const second = await runEditorialOrchestrator(editorialIssueData(), { apiKey: null });

  expect(second.editorial).toEqual(first.editorial);
  expect(second.sectionResults).toEqual(first.sectionResults);
  expect(second.mode).toBe(first.mode);
});

test('Q7 EDGE unknown provider errors map to safe reason codes', async () => {
  const client = {
    chat: { completions: { create: async () => { throw new Error('prompt=secret response=private'); } } },
    responses: { create: async () => { throw new Error('provider response secret'); } },
  };
  const result = await runEditorialOrchestrator(editorialIssueData(), {
    client,
    apiKey: 'test-key',
    discoverSources: async () => [],
    timeoutMs: 25,
  });

  expect(result.sectionResults.recap.rejectionReasons).toEqual(['provider_error']);
  expect(JSON.stringify(result)).not.toContain('prompt=secret');
  expect(JSON.stringify(result)).not.toContain('provider response secret');
});

test('uses a Duke-positive headline in the deterministic fallback', async () => {
  const result = await runEditorialOrchestrator({
    headline: 'DUKE OUTLASTS ILLINOIS',
    subheadline: 'Duke won 31-27.',
    narrative: 'Duke rallied late.',
    current_opponent: 'Illinois',
    current_score: '31-27',
    scorigami_context: '27-31 has occurred twice before.',
    quarters: [{ final: 31 }, { final: 27 }],
    numbers: [],
    leaders: {},
    guide_context: {},
    acc_context: {},
  }, { apiKey: null });

  expect(result.issueData.headline).toBe('DUKE TAKES THE LAST WORD');
});

test('human fallback uses the turning point instead of generic recap copy', async () => {
  const result = await runEditorialOrchestrator({
    headline: 'DUKE OUTLASTS ILLINOIS',
    subheadline: 'Duke won 31-27.',
    narrative: 'Walker Eget threw for 206 yards.',
    current_opponent: 'Illinois',
    current_score: '31-27',
    quarters: [{ final: 31 }, { final: 27 }],
    turning_point: { type: 'touchdown', description: 'Walker Eget found Nate Sheppard for a second-half touchdown.' },
    numbers: [{ value: 206, label: 'PASSING YARDS', detail: 'Verified passing total.' }],
    leaders: {},
    guide_context: {},
    acc_context: {},
  }, { apiKey: null });

  expect(result.issueData.headline).toBe('DUKE TAKES THE LAST WORD');
  expect(result.issueData.narrative).toContain('Walker Eget found Nate Sheppard');
});

test('preserves deterministic key-play context when an agent returns a generic moment', async () => {
  const result = await runEditorialOrchestrator({
    headline: 'DUKE TAKES THE LAST WORD',
    subheadline: 'Duke won 31-27.',
    narrative: 'Duke rallied late.',
    current_opponent: 'Illinois',
    current_score: '31-27',
    quarters: [{ final: 31 }, { final: 27 }],
    turning_point: { description: 'Walker Eget found Nate Sheppard for 3 yards and a touchdown with 10:47 left in the third quarter (Duke 28, Illinois 24).' },
    scorigami_context: '',
    guide_context: {},
    acc_context: {},
  }, {
    client: {
      chat: { completions: { create: async ({ response_format }) => ({ choices: [{ message: { content: JSON.stringify(response_format.json_schema.name === 'duke_recap_editor'
        ? { headline: 'DUKE TAKES THE LAST WORD', subheadline: 'Duke won 31-27.', narrative: 'Duke made a major play.', factsUsed: ['game.score'], warnings: [] }
        : response_format.json_schema.name === 'duke_turning_point_editor'
          ? { blurb: 'Duke made a major play.', factsUsed: ['moment'], warnings: [] }
          : response_format.json_schema.name === 'duke_scorigami_editor'
            ? { context: '', factsUsed: ['scorigami'], warnings: [] }
            : response_format.json_schema.name === 'duke_history_editor'
              ? { context: '', factsUsed: ['history'], warnings: [] }
              : { blurb: '', factsUsed: ['acc'], warnings: [] }) } }] }) } },
    },
    apiKey: 'test-key',
    discoverSources: async () => [],
  });

  expect(result.issueData.guide_context.editorialMoment).toContain('Walker Eget found Nate Sheppard');
});
