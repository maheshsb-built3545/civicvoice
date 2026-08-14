/**
 * auth.service.js
 * -----------------------------------------------------------------------
 * Authentication domain logic: register, login (bcrypt password verification),
 * and JWT signing/verification.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const config = require('../../config/env');

async function register({ name, email, username, password, role = 'citizen', wardIds = [], contact }) {
  if (!email || !password || !name) {
    throw new AppError('INVALID_INPUT', 400, 'name, email, and password are required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('USER_EXISTS', 409, `User with email ${email} already exists`);
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const fallbackUsername = username || `${normalizedEmail.split('@')[0]}_${Math.floor(Math.random() * 10000)}`;

  const user = await User.create({
    name,
    email: normalizedEmail,
    username: fallbackUsername.toLowerCase().trim(),
    passwordHash,
    role,
    wardIds,
    contact,
  });

  const payload = {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    role: user.role,
    wardIds: user.wardIds,
    tokenVersion: user.tokenVersion || 0,
  };

  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });

  return { token, user };
}

async function login(identifier, password) {
  if (!identifier || !password || typeof identifier !== 'string' || typeof password !== 'string') {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  }

  const normalizedIdentifier = identifier.toLowerCase().trim();
  const user = await User.findOne({
    $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
  });

  if (!user) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  }

  if (user.active === false) {
    throw new AppError('FORBIDDEN', 403, 'Account has been deactivated. Contact the system administrator.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  }

  const payload = {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    role: user.role,
    wardIds: user.wardIds,
    tokenVersion: user.tokenVersion || 0,
  };

  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });

  return { token, user };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired token');
  }
}

module.exports = { register, login, verifyToken };
