import { accSchema, momentSchema, recapSchema, sectionSchema } from './schemas.js';

export const EDITORIAL_VALIDATOR_VERSION = 'v1';
const forbiddenTerms = /\b(?:agent|prompt|source|payload|canonical|provider|cfbdata|supabase|media[\s-]?guide|verified|assistant|system|developer|issue[\s-]+packet)\b/i;
const genericSportsCopy = /\b(?:outlasts?|came out on top|hard-fought|thrilling|showed resilience)\b/i;
const schemas = {
  recap: recapSchema,
  scorigami: sectionSchema,
  history: sectionSchema,
  acc: accSchema,
  moment: momentSchema,
};

function addIssue(issues, code, detail) {
  issues.push(`${code}:${detail}`);
}

function normalizeNumericToken(value) {
  const normalized = String(value).replaceAll(',', '').replace(/%$/, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? String(number) : normalized;
}

function numericTokens(value) {
  return String(value ?? '').match(/(?<![\dA-Za-z])[-+]?\d[\d,]*(?:\.\d+)?%?/g) || [];
}

function allowedNumbers(facts) {
  return new Set(numericTokens(JSON.stringify(facts)).map(normalizeNumericToken));
}

function validateSchema(value, field, schema, issues) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    addIssue(issues, 'schema_type', `${field}:object`);
    return;
  }

  for (const required of schema.required || []) {
    if (!(required in value)) addIssue(issues, 'schema_missing', `${field}.${required}`);
  }
  if (schema.additionalProperties === false) {
    const allowed = new Set(Object.keys(schema.properties || {}));
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) addIssue(issues, 'schema_extra', `${field}.${key}`);
    }
  }
  for (const [key, definition] of Object.entries(schema.properties || {})) {
    if (!(key in value)) continue;
    const actual = value[key];
    if (definition.type === 'string' && typeof actual !== 'string') addIssue(issues, 'schema_type', `${field}.${key}:string`);
    if (definition.type === 'array') {
      if (!Array.isArray(actual)) addIssue(issues, 'schema_type', `${field}.${key}:array`);
      else if (definition.items?.type === 'string' && actual.some((item) => typeof item !== 'string')) {
        addIssue(issues, 'schema_type', `${field}.${key}:string[]`);
      }
    }
  }
}

function validateText(value, field, maxLength, issues, allowed) {
  if (typeof value !== 'string') return;
  if (value.length > maxLength) addIssue(issues, 'text_too_long', field);
  if (forbiddenTerms.test(value)) addIssue(issues, 'forbidden_internal_language', field);
  if (field === 'recap.headline' && /\b(?:makes|made)\s+.+\s+(?:a|the)\s+problem\b/i.test(value)) {
    addIssue(issues, 'ambiguous_headline', field);
  }
  if (field === 'recap.narrative' && genericSportsCopy.test(value)) addIssue(issues, 'generic_sports_copy', field);
  for (const number of numericTokens(value)) {
    const normalized = normalizeNumericToken(number);
    if (!allowed.has(normalized)) addIssue(issues, 'unsupported_number', `${field}:${normalized}`);
  }
}

function validateFactsUsed(value, field, allowedFacts, issues) {
  if (!Array.isArray(value)) return;
  for (const fact of value) {
    if (!allowedFacts.has(fact)) addIssue(issues, 'unsupported_fact_ref', `${field}:${fact}`);
  }
}

export function validateEditorialPackage({ packet, editorial }) {
  const allowedFacts = new Set(packet.allowedFactRefs || []);
  const allowed = allowedNumbers(packet.facts || {});
  const sectionIssues = {
    recap: [],
    scorigami: [],
    history: [],
    acc: [],
    moment: [],
  };

  validateSchema(editorial?.recap, 'recap', schemas.recap, sectionIssues.recap);
  validateSchema(editorial?.scorigami, 'scorigami', schemas.scorigami, sectionIssues.scorigami);
  validateSchema(editorial?.history, 'history', schemas.history, sectionIssues.history);
  validateSchema(editorial?.acc, 'acc', schemas.acc, sectionIssues.acc);
  validateSchema(editorial?.moment, 'moment', schemas.moment, sectionIssues.moment);

  validateText(editorial?.recap?.headline, 'recap.headline', 90, sectionIssues.recap, allowed);
  validateText(editorial?.recap?.subheadline, 'recap.subheadline', 180, sectionIssues.recap, allowed);
  validateText(editorial?.recap?.narrative, 'recap.narrative', 500, sectionIssues.recap, allowed);
  validateFactsUsed(editorial?.recap?.factsUsed, 'recap.factsUsed', allowedFacts, sectionIssues.recap);
  validateText(editorial?.scorigami?.context, 'scorigami.context', 500, sectionIssues.scorigami, allowed);
  validateFactsUsed(editorial?.scorigami?.factsUsed, 'scorigami.factsUsed', allowedFacts, sectionIssues.scorigami);
  validateText(editorial?.history?.context, 'history.context', 400, sectionIssues.history, allowed);
  validateFactsUsed(editorial?.history?.factsUsed, 'history.factsUsed', allowedFacts, sectionIssues.history);
  validateText(editorial?.acc?.blurb, 'acc.blurb', 300, sectionIssues.acc, allowed);
  validateFactsUsed(editorial?.acc?.factsUsed, 'acc.factsUsed', allowedFacts, sectionIssues.acc);
  validateText(editorial?.moment?.blurb, 'moment.blurb', 300, sectionIssues.moment, allowed);
  validateFactsUsed(editorial?.moment?.factsUsed, 'moment.factsUsed', allowedFacts, sectionIssues.moment);

  const issues = Object.values(sectionIssues).flat();
  const sectionResults = Object.fromEntries(Object.entries(sectionIssues).map(([section, reasons]) => [section, {
    disposition: reasons.length > 0 ? 'rejected' : 'approved',
    rejectionReasons: [...reasons],
  }]));
  return { approved: issues.length === 0, issues, sectionIssues, sectionResults };
}
