const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Officer = require('../../models/Officer');
const Ward = require('../../models/Ward');
const AppError = require('../../utils/AppError');

function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex'); // 8 character alphanumeric password
}

async function generateUniqueOfficerId() {
  let attempts = 0;
  while (attempts < 100) {
    const num = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    const id = `OFF-${num}`;
    const exists = await Officer.exists({ officerId: id });
    if (!exists) {
      return id;
    }
    attempts++;
  }
  throw new AppError('SERVER_ERROR', 500, 'Failed to generate a unique Officer ID');
}

async function createOfficerAccount({ name, phone, email, categories, wards }) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'name is required');
  }

  if (typeof phone !== 'string' || !phone.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'phone is required');
  }

  const officerCategories = Array.isArray(categories) && categories.length > 0
    ? categories
    : ['*'];

  if (!Array.isArray(wards) || wards.length === 0) {
    throw new AppError('INVALID_INPUT', 400, 'wards must be a non-empty array');
  }

  const wardObjectIds = [];
  for (const w of wards) {
    if (!mongoose.Types.ObjectId.isValid(w)) {
      throw new AppError('INVALID_INPUT', 400, `ward ${w} must be a valid ObjectId`);
    }
    const wardExists = await Ward.exists({ _id: w });
    if (!wardExists) {
      throw new AppError('INVALID_INPUT', 400, `ward ${w} does not exist`);
    }
    wardObjectIds.push(new mongoose.Types.ObjectId(w));
  }

  const officerId = await generateUniqueOfficerId();
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const officer = await Officer.create({
    name: name.trim(),
    officerId,
    password: passwordHash,
    email: (email || '').trim().toLowerCase(),
    contact: phone.trim(),
    categories: officerCategories,
    wardIds: wardObjectIds,
    active: true,
  });

  return {
    officerId: officer.officerId,
    password: tempPassword, // Return the PLAINTEXT temporary password ONLY in this response
    officer: {
      _id: officer._id,
      name: officer.name,
      email: officer.email,
      contact: officer.contact,
      categories: officer.categories,
      wardIds: officer.wardIds,
      createdAt: officer.createdAt,
    },
    message: 'Officer account created successfully',
  };
}

async function listOfficers() {
  const officers = await Officer.aggregate([
    {
      $match: { isDeleted: { $ne: true } },
    },
    {
      $lookup: {
        from: 'complaints',
        localField: '_id',
        foreignField: 'assignedOfficerId',
        as: 'complaints',
      },
    },
    {
      $lookup: {
        from: 'wards',
        localField: 'wardIds',
        foreignField: '_id',
        as: 'wards',
      },
    },
    {
      $project: {
        _id: 1,
        officerId: 1,
        name: 1,
        email: 1,
        contact: 1,
        categories: 1,
        wardIds: 1,
        active: 1,
        role: 1,
        createdAt: 1,
        passwordResetRequested: 1,
        wards: {
          $map: {
            input: '$wards',
            as: 'w',
            in: { _id: '$$w._id', name: '$$w.name' },
          },
        },
        totalAssigned: { $size: '$complaints' },
        resolved: {
          $size: {
            $filter: {
              input: '$complaints',
              as: 'c',
              cond: { $eq: ['$$c.status', 'resolved'] },
            },
          },
        },
        pending: {
          $size: {
            $filter: {
              input: '$complaints',
              as: 'c',
              cond: { $ne: ['$$c.status', 'resolved'] },
            },
          },
        },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
  ]);
  return officers;
}

async function adminResetOfficerPassword(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('INVALID_INPUT', 400, 'Invalid officer ID');
  }

  const officer = await Officer.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!officer) {
    throw new AppError('NOT_FOUND', 404, 'Officer not found');
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  officer.password = passwordHash;
  officer.passwordResetRequested = false;
  await officer.save();

  return {
    officerId: officer.officerId,
    password: tempPassword,
    message: 'Password reset successfully',
  };
}

module.exports = { createOfficerAccount, listOfficers, adminResetOfficerPassword };
