/**
 * officer.controller.js
 * -----------------------------------------------------------------------
 * CRUD controller for Officers.
 */

const officerService = require('../../domain/officers/officer.service');
const AppError = require('../../utils/AppError');

async function createOfficer(req, res, next) {
  try {
    const { name, department, contact, phone, wardIds, wardId, role, userId, categories } = req.body;

    const contactField = contact || phone;
    if (!name || typeof name !== 'string') {
      throw new AppError('INVALID_INPUT', 400, 'name is required and must be a string');
    }
    if (!department || typeof department !== 'string') {
      throw new AppError('INVALID_INPUT', 400, 'department is required and must be a string');
    }
    if (!contactField || typeof contactField !== 'string') {
      throw new AppError('INVALID_INPUT', 400, 'contact/phone is required and must be a string');
    }

    const officerData = {
      name,
      department,
      contact: contactField,
      wardIds: wardIds || (wardId ? [wardId] : []),
      role: role || 'officer',
      userId: userId || null,
      categories: categories || [],
    };

    const officer = await officerService.createOfficer(officerData);
    res.status(201).json({ officer });
  } catch (err) {
    next(err);
  }
}

async function listOfficers(req, res, next) {
  try {
    const { wardId, department, page, limit } = req.query;
    const result = await officerService.listOfficers({ wardId, department, page, limit });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getOfficer(req, res, next) {
  try {
    const officer = await officerService.getOfficerById(req.params.id);
    res.status(200).json({ officer });
  } catch (err) {
    next(err);
  }
}

async function updateOfficer(req, res, next) {
  try {
    const officer = await officerService.updateOfficer(req.params.id, req.body);
    res.status(200).json({ officer });
  } catch (err) {
    next(err);
  }
}

async function deleteOfficer(req, res, next) {
  try {
    const officer = await officerService.deleteOfficer(req.params.id);
    res.status(200).json({ success: true, message: 'Officer removed successfully', officer });
  } catch (err) {
    next(err);
  }
}

async function checkOfficerDeletion(req, res, next) {
  try {
    const Complaint = require('../../models/Complaint');
    const unresolvedCount = await Complaint.countDocuments({
      assignedOfficerId: req.params.id,
      status: { $ne: 'resolved' },
      isDeleted: { $ne: true }
    });
    res.status(200).json({ unresolvedCount });
  } catch (err) {
    next(err);
  }
}

module.exports = { createOfficer, listOfficers, getOfficer, updateOfficer, deleteOfficer, checkOfficerDeletion };
