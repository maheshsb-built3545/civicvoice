/**
 * complaint.service.js
 * -----------------------------------------------------------------------
 * The ONLY entry point into complaint domain logic and status mutation.
 * Orchestrates: traceId -> extraction -> ward resolution -> deduplication -> validation -> persistence -> auto-assignment -> event emission.
 */

const { v4: uuidv4 } = require('uuid');
const Complaint = require('../../models/Complaint');
const Officer = require('../../models/Officer');
const { extractComplaint } = require('../../ai/extraction/extraction.service');
const { resolveWard } = require('../../geo/wardResolver');
const { validateAssembledComplaint } = require('./complaint.validator');
const { COMPLAINT_STATUS, isValidStatusTransition } = require('./complaint.state');
const { assignComplaint: autoAssign } = require('../assignment/assignmentEngine');
const eventBus = require('../events/eventBus');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { checkWhatsAppRateLimit } = require('../../utils/redis');

const DEDUPLICATION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Creates a structured complaint from incoming message parameters.
 * @param {object} params
 * @param {string} params.channel - 'text' | 'whatsapp' | 'voice'
 * @param {string} params.senderId - sender identifier/phone
 * @param {string} params.rawText - raw complaint text or transcript
 * @param {object|Array} [params.coordinates] - optional GPS location { lat, lng } or [lng, lat]
 * @param {Date} [params.timestamp]
 * @param {string} [params.traceId]
 * @returns {Promise<object>} Saved Complaint document or duplicate notice object
 */
