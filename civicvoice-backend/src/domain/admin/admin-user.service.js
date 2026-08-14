const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');

function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex'); // 8 character alphanumeric password
}

async function generateUniqueAdminId() {
  let attempts = 0;
  while (attempts < 100) {
    const num = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    const id = `ADM-${num}`;
    const exists = await User.exists({ username: id.toLowerCase() });
    if (!exists) {
      return id;
    }
    attempts++;
  }
  throw new AppError('SERVER_ERROR', 500, 'Failed to generate a unique Admin ID');
}

async function createAdminAccount({ name, email, contact, creatorId }) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'name is required');
  }

  if (typeof email !== 'string' || !email.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'email is required');
  }

  if (typeof contact !== 'string' || !contact.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'contact is required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new AppError('INVALID_INPUT', 400, 'Invalid email format');
  }

  // Duplicate email check
  const emailExists = await User.exists({ email: normalizedEmail });
  if (emailExists) {
    throw new AppError('USER_EXISTS', 409, `User with email ${email} already exists`);
  }

  // Duplicate contact/phone check
  const contactExists = await User.exists({ contact: contact.trim() });
  if (contactExists) {
    throw new AppError('USER_EXISTS', 409, `User with contact number ${contact} already exists`);
  }

  const adminId = await generateUniqueAdminId();
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const admin = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    username: adminId.toLowerCase(),
    passwordHash,
    role: 'admin',
    contact: contact.trim(),
    active: true,
    createdBy: creatorId ? new mongoose.Types.ObjectId(creatorId) : null,
    passwordResetRequested: true, // require reset on first login
  });

  return {
    adminId,
    password: tempPassword, // Return the PLAINTEXT temporary password ONLY in this response
    admin: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      username: admin.username,
      contact: admin.contact,
      role: admin.role,
      active: admin.active,
      createdAt: admin.createdAt,
    },
    message: 'Admin account created successfully',
  };
}

async function listAdmins() {
  const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } })
    .populate('createdBy', 'name username')
    .sort({ createdAt: -1 })
    .lean();

  return admins;
}

async function updateAdminStatus(adminId, { active }) {
  if (typeof active !== 'boolean') {
    throw new AppError('INVALID_INPUT', 400, 'active status must be a boolean');
  }

  const admin = await User.findByIdAndUpdate(
    adminId,
    { active },
    { new: true, runValidators: true }
  );

  if (!admin) {
    throw new AppError('NOT_FOUND', 404, `Admin user with ID ${adminId} not found`);
  }

  return admin;
}

module.exports = {
  createAdminAccount,
  listAdmins,
  updateAdminStatus,
};
