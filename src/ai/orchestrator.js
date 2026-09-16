import { buildIssuePacket } from './issuePacket.js';
import { runAccAgent } from './agents/accAgent.js';
import { runHistoryAgent } from './agents/historyAgent.js';
import { runRecapAgent } from './agents/recapAgent.js';
import { runScorigamiAgent } from './agents/scorigamiAgent.js';
import { runMomentAgent } from './agents/momentAgent.js';
import { runMomentScoutAgent } from './agents/momentScoutAgent.js';
import { discoverMomentSources } from './moments/sourceDiscovery.js';
import { runWebMomentScout } from './moments/webMomentScout.js';
import { validateEditorialPackage } from './validateEditorial.js';

function applyEditorial(issueData, editorial) {
  const guideContext = issueData.guide_context
    ? {
      ...issueData.guide_context,
      editorialHistory: editorial.history.context || issueData.guide_context.opponentHistory?.statement || '',
      editorialMoment: editorial.moment.blurb || '',
    }
    : issueData.guide_context;
  const accContext = issueData.acc_context
    ? { ...issueData.acc_context, editorialBlurb: editorial.acc.blurb || '' }
    : issueData.acc_context;
  return {
    ...issueData,
    headline: editorial.recap.headline,
    subheadline: editorial.recap.subheadline,
    narrative: editorial.recap.narrative,
    scorigami_context: editorial.scorigami.context,
    guide_context: guideContext,
    acc_context: accContext,
  };
}

export async function runEditorialOrchestrator(issueData, options = {}) {
  const modelAvailable = options.apiKey !== undefined
    ? Boolean(options.apiKey)
    : Boolean(options.client || process.env.OPENAI_API_KEY);
  let externalSources = [];
  let discoveredMoments = [];
  if (modelAvailable) {
    try {
      const discoverSources = options.discoverSources || discoverMomentSources;
      const webCandidates = (await runWebMomentScout({ issueData, apiKey: options.apiKey, client: options.client })).candidates || [];
      const sourceLeads = webCandidates.flatMap((candidate) => (candidate.sourceUrls || []).map((url) => ({
        type: 'web_search',
        url,
        excerpt: candidate.evidence,
      })));
      externalSources = [...await discoverSources({ issueData }), ...sourceLeads];
      const scoutPacket = buildIssuePacket(issueData, { externalSources });
      discoveredMoments = [...webCandidates, ...((await runMomentScoutAgent(scoutPacket, options)).candidates || [])].slice(0, 3);
    } catch {
      externalSources = [];
      discoveredMoments = [];
    }
  }
  const packet = buildIssuePacket(issueData, { externalSources, discoveredMoments });
  const [recap, scorigami, history, acc, moment] = await Promise.all([
    runRecapAgent(packet, options),
    runScorigamiAgent(packet, options),
    runHistoryAgent(packet, options),
    runAccAgent(packet, options),
    runMomentAgent(packet, options),
  ]);
  const editorial = { recap, scorigami, history, acc, moment };
  let validation = validateEditorialPackage({ packet, editorial });
  if (!validation.approved) {
    const fallbackEditorial = {
      recap: {
        headline: issueData.headline,
        subheadline: issueData.subheadline,
        narrative: issueData.narrative,
        factsUsed: ['game.score', 'game.numbers', 'game.leaders'],
        warnings: validation.issues,
      },
      scorigami: {
        context: issueData.scorigami_context,
        factsUsed: ['scorigami'],
        warnings: validation.issues,
      },
      history: {
        context: issueData.guide_context?.opponentHistory?.statement || issueData.guide_context?.historicalFact?.statement || '',
        factsUsed: ['history'],
        warnings: validation.issues,
      },
      acc: { blurb: '', factsUsed: ['acc'], warnings: validation.issues },
      moment: { blurb: '', factsUsed: [], warnings: validation.issues },
    };
    validation = validateEditorialPackage({ packet, editorial: fallbackEditorial });
    return { issueData: applyEditorial(issueData, fallbackEditorial), editorial: fallbackEditorial, validation, mode: 'deterministic-fallback' };
  }
  return { issueData: applyEditorial(issueData, editorial), editorial, validation, mode: modelAvailable ? 'multi-agent' : 'deterministic-fallback' };
}
