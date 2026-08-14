/**
 * extraction.schema.js
 * -----------------------------------------------------------------------
 * Schema definition for civic complaint extraction output.
 * Fields:
 *  - category: string (e.g. 'water_supply', 'roads', 'sanitation', 'electricity', 'drainage', 'general')
 *  - subcategory: string | null
 *  - description: string (concise summary in English)
 *  - urgency: 'low' | 'medium' | 'high'
 *  - locationMentioned: string | null (place name, landmark, ward, street, etc.)
 *  - language: string (e.g. 'en', 'hi', 'mr', 'kn')
 *  - confidence: number (0.0 to 1.0)
 *  - needsClarification: boolean (MUST be true if category OR locationMentioned is ambiguous/missing)
 */

const STRUCTURED_COMPLAINT_FIELDS = [
  'category',
  'subcategory',
  'description',
  'urgency',
  'locationMentioned',
  'language',
  'confidence',
  'needsClarification',
];

const URGENCY_LEVELS = ['low', 'medium', 'high'];

const EXTRACTION_TOOL_DEFINITION = {
  type: 'function',
  function: {
    name: 'extract_complaint',
    description: 'Extract structured civic complaint details from citizen raw text or transcript.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Primary civic category in lowercase_snake_case (e.g. water_supply, roads, sanitation, electricity, drainage). Use "general" if ambiguous.',
        },
        subcategory: {
          type: ['string', 'null'],
          description: 'More specific subcategory label, or null if none fits.',
        },
        description: {
          type: 'string',
          description: 'Short 1-2 sentence English summary of the issue.',
        },
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Urgency level of the complaint.',
        },
        locationMentioned: {
          type: ['string', 'null'],
          description: 'Specific street, area, landmark, or ward mentioned in text, or null if missing/unclear.',
        },
        language: {
          type: 'string',
          description: 'Primary detected language code of original input (e.g. en, hi, mr, kn).',
        },
        confidence: {
          type: 'number',
          description: 'Extraction confidence score between 0.0 and 1.0.',
        },
        needsClarification: {
          type: 'boolean',
          description: 'MUST be true if you CANNOT confidently determine EITHER category OR locationMentioned. Never guess low-confidence values into category or locationMentioned.',
        },
      },
      required: [
        'category',
        'description',
        'urgency',
        'language',
        'confidence',
        'needsClarification',
      ],
    },
  },
};

module.exports = {
  STRUCTURED_COMPLAINT_FIELDS,
  URGENCY_LEVELS,
  EXTRACTION_TOOL_DEFINITION,
};
