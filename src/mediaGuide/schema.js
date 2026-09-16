function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid media guide: ${message}`);
}

export function validateCitation(citation, label = 'citation') {
  assert(isObject(citation), `${label} must be an object`);
  assert(Number.isInteger(citation.pageStart) && citation.pageStart > 0, `${label}.pageStart must be a positive integer`);
  if (citation.pageEnd != null) {
    assert(Number.isInteger(citation.pageEnd) && citation.pageEnd >= citation.pageStart, `${label}.pageEnd must be after pageStart`);
  }
  assert(typeof citation.label === 'string' && citation.label.length > 0, `${label}.label is required`);
  return citation;
}

function validateClaim(claim, index) {
  assert(isObject(claim), `claim ${index} must be an object`);
  assert(typeof claim.id === 'string' && claim.id.length > 0, `claim ${index}.id is required`);
  assert(typeof claim.citationId === 'string' && claim.citationId.length > 0, `claim ${index}.citationId is required`);
  return claim;
}

export function validateMediaGuide(guide) {
  assert(isObject(guide), 'root must be an object');
  assert(guide.schemaVersion === 1, 'schemaVersion must be 1');
  assert(Number.isInteger(guide.edition) && guide.edition > 0, 'edition must be a positive integer');
  assert(typeof guide.title === 'string' && guide.title.length > 0, 'title is required');
  assert(isObject(guide.source), 'source is required');
  assert(typeof guide.source.file === 'string' && guide.source.file.length > 0, 'source.file is required');
  assert(Number.isInteger(guide.source.pageCount) && guide.source.pageCount > 0, 'source.pageCount must be a positive integer');
  assert(isObject(guide.citations), 'citations are required');
  for (const [id, citation] of Object.entries(guide.citations)) validateCitation(citation, `citations.${id}`);

  for (const key of ['seasonContext', 'seasonReviews', 'opponentSeries', 'programRecords', 'historicalFacts', 'historicalPlayers', 'comebackHistory']) {
    if (guide[key] == null) {
      if (key === 'historicalPlayers') continue;
      assert(false, `${key} must be an array`);
    }
    assert(Array.isArray(guide[key]), `${key} must be an array`);
    guide[key].forEach((claim, index) => validateClaim(claim, `${key}[${index}]`));
  }

  return guide;
}
