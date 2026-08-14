const Officer = require('../../models/Officer');
const Complaint = require('../../models/Complaint');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config/env');
const AppError = require('../../utils/AppError');
const { COMPLAINT_STATUS } = require('../complaints/complaint.state');

async function officerLogin({ officerId, password }) {
  if (!officerId || !password) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid credentials');
  }

  const officer = await Officer.findOne({ officerId: { $regex: new RegExp('^' + officerId.trim() + '$', 'i') } });
  if (!officer || officer.active !== true) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, officer.password);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid credentials');
  }

  const payload = {
    id: officer._id.toString(),
    officerId: officer.officerId,
    role: 'officer',
    name: officer.name,
    tokenVersion: officer.tokenVersion || 0,
  };

  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });

  return {
    token,
    role: 'officer',
    officer: {
      officerId: officer.officerId,
      name: officer.name,
    },
  };
}

async function changeOfficerPassword({ officerId, currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw new AppError('INVALID_INPUT', 400, 'Current and new passwords are required');
  }

  const officer = await Officer.findOne({ officerId: { $regex: new RegExp('^' + officerId.trim() + '$', 'i') } });
  if (!officer || officer.active !== true) {
    throw new AppError('NOT_FOUND', 404, 'Officer not found');
  }

  const valid = await bcrypt.compare(currentPassword, officer.password);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Incorrect current password');
  }

  const saltRounds = 10;
  officer.password = await bcrypt.hash(newPassword, saltRounds);
  await officer.save();

  return { message: 'Password changed successfully' };
}

async function listAssignedComplaints({ officerId, status, category }) {
  const officer = await Officer.findOne({ officerId: { $regex: new RegExp('^' + officerId.trim() + '$', 'i') } });
  if (!officer) {
    throw new AppError('NOT_FOUND', 404, 'Officer not found');
  }

  const query = { assignedOfficerId: officer._id };
  if (status) {
    query.status = status;
  }
  if (category) {
    query['structured.category'] = category;
  }

  const complaints = await Complaint.find(query).populate('wardId', 'name').sort({ createdAt: -1 });
  return complaints;
}

async function updateAssignedComplaintStatus({ officerId, complaintId, status, note }) {
  const officer = await Officer.findOne({ officerId: { $regex: new RegExp('^' + officerId.trim() + '$', 'i') } });
  if (!officer) {
    throw new AppError('NOT_FOUND', 404, 'Officer not found');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new AppError('NOT_FOUND', 404, 'Complaint not found');
  }

  if (String(complaint.assignedOfficerId) !== String(officer._id)) {
    throw new AppError('FORBIDDEN', 403, 'You are not authorized to update this complaint');
  }

  if (!Object.values(COMPLAINT_STATUS).includes(status)) {
    throw new AppError('INVALID_INPUT', 400, `Invalid status value: ${status}`);
  }

  complaint.status = status;
  const actorId = officer.officerId;
  const logNote = note || `Status updated by Officer ${officer.officerId}`;
  complaint.lifecycleLog.push({
    stage: status,
    actorId,
    note: logNote,
  });

  await complaint.save();

  // Trigger outbound WhatsApp status change notification
  const eventBus = require('../events/eventBus');
  eventBus.emit('complaint.status_changed', { complaint, actorId, note: logNote });

  return complaint;
}

async function requestPasswordReset({ officerId }) {
  if (!officerId) {
    throw new AppError('INVALID_INPUT', 400, 'Officer ID is required');
  }

  const officer = await Officer.findOne({ officerId: { $regex: new RegExp('^' + officerId.trim() + '$', 'i') } });
  if (!officer) {
    throw new AppError('NOT_FOUND', 404, 'Officer not found');
  }

  officer.passwordResetRequested = true;
  await officer.save();

  return { message: 'Password reset request submitted successfully' };
}

async function updateAssignedComplaintWard({ officerId, complaintId, wardId }) {
  const officer = await Officer.findOne({ officerId: { $regex: new RegExp('^' + officerId.trim() + '$', 'i') } });
  if (!officer) {
    throw new AppError('NOT_FOUND', 404, 'Officer not found');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new AppError('NOT_FOUND', 404, 'Complaint not found');
  }

  // Make sure the complaint is currently assigned to this officer
  if (String(complaint.assignedOfficerId) !== String(officer._id)) {
    throw new AppError('FORBIDDEN', 403, 'You are not authorized to update this complaint');
  }

  const complaintService = require('../complaints/complaint.service');
  return await complaintService.updateComplaintWard(complaintId, wardId);
}

module.exports = {
  officerLogin,
  changeOfficerPassword,
  listAssignedComplaints,
  updateAssignedComplaintStatus,
  requestPasswordReset,
  updateAssignedComplaintWard,
};
