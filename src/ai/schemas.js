export const recapSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    subheadline: { type: 'string' },
    narrative: { type: 'string' },
    factsUsed: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline', 'subheadline', 'narrative', 'factsUsed', 'warnings'],
};

export const sectionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    context: { type: 'string' },
    factsUsed: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['context', 'factsUsed', 'warnings'],
};

export const accSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    blurb: { type: 'string' },
    factsUsed: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['blurb', 'factsUsed', 'warnings'],
};

export const momentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    blurb: { type: 'string' },
    factsUsed: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['blurb', 'factsUsed', 'warnings'],
};

export const momentScoutSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    candidates: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          claim: { type: 'string', maxLength: 300 },
          evidence: { type: 'string', maxLength: 1800 },
          sourceUrls: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 2048 } },
          confidence: { type: 'string', enum: ['lead', 'corroborated'] },
          factsUsed: { type: 'array', items: { type: 'string' } },
        },
        required: ['type', 'claim', 'evidence', 'sourceUrls', 'confidence', 'factsUsed'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['candidates', 'warnings'],
};
