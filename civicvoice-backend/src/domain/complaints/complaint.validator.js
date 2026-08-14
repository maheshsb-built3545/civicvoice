/**
 * complaint.validator.js
 * -----------------------------------------------------------------------
 * Validates the structuredComplaint object and assembled complaint metadata
 * before allowing persistence to Mongo. Fails closed.
 */

const { z } = require('zod');
const { URGENCY_LEVELS } = require('../../ai/extraction/extraction.schema');
const AppError = require('../../utils/AppError');

const structuredComplaintSchema = z.object({
  category: z.string().min(1),
  subcategory: z.string().nullable().optional(),
  description: z.string().min(1),
  urgency: z.enum(URGENCY_LEVELS),
  locationMentioned: z.string().nullable().optional(),
  language: z.string().min(1),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean().optional(),
});

const assembledComplaintSchema = z.object({
  structured: structuredComplaintSchema,
  wardId: z.string().nullable().optional(),
});

/**
 * Validates structured complaint output from extraction.
 * @param {object} structuredComplaint
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
function validateStructuredComplaint(structuredComplaint) {
  const result = structuredComplaintSchema.safeParse(structuredComplaint);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Strict validator for assembled complaint payloads before Mongo persistence.
 * @param {object} complaintData
 * @throws AppError INVALID_INPUT (400) if validation fails closed
 */
function validateAssembledComplaint(complaintData) {
  const result = assembledComplaintSchema.safeParse(complaintData);

  if (!result.success) {
    const errorMsg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new AppError('INVALID_INPUT', 400, `Complaint validation failed: ${errorMsg}`);
  }

  return result.data;
}

module.exports = { validateStructuredComplaint, validateAssembledComplaint };