async function createComplaint({ channel = 'text', senderId, rawText, coordinates, timestamp, traceId: passedTraceId, categoryOverride, locationOverride, wardIdOverride, attachment, flaggedForReviewOverride, flagReasonOverride }) {
  if (!senderId || typeof senderId !== 'string') {
    throw new AppError('INVALID_INPUT', 400, 'senderId is required');
  }
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'rawText is required');
  }

  // 1. Build internal traceId
  const traceId = passedTraceId || `trace_${uuidv4()}`;

  // Rate limiting check for WhatsApp complaints (fail-open sliding-window)
  let flaggedForReview = flaggedForReviewOverride || false;
  let flagReason = flagReasonOverride || null;
  let flaggedAt = flaggedForReviewOverride ? new Date() : null;

  if (channel === 'whatsapp') {
    try {
      const rateLimitResult = await checkWhatsAppRateLimit(senderId, traceId);
      if (rateLimitResult.limitExceeded) {
        flaggedForReview = true;
        flagReason = flagReason ? `${flagReason},rate_limit` : 'rate_limit';
        flaggedAt = new Date();

        // Truncate/mask phone number to avoid raw PII in structured warnings
        const cleanSender = senderId.replace(/\D/g, '');
        const maskedPhone = cleanSender.length > 4
          ? `+${cleanSender.substring(0, 2)}******${cleanSender.substring(cleanSender.length - 4)}`
          : senderId;

        logger.warn('WhatsApp complaint rate limit exceeded', {
          traceId,
          phoneNumber: maskedPhone,
          submissionsCount: rateLimitResult.count
        });
      }
    } catch (err) {
      logger.error('Error executing rate limit check in service, failing open', { traceId, error: err.message });
    }
  }

  // 2. Call AI Extraction Engine
  let extractionResult;
  try {
    extractionResult = await extractComplaint(rawText, { channel, senderId, traceId });
  } catch (err) {
    logger.error('Extraction engine call failed', { traceId, error: err.message });
    if (err.isOperational) throw err;
    throw new AppError('EXTRACTION_FAILED', 502, `AI extraction failed: ${err.message}`);
  }

  const { structuredComplaint, needsClarification: extractionNeedsClarification } = extractionResult;

  if (categoryOverride) {
    structuredComplaint.category = categoryOverride;
  }
  if (locationOverride) {
    structuredComplaint.locationMentioned = locationOverride;
  }

  // 3. Call Geolocation & Ward Resolver (bypass if wardIdOverride is provided)
  let resolvedWardId = wardIdOverride || null;
  let resolutionMethod = wardIdOverride ? 'override' : 'unresolved';

  if (!resolvedWardId) {
    const wardResolution = await resolveWard({
      coordinates,
      locationText: structuredComplaint?.locationMentioned,
      traceId,
    });
    resolvedWardId = wardResolution.wardId;
    resolutionMethod = wardResolution.resolutionMethod;
  }

  // 4. Deduplication: Same sender, same category, same ward/location within 30 minutes
  const thirtyMinsAgo = new Date(Date.now() - DEDUPLICATION_WINDOW_MS);
  const dedupQuery = {
    senderId,
    'structured.category': structuredComplaint.category,
    createdAt: { $gte: thirtyMinsAgo },
  };

  if (resolvedWardId) {
    dedupQuery.wardId = resolvedWardId;
  } else if (structuredComplaint.locationMentioned) {
    dedupQuery['structured.locationMentioned'] = structuredComplaint.locationMentioned;
  }

  const existingDuplicate = await Complaint.findOne(dedupQuery).sort({ createdAt: -1 });

  if (existingDuplicate) {
    logger.info('Duplicate complaint detected within 30-minute window', {
      traceId,
      senderId,
      existingComplaintId: existingDuplicate._id,
    });

    return {
      duplicate: true,
      existingComplaintId: existingDuplicate._id,
      complaint: existingDuplicate,
    };
  }

  // 5. Determine initial status
  let initialStatus = COMPLAINT_STATUS.RECEIVED;
  let finalNeedsClarification = extractionNeedsClarification;
  const finalCategory = categoryOverride || structuredComplaint.category;
  const finalLocation = locationOverride || structuredComplaint.locationMentioned;

  if (categoryOverride && locationOverride) {
    finalNeedsClarification = false;
  } else if (!finalCategory || finalCategory === 'general' || !finalLocation || !finalLocation.trim()) {
    finalNeedsClarification = true;
  }

  // Conflict detection between text extraction and vision analysis
  if (attachment && attachment.visionAnalysis) {
    const textCat = structuredComplaint.category;
    const visionCat = attachment.visionAnalysis.visible_issue_category;
    if (
      textCat && textCat !== 'general' &&
      visionCat && visionCat !== 'general' && visionCat !== 'unclear' &&
      textCat !== visionCat
    ) {
      logger.warn('Category conflict detected between text and vision extraction', {
        traceId,
        textCategory: textCat,
        visionCategory: visionCat
      });
      finalNeedsClarification = true;
    }
  }

  structuredComplaint.needsClarification = finalNeedsClarification;

  if (finalNeedsClarification || (resolutionMethod === 'unresolved' && !wardIdOverride)) {
    initialStatus = COMPLAINT_STATUS.NEEDS_CLARIFICATION;
  }

  // 6. Validate assembled document against schema boundary
  validateAssembledComplaint({
    structured: structuredComplaint,
    wardId: resolvedWardId,
  });

  const locationToSave = coordinates
    ? {
        coordinates: Array.isArray(coordinates)
          ? [Number(coordinates[0]), Number(coordinates[1])]
          : [Number(coordinates.lng), Number(coordinates.lat)],
      }
    : undefined;

  // 7. Persist via Complaint Mongoose Model
  let complaint;
  try {
    complaint = await Complaint.create({
      traceId,
      channel: channel || 'text',
      senderId,
      rawText,
      structured: structuredComplaint,
      status: initialStatus,
      wardId: resolvedWardId || null,
      flaggedForReview,
      flagReason,
      flaggedAt,
      ...(locationToSave && { location: locationToSave }),
      attachments: attachment ? [attachment] : [],
      lifecycleLog: [
        {
          stage: initialStatus,
          timestamp: timestamp || new Date(),
        },
      ],
    });
  } catch (err) {
    logger.error('Complaint persistence failed', { traceId, error: err.message });
    throw new AppError('PERSISTENCE_FAILED', 500, `Failed to persist complaint: ${err.message}`);
  }

  // 8. Emit 'complaint.created' event on eventBus
  eventBus.emit('complaint.created', complaint);

  // Auto assignment attempt
  try {
    const assignment = await autoAssign(complaint);
    if (assignment && assignment.officerId) {
      complaint.assignedOfficerId = assignment.officerId;
      if (complaint.status === COMPLAINT_STATUS.RECEIVED) {
        complaint.status = COMPLAINT_STATUS.ASSIGNED;
      }
      complaint.lifecycleLog.push({
        stage: COMPLAINT_STATUS.ASSIGNED,
        timestamp: new Date(),
      });
      await complaint.save();

      eventBus.emit('complaint.assigned', { complaint, officerId: assignment.officerId });
    }
  } catch (assignErr) {
    logger.warn('Auto assignment error (non-blocking)', { traceId, error: assignErr.message });
  }

  return complaint;
}

/**
 * The ONLY function allowed to change a complaint's status field.
 * Validates transition against state machine rules and records audit trail.
 * @param {string} complaintId
 * @param {string} newStatus
 * @param {string} [actorId]
 * @param {string} [note]
 * @returns {Promise<object>} Updated complaint document
 */
async function updateComplaintStatus(complaintId, newStatus, actorId = 'system', note = '') {
  if (!complaintId) {
    throw new AppError('INVALID_INPUT', 400, 'complaintId is required');
  }
  if (!newStatus) {
    throw new AppError('INVALID_INPUT', 400, 'newStatus is required');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new AppError('NOT_FOUND', 404, `Complaint ${complaintId} not found`);
  }

  const currentStatus = complaint.status;
  const canonicalNewStatus =
    Object.values(COMPLAINT_STATUS).find((s) => s.toLowerCase() === newStatus.toString().trim().toLowerCase()) ||
    newStatus.toString().trim();

  if (!isValidStatusTransition(currentStatus, canonicalNewStatus)) {
    throw new AppError(
      'INVALID_TRANSITION',
      400,
      `Cannot transition status from '${currentStatus}' to '${canonicalNewStatus}'`
    );
  }

  complaint.status = canonicalNewStatus;
  complaint.lifecycleLog.push({
    stage: canonicalNewStatus,
    timestamp: new Date(),
    actorId,
    note,
  });

  await complaint.save();

  eventBus.emit('complaint.status_changed', { complaint, actorId, note });

  return complaint;
}

