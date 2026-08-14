/**
 * vision.schema.js
 * -----------------------------------------------------------------------
 * Schema validation logic for civic complaint image analysis outputs.
 */

const { z } = require('zod');

const VISIBLE_ISSUE_CATEGORIES = [
  'roads',
  'water',
  'electricity',
  'sanitation',
  'law_and_order',
  'public_property',
  'streetlight',
  'drainage',
  'general',
  'unclear'
];

const SEVERITY_ESTIMATES = ['low', 'medium', 'high', 'unable_to_determine'];

const MATCHES_CAPTIONS = ['match', 'partial_match', 'mismatch', 'no_caption_provided'];

const visionAnalysisSchema = z.object({
  visible_issue_category: z.enum(VISIBLE_ISSUE_CATEGORIES),
  visual_description: z.string().min(1),
  severity_estimate: z.enum(SEVERITY_ESTIMATES),
  matches_caption: z.enum(MATCHES_CAPTIONS),
  is_civic_complaint_image: z.boolean(),
  confidence: z.number().min(0).max(1),
  flag_for_human_review: z.boolean()
});

/**
 * Validates raw object against vision analysis schema.
 * @param {object} data
 * @returns {object} validated data
 */
function validateVisionAnalysis(data) {
  return visionAnalysisSchema.parse(data);
}

module.exports = {
  VISIBLE_ISSUE_CATEGORIES,
  SEVERITY_ESTIMATES,
  MATCHES_CAPTIONS,
  validateVisionAnalysis,
  visionAnalysisSchema
};
