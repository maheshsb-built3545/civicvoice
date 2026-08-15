/**
 * auth.middleware.js
 * -----------------------------------------------------------------------
 * Verifies JWT token from Authorization header (Bearer <token>) or query token.
 * Attaches decoded user payload to req.user.
 * Rejects with 401 UNAUTHORIZED if missing or invalid.
 */

const { verifyToken } = require('../../domain/auth/auth.service');
const AppError = require('../../utils/AppError');

async function authMiddleware(req, res, next) {
  const authHeader = req.header('authorization') || req.header('Authorization');
  const queryToken = req.query && typeof req.query.token === 'string' ? req.query.token : null;

  let token = null;

  if (authHeader) {
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length === 2 && /^bearer$/i.test(parts[0]) && parts[1]) {
      token = parts[1];
    }
  }

  if (!token && queryToken) {
    token = queryToken;
  }

  if (!token) {
    return next(new AppError('UNAUTHORIZED', 401, 'Missing Authorization header or token'));
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;

    if (decoded.role === 'citizen') {
      const Citizen = require('../../models/Citizen');
      const citizen = await Citizen.findById(decoded.citizenId);
      if (!citizen) {
        return next(new AppError('UNAUTHORIZED', 401, 'Citizen account not found'));
      }
    } else if (decoded.role === 'officer') {
      const Officer = require('../../models/Officer');
      let officer = await Officer.findById(decoded.id);
      if (!officer) {
        officer = await Officer.findOne({ userId: decoded.id });
      }
      if (!officer || officer.active === false || officer.isDeleted === true || (officer.tokenVersion !== undefined && officer.tokenVersion !== decoded.tokenVersion)) {
        return next(new AppError('UNAUTHORIZED', 401, 'Officer account is deactivated or deleted'));
      }
    } else {
      const User = require('../../models/User');
      const user = await User.findById(decoded.id);
      if (!user || user.active === false || (user.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion)) {
        return next(new AppError('UNAUTHORIZED', 401, 'User account is deactivated'));
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.jwtAuth = authMiddleware;