/**
 * @param {string} complaintId
 */
async function getComplaintById(complaintId) {
  return Complaint.findById(complaintId).populate('wardId', 'name');
}

/**
 * @param {object} filter
 */
async function listComplaints({ wardId, category, status, startDate, endDate, page = 1, limit = 20, showDeleted = false, assignedOfficerId, senderId, wardIds } = {}) {
  const query = { isDeleted: showDeleted ? true : { $ne: true } };

  if (wardId) {
    query.wardId = wardId;
  } else if (wardIds) {
    query.wardId = { $in: wardIds };
  }
  if (category) query['structured.category'] = category;
  if (status) query.status = status;
  if (assignedOfficerId) query.assignedOfficerId = assignedOfficerId;
  if (senderId) {
    const cleanPhone = senderId.replace(/\D/g, '');
    query.$or = [
      { senderId: senderId },
      { senderId: cleanPhone },
      { senderId: `+${cleanPhone}` }
    ];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [complaints, total] = await Promise.all([
    Complaint.find(query)
      .populate('wardId', 'name')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Complaint.countDocuments(query),
  ]);

  return { complaints, total, page: safePage, limit: safeLimit };
}

/**
 * @param {string} complaintId
 * @param {string} officerId
 */
async function assignComplaint(complaintId, officerId) {
  const [complaint, officer] = await Promise.all([
    Complaint.findById(complaintId),
    Officer.findById(officerId),
  ]);

  if (!complaint) {
    throw new AppError('NOT_FOUND', 404, `Complaint ${complaintId} not found`);
  }
  if (!officer) {
    throw new AppError('NOT_FOUND', 404, `Officer ${officerId} not found`);
  }

  complaint.assignedOfficerId = officer._id;
  complaint.status = COMPLAINT_STATUS.ASSIGNED;
  complaint.lifecycleLog.push({
    stage: COMPLAINT_STATUS.ASSIGNED,
    timestamp: new Date(),
  });

  await complaint.save();

  eventBus.emit('complaint.assigned', { complaint, officerId: officer._id });

  return complaint;
}

/**
 * @param {string} complaintId
 */
async function deleteComplaint(complaintId) {
  const result = await Complaint.findByIdAndUpdate(complaintId, { isDeleted: true }, { new: true });
  if (!result) {
    throw new AppError('NOT_FOUND', 404, `Complaint ${complaintId} not found`);
  }
  return { message: 'Complaint deleted successfully' };
}

/**
 * @param {string} complaintId
 */
async function deleteComplaintPermanent(complaintId) {
  const result = await Complaint.findByIdAndDelete(complaintId);
  if (!result) {
    throw new AppError('NOT_FOUND', 404, `Complaint ${complaintId} not found`);
  }
  return { message: 'Complaint permanently deleted successfully' };
}

/**
 * Manually updates the ward of a complaint and re-runs auto-assignment logic.
 * @param {string} complaintId
 * @param {string|null} wardId
 * @returns {Promise<object>} Updated complaint document
 */
async function updateComplaintWard(complaintId, wardId) {
  if (!complaintId) {
    throw new AppError('INVALID_INPUT', 400, 'complaintId is required');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new AppError('NOT_FOUND', 404, `Complaint ${complaintId} not found`);
  }

  // Update ward field
  complaint.wardId = wardId || null;

  // Re-trigger auto-assignment logic
  const assignment = await autoAssign(complaint);
  if (assignment && assignment.officerId) {
    complaint.assignedOfficerId = assignment.officerId;
    if (complaint.status === COMPLAINT_STATUS.RECEIVED || complaint.status === COMPLAINT_STATUS.NEEDS_CLARIFICATION) {
      complaint.status = COMPLAINT_STATUS.ASSIGNED;
      complaint.lifecycleLog.push({
        stage: COMPLAINT_STATUS.ASSIGNED,
        timestamp: new Date(),
        actorId: 'system',
        note: 'Auto assigned after manual ward correction'
      });
    }
  } else {
    // If no assignment found, clear officer assignment
    complaint.assignedOfficerId = null;
    if (complaint.status === COMPLAINT_STATUS.ASSIGNED) {
      complaint.status = COMPLAINT_STATUS.RECEIVED;
      complaint.lifecycleLog.push({
        stage: COMPLAINT_STATUS.RECEIVED,
        timestamp: new Date(),
        actorId: 'system',
        note: 'Assignment cleared after manual ward correction'
      });
    }
  }

  await complaint.save();

  if (complaint.assignedOfficerId) {
    eventBus.emit('complaint.assigned', { complaint, officerId: complaint.assignedOfficerId });
  }

  // Re-fetch populated ward before returning
  return Complaint.findById(complaint._id).populate('wardId', 'name');
}

module.exports = {
  createComplaint,
  updateComplaintStatus,
  getComplaintById,
  listComplaints,
  assignComplaint,
  deleteComplaint,
  deleteComplaintPermanent,
  updateComplaintWard,
};
