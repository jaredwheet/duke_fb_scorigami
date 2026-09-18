function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid media guide: ${message}`);
}

export function validateCitation(citation, label = 'citation', pageCount = null) {
  assert(isObject(citation), `${label} must be an object`);
  assert(Number.isInteger(citation.pageStart) && citation.pageStart > 0, `${label}.pageStart must be a positive integer`);
  if (citation.pageEnd != null) {
    assert(Number.isInteger(citation.pageEnd) && citation.pageEnd >= citation.pageStart, `${label}.pageEnd must be after pageStart`);
  }
  if (pageCount != null) {
    assert(citation.pageStart <= pageCount, `${label}.pageStart exceeds source.pageCount`);
    assert((citation.pageEnd || citation.pageStart) <= pageCount, `${label}.pageEnd exceeds source.pageCount`);
  }
  assert(typeof citation.label === 'string' && citation.label.length > 0, `${label}.label is required`);
  return citation;
}

function validateClaim(claim, index, citations, pageCount, claimIds) {
  assert(isObject(claim), `claim ${index} must be an object`);
  assert(typeof claim.id === 'string' && claim.id.trim().length > 0, `claim ${index}.id is required`);
  assert(!claimIds.has(claim.id), `claim ${index}.id is duplicated`);
  claimIds.add(claim.id);
  assert(typeof claim.citationId === 'string' && claim.citationId.trim().length > 0, `claim ${index}.citationId is required`);
  assert(Object.hasOwn(citations, claim.citationId), `claim ${index}.citationId does not resolve`);
  return claim;
}

export function validateMediaGuide(guide) {
  assert(isObject(guide), 'root must be an object');
  assert(guide.schemaVersion === 1, 'schemaVersion must be 1');
  assert(Number.isInteger(guide.edition) && guide.edition > 0, 'edition must be a positive integer');
  assert(guide.edition === 2026, 'only the reviewed 2026 guide is supported');
  assert(guide.title === '2026 Duke Football Media Guide', 'title must identify the reviewed 2026 guide');
  assert(isObject(guide.source), 'source is required');
  assert(typeof guide.source.file === 'string' && guide.source.file.length > 0, 'source.file is required');
  assert(Number.isInteger(guide.source.pageCount) && guide.source.pageCount > 0, 'source.pageCount must be a positive integer');
  assert(guide.source.pageCount === 308, 'source.pageCount must be 308 for the reviewed guide');
  assert(typeof guide.source.reviewedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(guide.source.reviewedAt), 'source.reviewedAt must be a date');
  assert(typeof guide.source.sha256 === 'string' && /^[0-9a-f]{64}$/.test(guide.source.sha256), 'source.sha256 must be a lowercase SHA-256');
  assert(isObject(guide.citations), 'citations are required');
  for (const [id, citation] of Object.entries(guide.citations)) validateCitation(citation, `citations.${id}`, guide.source.pageCount);

  const claimIds = new Set();
  for (const key of ['seasonContext', 'seasonReviews', 'opponentSeries', 'programRecords', 'historicalFacts', 'historicalPlayers', 'comebackHistory']) {
    if (guide[key] == null) {
      if (key === 'historicalPlayers') continue;
      assert(false, `${key} must be an array`);
    }
    assert(Array.isArray(guide[key]), `${key} must be an array`);
    guide[key].forEach((claim, index) => validateClaim(claim, `${key}[${index}]`, guide.citations, guide.source.pageCount, claimIds));
  }

  return guide;
}
