import { buildIssuePacket } from './issuePacket.js';
import { runAccAgent } from './agents/accAgent.js';
import { runHistoryAgent } from './agents/historyAgent.js';
import { runRecapAgent } from './agents/recapAgent.js';
import { runScorigamiAgent } from './agents/scorigamiAgent.js';
import { runMomentAgent } from './agents/momentAgent.js';
import { runMomentScoutAgent } from './agents/momentScoutAgent.js';
import { discoverMomentSources } from './moments/sourceDiscovery.js';
import { runWebMomentScout } from './moments/webMomentScout.js';
import { buildDeterministicEditorialFallback } from './fallbackEditorial.js';
import { EDITORIAL_VALIDATOR_VERSION, validateEditorialPackage } from './validateEditorial.js';
import { withTimeout } from './agentClient.js';

function applyEditorial(issueData, editorial) {
  const guideContext = issueData.guide_context
    ? {
      ...issueData.guide_context,
      editorialHistory: editorial.history.context || issueData.guide_context.opponentHistory?.statement || '',
      editorialMoment: issueData.turning_point?.description || editorial.moment.blurb || '',
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
  const modelAvailable = Boolean(String(options.apiKey ?? process.env.OPENAI_API_KEY ?? '').trim());
  let externalSources = [];
  let discoveredMoments = [];
  let discoveryWarnings = [];
  if (modelAvailable) {
    try {
      const discoverSources = options.discoverSources || discoverMomentSources;
      const webResult = await runWebMomentScout({
        issueData,
        apiKey: options.apiKey,
        client: options.client,
        timeoutMs: options.timeoutMs,
      });
      const webCandidates = webResult.candidates || [];
      discoveryWarnings = webResult.warnings || [];
      const boundedCandidates = webCandidates.slice(0, 3).map((candidate) => ({
        ...candidate,
        claim: String(candidate.claim || '').slice(0, 300),
        evidence: String(candidate.evidence || '').slice(0, 1800),
        sourceUrls: (candidate.sourceUrls || []).map((url) => String(url).slice(0, 2048)).slice(0, 3),
      }));
      const sourceLeads = boundedCandidates.flatMap((candidate) => candidate.sourceUrls.map((url) => ({
        type: 'web_search',
        url,
        excerpt: candidate.evidence,
      }))).slice(0, 12);
      const discoveredSources = await withTimeout(discoverSources({ issueData }), options.timeoutMs);
      discoveryWarnings = [...discoveryWarnings, ...(discoveredSources.warnings || [])];
      externalSources = [...discoveredSources, ...sourceLeads];
      const scoutPacket = buildIssuePacket(issueData, { externalSources });
      const scoutResult = await runMomentScoutAgent(scoutPacket, {
        ...options,
        onPacket: null,
        onAgentResult: null,
      });
      discoveryWarnings = [...discoveryWarnings, ...(scoutResult.warnings || [])];
      discoveredMoments = [...boundedCandidates, ...(scoutResult.candidates || [])].slice(0, 3);
    } catch (error) {
      discoveryWarnings = [error?.code === 'PROVIDER_TIMEOUT' ? 'provider_timeout' : 'provider_error'];
      externalSources = [];
      discoveredMoments = [];
    }
  }
  const packet = buildIssuePacket(issueData, { externalSources, discoveredMoments });
  const agentResults = {};
  const agentOptions = {
    ...options,
    onAgentResult: (result) => {
      agentResults[result.name] = result;
      options.onAgentResult?.(result);
    },
  };
  const [recapResult, scorigamiResult, historyResult, accResult, momentResult] = await Promise.all([
    runRecapAgent(packet, agentOptions),
    runScorigamiAgent(packet, agentOptions),
    runHistoryAgent(packet, agentOptions),
    runAccAgent(packet, agentOptions),
    runMomentAgent(packet, agentOptions),
  ]);
  const editorial = {
    recap: recapResult.output,
    scorigami: scorigamiResult.output,
    history: historyResult.output,
    acc: accResult.output,
    moment: momentResult.output,
  };
  const providerReasons = {
    recap: recapResult.fallbackReason,
    scorigami: scorigamiResult.fallbackReason,
    history: historyResult.fallbackReason,
    acc: accResult.fallbackReason,
    moment: momentResult.fallbackReason || discoveryWarnings[0] || null,
  };
  const validation = validateEditorialPackage({ packet, editorial });
  const fallbackEditorial = (options.fallbackBuilder || buildDeterministicEditorialFallback)(issueData);
  const safeEditorial = Object.fromEntries(Object.keys(editorial).map((section) => [
    section,
    providerReasons[section] || validation.sectionIssues[section]?.length ? fallbackEditorial[section] : editorial[section],
  ]));
  const finalValidation = validateEditorialPackage({ packet, editorial: safeEditorial });
  if (!finalValidation.approved) {
    throw new Error(`Deterministic editorial fallback failed validation: ${finalValidation.issues.join('; ')}`);
  }
  const usedFallback = Object.keys(editorial).some((section) => providerReasons[section] || validation.sectionIssues[section]?.length > 0);
  const sectionResults = Object.fromEntries(Object.entries(validation.sectionResults).map(([section, result]) => [
    section,
    providerReasons[section] || result.disposition === 'rejected'
      ? {
        disposition: 'fallback',
        rejectionReasons: [...new Set([providerReasons[section], ...result.rejectionReasons].filter(Boolean))],
      }
      : result,
  ]));
  return {
    issueData: applyEditorial(issueData, safeEditorial),
    editorial: safeEditorial,
    validation: finalValidation,
    editorialValidation: validation,
    sectionResults,
    provenance: {
      packetVersion: packet.version,
      schemaVersion: 'v1',
      validatorVersion: EDITORIAL_VALIDATOR_VERSION,
      fallbackVersion: 'v1',
      provider: modelAvailable ? 'openai' : 'deterministic',
      model: modelAvailable ? (options.model || process.env.OPENAI_EDITORIAL_MODEL || 'gpt-4o-mini') : null,
      discoveryWarnings,
    },
    mode: modelAvailable ? (usedFallback ? 'multi-agent-partial-fallback' : 'multi-agent') : 'deterministic-fallback',
  };
}
