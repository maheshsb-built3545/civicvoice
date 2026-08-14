/**
 * officer.service.js
 * -----------------------------------------------------------------------
 * Domain logic for Officer management (CRUD).
 */

const Officer = require('../../models/Officer');
const AppError = require('../../utils/AppError');

async function listOfficers({ wardId, department, page = 1, limit = 20 } = {}) {
  const query = { isDeleted: { $ne: true } };
  if (wardId) {
    query.wardIds = wardId;
  }
  if (department) {
    query.department = department;
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [officers, total] = await Promise.all([
    Officer.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Officer.countDocuments(query),
  ]);

  return { officers, total, page: safePage, limit: safeLimit };
}

async function createOfficer(data) {
  const { name, department, contact } = data;
  if (!name || !department || !contact) {
    throw new AppError('INVALID_INPUT', 400, 'name, department, and contact are required');
  }

  const officer = await Officer.create(data);
  return officer;
}

async function getOfficerById(id) {
  const officer = await Officer.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!officer) {
    throw new AppError('NOT_FOUND', 404, `Officer ${id} not found`);
  }
  return officer;
}

async function updateOfficer(id, updateData) {
  const officer = await Officer.findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateData, {
    new: true,
    runValidators: true,
  });

  if (!officer) {
    throw new AppError('NOT_FOUND', 404, `Officer ${id} not found`);
  }

  return officer;
}

async function deleteOfficer(id) {
  const officer = await Officer.findById(id);
  if (!officer || officer.isDeleted === true) {
    throw new AppError('NOT_FOUND', 404, `Officer ${id} not found`);
  }

  const Complaint = require('../../models/Complaint');
  const unresolvedCount = await Complaint.countDocuments({
    assignedOfficerId: id,
    status: { $ne: 'resolved' },
    isDeleted: { $ne: true }
  });

  if (unresolvedCount > 0) {
    throw new AppError('CONFLICT', 409, `Cannot delete officer: ${unresolvedCount} unresolved complaint(s) currently assigned.`);
  }

  officer.isDeleted = true;
  officer.active = false;
  await officer.save();

  if (officer.userId) {
    const User = require('../../models/User');
    await User.findByIdAndUpdate(officer.userId, { active: false });
  }

  return officer;
}

module.exports = {
  listOfficers,
  createOfficer,
  getOfficerById,
  updateOfficer,
  deleteOfficer,
};
