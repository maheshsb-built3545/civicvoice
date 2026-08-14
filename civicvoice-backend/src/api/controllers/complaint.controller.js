/**
 * complaint.controller.js
 * -----------------------------------------------------------------------
 * Controller for complaint endpoints. Thin HTTP wrapper over complaint.service.js.
 */

const complaintService = require('../../domain/complaints/complaint.service');
const AppError = require('../../utils/AppError');
const { COMPLAINT_STATUS } = require('../../domain/complaints/complaint.state');

async function createComplaint(req, res, next) {
  try {
    const { senderId, text, coordinates } = req.body;

    if (!senderId || typeof senderId !== 'string') {
      throw new AppError('INVALID_INPUT', 400, 'senderId is required and must be a string');
    }
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new AppError('INVALID_INPUT', 400, 'text is required and must be a non-empty string');
    }

    const result = await complaintService.createComplaint({
      channel: 'text',
      senderId,
      rawText: text,
      coordinates,
      traceId: req.traceId,
    });

    if (result.duplicate) {
      return res.status(200).json({
        duplicate: true,
        complaintId: result.existingComplaintId,
        message: 'Duplicate complaint detected within 30 minutes',
        complaint: result.complaint,
      });
    }

    const complaint = result.complaint || result;
    const httpStatus = complaint.status === COMPLAINT_STATUS.NEEDS_CLARIFICATION ? 422 : 201;

    res.status(httpStatus).json({
      complaintId: complaint._id,
      status: complaint.status,
      structured: complaint.structured,
    });
  } catch (err) {
    next(err);
  }
}

async function getComplaint(req, res, next) {
  try {
    const complaint = await complaintService.getComplaintById(req.params.id);

    if (!complaint) {
      throw new AppError('NOT_FOUND', 404, `Complaint ${req.params.id} not found`);
    }

    const role = req.user.role;
    let isAuthorized = false;

    if (role === 'superadmin' || role === 'admin') {
      isAuthorized = true;
    } else if (role === 'ward_admin') {
      const userWardIds = req.user.wardIds || [];
      if (complaint.wardId && userWardIds.some(id => String(id) === String(complaint.wardId))) {
        isAuthorized = true;
      }
    } else if (role === 'officer') {
      if (String(complaint.assignedOfficerId) === req.user.id) {
        isAuthorized = true;
      }
    } else if (role === 'citizen') {
      const Citizen = require('../../models/Citizen');
      const citizen = await Citizen.findById(req.user.citizenId);
      if (citizen && citizen.phone) {
        const cleanPhone = citizen.phone.replace(/\D/g, '');
        const cleanSender = complaint.senderId.replace(/\D/g, '');
        if (cleanPhone === cleanSender) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      throw new AppError('FORBIDDEN', 403, 'Access denied to this complaint');
    }

    res.status(200).json({ complaint });
  } catch (err) {
    next(err);
  }
}

async function listComplaints(req, res, next) {
  try {
    const { wardId, category, status, startDate, endDate, page, limit, deleted, showDeleted } = req.query;
    const isDeletedFlag = deleted === 'true' || showDeleted === 'true';

    const role = req.user.role;
    let assignedOfficerId = undefined;
    let senderId = undefined;
    let wardIds = undefined;

    if (role === 'superadmin' || role === 'admin') {
      // No extra filtering
    } else if (role === 'ward_admin') {
      const userWardIds = req.user.wardIds || [];
      if (wardId) {
        if (!userWardIds.some(id => String(id) === String(wardId))) {
          throw new AppError('FORBIDDEN', 403, 'Access denied to requested ward');
        }
      } else {
        wardIds = userWardIds;
      }
    } else if (role === 'officer') {
      assignedOfficerId = req.user.id;
    } else if (role === 'citizen') {
      const Citizen = require('../../models/Citizen');
      const citizen = await Citizen.findById(req.user.citizenId);
      if (!citizen || !citizen.phone) {
        throw new AppError('UNAUTHORIZED', 401, 'Citizen account not found');
      }
      senderId = citizen.phone;
    } else {
      throw new AppError('FORBIDDEN', 403, 'Access denied');
    }

    const result = await complaintService.listComplaints({
      wardId,
      category,
      status,
      startDate,
      endDate,
      page,
      limit,
      showDeleted: isDeletedFlag,
      assignedOfficerId,
      senderId,
      wardIds
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function assignComplaint(req, res, next) {
  try {
    const { officerId } = req.body;

    if (!officerId || typeof officerId !== 'string') {
      throw new AppError('INVALID_INPUT', 400, 'officerId is required and must be a string');
    }

    const complaint = await complaintService.assignComplaint(req.params.id, officerId);
    res.status(200).json({ complaint });
  } catch (err) {
    next(err);
  }
}

async function updateComplaintStatus(req, res, next) {
  try {
    const { status, note } = req.body;
    const actorId = req.user?.id || req.user?.userId || 'officer';

    if (!status || typeof status !== 'string') {
      throw new AppError('INVALID_INPUT', 400, 'status is required and must be a string');
    }

    const complaint = await complaintService.updateComplaintStatus(req.params.id, status, actorId, note);
    res.status(200).json({ complaint });
  } catch (err) {
    next(err);
  }
}

async function deleteComplaint(req, res, next) {
  try {
    const { permanent } = req.query;
    let result;
    if (permanent === 'true') {
      result = await complaintService.deleteComplaintPermanent(req.params.id);
    } else {
      result = await complaintService.deleteComplaint(req.params.id);
    }
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateComplaintWard(req, res, next) {
  try {
    const { wardId } = req.body;
    const complaint = await complaintService.updateComplaintWard(req.params.id, wardId);
    res.status(200).json({ complaint });
  } catch (err) {
    next(err);
  }
}

module.exports = { createComplaint, getComplaint, listComplaints, assignComplaint, updateComplaintStatus, deleteComplaint, updateComplaintWard };
