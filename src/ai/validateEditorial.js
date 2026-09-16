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
  const allowed = new Set(packet.allowedFactRefs || []);
  const allowedNumbers = new Set((JSON.stringify(packet).match(/\b\d+(?:\.\d+)?\b/g) || []));
  const sectionIssues = {
    recap: [],
    scorigami: [],
    history: [],
    acc: [],
    moment: [],
  };
  const recapIssues = sectionIssues.recap;
  validateText(editorial.recap?.headline, 'recap.headline', 90, recapIssues, allowedNumbers);
  validateText(editorial.recap?.subheadline, 'recap.subheadline', 180, recapIssues, allowedNumbers);
  validateText(editorial.recap?.narrative, 'recap.narrative', 500, recapIssues, allowedNumbers);
  validateFactsUsed(editorial.recap?.factsUsed, 'recap.factsUsed', allowed, recapIssues);
  validateText(editorial.scorigami?.context, 'scorigami.context', 500, sectionIssues.scorigami, allowedNumbers);
  validateFactsUsed(editorial.scorigami?.factsUsed, 'scorigami.factsUsed', allowed, sectionIssues.scorigami);
  validateText(editorial.history?.context, 'history.context', 400, sectionIssues.history, allowedNumbers);
  validateFactsUsed(editorial.history?.factsUsed, 'history.factsUsed', allowed, sectionIssues.history);
  validateText(editorial.acc?.blurb, 'acc.blurb', 300, sectionIssues.acc, allowedNumbers);
  validateFactsUsed(editorial.acc?.factsUsed, 'acc.factsUsed', allowed, sectionIssues.acc);
  validateText(editorial.moment?.blurb, 'moment.blurb', 300, sectionIssues.moment, allowedNumbers);
  validateFactsUsed(editorial.moment?.factsUsed, 'moment.factsUsed', allowed, sectionIssues.moment);
  const issues = Object.values(sectionIssues).flat();
  return { approved: issues.length === 0, issues, sectionIssues };
}
