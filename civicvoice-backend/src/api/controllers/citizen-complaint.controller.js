const Citizen = require('../../models/Citizen');
const Complaint = require('../../models/Complaint');
const complaintService = require('../../domain/complaints/complaint.service');
const AppError = require('../../utils/AppError');

async function listMyComplaints(req, res, next) {
  try {
    const citizenId = req.user && req.user.citizenId;

    if (!citizenId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Citizen authentication required',
      });
    }

    const citizen = await Citizen.findById(citizenId);
    if (!citizen) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Citizen not found',
      });
    }

    const cleanPhone = citizen.phone.replace(/\D/g, '');
    const { status } = req.query;

    const query = {
      $or: [
        { senderId: citizen.phone },
        { senderId: cleanPhone },
        { senderId: `+${cleanPhone}` }
      ]
    };

    if (status) {
      query.status = status;
    }

    const complaints = await Complaint.find(query)
      .populate('wardId')
      .sort({ createdAt: -1 });

    const formattedComplaints = complaints.map(c => ({
      id: c._id,
      category: c.structured?.category || 'general',
      description: c.structured?.description || c.rawText,
      status: c.status,
      createdAt: c.createdAt,
      imageUrl: c.imageUrl || null,
      location: c.location,
      structured: c.structured,
      wardId: c.wardId
    }));

    return res.status(200).json(formattedComplaints);
  } catch (err) {
    next(err);
  }
}

async function createMyComplaint(req, res, next) {
  try {
    const citizenId = req.user && req.user.citizenId;

    if (!citizenId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Citizen authentication required',
      });
    }

    const citizen = await Citizen.findById(citizenId);
    if (!citizen) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Citizen not found',
      });
    }

    const { description, category, location } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'description is required',
      });
    }

    const complaint = await complaintService.createComplaint({
      channel: 'whatsapp', // Using whatsapp triggers the WhatsApp notifications
      senderId: citizen.phone,
      rawText: description.trim(),
      categoryOverride: category && category !== 'Auto-detect' ? category : undefined,
      locationOverride: location && location.trim() ? location.trim() : undefined,
    });

    return res.status(201).json(complaint);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMyComplaints,
  createMyComplaint
};
