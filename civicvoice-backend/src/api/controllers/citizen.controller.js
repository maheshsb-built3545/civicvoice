/**
 * citizen.controller.js
 * -----------------------------------------------------------------------
 * Public controller for citizen complaint status lookup.
 */

const Complaint = require('../../models/Complaint');
const AppError = require('../../utils/AppError');

// Simple in-memory sliding rate limiter per phone number
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function isRateLimited(senderId) {
  const now = Date.now();
  const userRecord = rateLimitMap.get(senderId) || [];
  const validRequests = userRecord.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (validRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  validRequests.push(now);
  rateLimitMap.set(senderId, validRequests);
  return false;
}

async function getCitizenStatus(req, res, next) {
  try {
    const { senderId, phone, complaintId } = req.body;
    let lookupId = senderId || phone;

    if (!lookupId || typeof lookupId !== 'string') {
      throw new AppError('INVALID_INPUT', 400, 'senderId or phone is required');
    }

    const { formatIndianPhoneNumber } = require('../../utils/phoneHelper');
    lookupId = formatIndianPhoneNumber(lookupId);

    if (isRateLimited(lookupId)) {
      throw new AppError('TOO_MANY_REQUESTS', 429, 'Rate limit exceeded. Please try again later.');
    }

    const query = { senderId: lookupId };
    if (complaintId) {
      query._id = complaintId;
    }

    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .select('_id status structured channel lifecycleLog createdAt location wardId')
      .populate('wardId')
      .limit(10);

    if (!complaints || complaints.length === 0) {
      throw new AppError('NOT_FOUND', 404, 'No complaints found for the provided identifier');
    }

    res.status(200).json({ complaints });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCitizenStatus };
