import { runEditorialOrchestrator } from './orchestrator.js';

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
          };
          return { choices: [{ message: { content: JSON.stringify(outputs[response_format.json_schema.name]) } }] };
        },
      },
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
    numbers: [],
    leaders: {},
    guide_context: {},
    acc_context: {},
  }, { apiKey: null });

  expect(result.issueData.headline).toBe('DUKE TAKES THE LAST WORD');
  expect(result.issueData.narrative).toContain('Walker Eget found Nate Sheppard');
});
