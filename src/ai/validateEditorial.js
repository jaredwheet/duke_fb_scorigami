const forbiddenTerms = /\b(?:agent|prompt|source|payload|canonical|cfbdata|supabase|media guide|verified)\b/i;

function validateText(value, field, maxLength, issues, allowedNumbers) {
  if (typeof value !== 'string') {
    issues.push(`${field} must be a string`);
    return;
  }
  if (value.length > maxLength) issues.push(`${field} is too long`);
  if (forbiddenTerms.test(value)) issues.push(`${field} contains internal terminology`);
  if (field === 'recap.headline' && /\b(?:makes|made)\s+.+\s+(?:a|the)\s+problem\b/i.test(value)) {
    issues.push(`${field} frames the opponent ambiguously`);
  }
  for (const number of value.match(/\b\d+(?:\.\d+)?\b/g) || []) {
    if (!allowedNumbers.has(number)) issues.push(`${field} contains unsupported number ${number}`);
  }
}

function validateFactsUsed(value, field, allowed, issues) {
  if (!Array.isArray(value)) {
    issues.push(`${field} must be an array`);
    return;
  }
  for (const fact of value) if (!allowed.has(fact)) issues.push(`${field} references unsupported fact ${fact}`);
}

export function validateEditorialPackage({ packet, editorial }) {
  const issues = [];
  const allowed = new Set(packet.allowedFactRefs || []);
  const allowedNumbers = new Set((JSON.stringify(packet).match(/\b\d+(?:\.\d+)?\b/g) || []));
  validateText(editorial.recap?.headline, 'recap.headline', 90, issues, allowedNumbers);
  validateText(editorial.recap?.subheadline, 'recap.subheadline', 180, issues, allowedNumbers);
  validateText(editorial.recap?.narrative, 'recap.narrative', 500, issues, allowedNumbers);
  validateFactsUsed(editorial.recap?.factsUsed, 'recap.factsUsed', allowed, issues);
  validateText(editorial.scorigami?.context, 'scorigami.context', 500, issues, allowedNumbers);
  validateFactsUsed(editorial.scorigami?.factsUsed, 'scorigami.factsUsed', allowed, issues);
  validateText(editorial.history?.context, 'history.context', 400, issues, allowedNumbers);
  validateFactsUsed(editorial.history?.factsUsed, 'history.factsUsed', allowed, issues);
  validateText(editorial.acc?.blurb, 'acc.blurb', 300, issues, allowedNumbers);
  validateFactsUsed(editorial.acc?.factsUsed, 'acc.factsUsed', allowed, issues);
  validateText(editorial.moment?.blurb, 'moment.blurb', 300, issues, allowedNumbers);
  validateFactsUsed(editorial.moment?.factsUsed, 'moment.factsUsed', allowed, issues);
  return { approved: issues.length === 0, issues };
}
