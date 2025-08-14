// JSON Schema for TAItem as per Rules.md (used for validation only)
export const TAItemSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'TAItem',
  type: 'object',
  required: ['id','candles','label','rationale'],
  additionalProperties: false,
  properties: {
  id: { type: 'string' },
    context: {
      type: 'object', additionalProperties: false, required: ['trend','vol'],
      properties: {
        trend: { type: 'string', enum: ['up','down','side'] },
        vol: { type: 'string', enum: ['low','med','high'] },
        gap: { type: 'boolean' }
      }
    },
    candles: {
      type: 'array', minItems: 2, maxItems: 5,
      items: {
        type: 'object', additionalProperties: false, required: ['o','h','l','c'],
        properties: { o:{type:'number'}, h:{type:'number'}, l:{type:'number'}, c:{type:'number'}, v:{type:'number'} }
      }
    },
  pattern_hint: { type: 'string' },
    label: { type: 'string', enum: ['bullish','bearish','neutral'] },
    rationale: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
    seed: { type: 'integer' }
  }
};
