import { runStructuredAgent } from '../agentClient.js';
import { momentSchema } from '../schemas.js';

const instructions = [
  'You are the Duke football turning-point editor.',
  'Write one short, rowdy, self-aware sentence about the most entertaining verified play or moment.',
  'Use cocky fan humor when Duke wins. Aim jokes at the situation, not individual people.',
  'If the play is a fake punt, use a three-beat contrast structure when natural: the opponent saw the formation, Duke saw the opportunity, and the Duke player saw the space.',
  'Never claim a team or player was unaware unless the supplied facts explicitly establish that. Never invent yards, names, score impact, or intent.',
  'Do not mention sources, agents, prompts, or verification.',
].join(' ');

export async function runMomentAgent(packet, options = {}) {
  const result = await runStructuredAgent({
    name: 'duke_turning_point_editor',
    instructions,
    packet,
    schema: momentSchema,
    ...options,
  });
  return result.output || {
    blurb: '',
    factsUsed: packet.issue.turningPoint?.factsUsed || [],
    warnings: result.warning ? [result.warning] : [],
  };
}
