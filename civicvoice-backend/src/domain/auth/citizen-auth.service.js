const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Citizen = require('../../models/Citizen');
const AppError = require('../../utils/AppError');
const config = require('../../config/env');
const { formatIndianPhoneNumber } = require('../../utils/phoneHelper');

async function signup(name, phone, password) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'name is required');
  }

  if (typeof phone !== 'string' || !phone.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'phone is required');
  }

  const formattedPhone = formatIndianPhoneNumber(phone);

  if (typeof password !== 'string' || !password) {
    throw new AppError('INVALID_INPUT', 400, 'password is required');
  }

  const existing = await Citizen.findOne({ phone: formattedPhone });
  if (existing) {
    throw new AppError('PHONE_ALREADY_REGISTERED', 409, 'Phone already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const citizen = await Citizen.create({ name: name.trim(), phone: formattedPhone, passwordHash });

  const token = jwt.sign({ citizenId: citizen._id.toString(), role: 'citizen' }, config.jwtSecret, { expiresIn: '8h' });

  return { token, role: 'citizen' };
}

async function login(phone, password) {
  if (typeof phone !== 'string' || !phone.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'phone is required');
  }

  const formattedPhone = formatIndianPhoneNumber(phone);

  if (typeof password !== 'string' || !password) {
    throw new AppError('INVALID_INPUT', 400, 'password is required');
  }

  const citizen = await Citizen.findOne({ phone: formattedPhone });
  if (!citizen) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid phone or password');
  }

  const valid = await bcrypt.compare(password, citizen.passwordHash);
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid phone or password');
  }

  const token = jwt.sign({ citizenId: citizen._id.toString(), role: 'citizen' }, config.jwtSecret, { expiresIn: '8h' });

  return { token, role: 'citizen' };
}

module.exports = { signup, login };
