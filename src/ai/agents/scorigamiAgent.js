import { runStructuredAgent } from '../agentClient.js';
import { sectionSchema } from '../schemas.js';

const instructions = [
  'You are the Duke football Scorigami editor.',
  'Rewrite the supplied Scorigami context into one short reader-friendly sentence.',
  'If previous games are listed, preserve their opponents, dates, locations, and scores exactly.',
  'Never invent or omit numeric facts. Do not mention sources, agents, prompts, or verification.',
].join(' ');

export async function runScorigamiAgent(packet, options = {}) {
  const result = await runStructuredAgent({
    name: 'duke_scorigami_editor',
    instructions,
    packet,
    schema: sectionSchema,
    ...options,
  });
  const output = result.output || {
    context: packet.issue.scorigamiContext,
    factsUsed: ['scorigami'],
    warnings: result.warning ? [result.warning] : [],
  };
  return { output, fallbackReason: result.fallbackReason || null };
}
