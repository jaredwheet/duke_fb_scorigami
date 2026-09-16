import { runStructuredAgent } from '../agentClient.js';
import { sectionSchema } from '../schemas.js';

const instructions = [
  'You are the Duke football history editor.',
  'Write one concise matchup-history sentence from the supplied guide context.',
  'Prioritize the historical note about the opponent and retain the current series record.',
  'Do not mention the media guide, sources, agents, prompts, or verification.',
].join(' ');

export async function runHistoryAgent(packet, options = {}) {
  const result = await runStructuredAgent({
    name: 'duke_history_editor',
    instructions,
    packet,
    schema: sectionSchema,
    ...options,
  });
  const fallback = packet.issue.guideContext?.opponentHistory?.statement
    || packet.issue.guideContext?.historicalFact?.statement
    || '';
  return result.output || {
    context: fallback,
    factsUsed: ['history'],
    warnings: result.warning ? [result.warning] : [],
  };
}
