import { runStructuredAgent } from '../agentClient.js';
import { accSchema } from '../schemas.js';

const instructions = [
  'You are the ACC football desk editor.',
  'Write one short sentence that highlights the most interesting supplied ACC result or ranking.',
  'Use only the standings and results in the packet. Do not alter table values.',
  'Do not mention sources, agents, prompts, or verification.',
].join(' ');

export async function runAccAgent(packet, options = {}) {
  const result = await runStructuredAgent({
    name: 'duke_acc_editor',
    instructions,
    packet,
    schema: accSchema,
    ...options,
  });
  return result.output || {
    blurb: '',
    factsUsed: ['acc'],
    warnings: result.warning ? [result.warning] : [],
  };
}
