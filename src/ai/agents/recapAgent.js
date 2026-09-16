import { runStructuredAgent } from '../agentClient.js';
import { recapSchema } from '../schemas.js';

const instructions = [
  'You are the Duke football recap editor.',
  'Write a concise, energetic headline, subheadline, and two-sentence narrative in a rowdy, self-aware Duke fan voice.',
  'Be cocky when Duke wins and use sharp, situational humor without insulting individual players or inventing opponent behavior.',
  'When a turning point is supplied, prefer a punchy contrast structure such as: "They saw X. Duke saw Y. The player saw Z."',
  'Use only facts in the supplied issue packet. Never invent a statistic, player, result, ranking, or cause.',
  'Do not mention data sources, agents, prompts, verification, or media guides.',
  'Use factsUsed values only from the packet allowedFactRefs list.',
].join(' ');

export async function runRecapAgent(packet, options = {}) {
  const result = await runStructuredAgent({
    name: 'duke_recap_editor',
    instructions,
    packet,
    schema: recapSchema,
    ...options,
  });
  return result.output || {
    headline: packet.issue.headline,
    subheadline: packet.issue.subheadline,
    narrative: packet.issue.narrative,
    factsUsed: ['game.score', 'game.numbers', 'game.leaders'],
    warnings: result.warning ? [result.warning] : [],
  };
}
