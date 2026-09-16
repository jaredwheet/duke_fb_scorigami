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
