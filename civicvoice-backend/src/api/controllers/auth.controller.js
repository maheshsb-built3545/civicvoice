/**
 * auth.controller.js
 * -----------------------------------------------------------------------
 * Auth endpoints controller.
 */

const authService = require('../../domain/auth/auth.service');
const AppError = require('../../utils/AppError');

async function login(req, res, next) {
  try {
    const { email, username, password } = req.body;
    const loginIdentifier = email || username;

    if (!loginIdentifier || !password) {
      throw new AppError('INVALID_INPUT', 400, 'email (or username/id) and password are required');
    }

    if (/^off-/i.test(loginIdentifier.trim())) {
      const officerPortalService = require('../../domain/officers/officer-portal.service');
      const result = await officerPortalService.officerLogin({ officerId: loginIdentifier, password });
      return res.status(200).json({
        token: result.token,
        user: {
          id: result.officer.officerId,
          name: result.officer.name,
          email: '',
          role: 'officer',
          wardIds: [],
          contact: ''
        }
      });
    }

    const { token, user } = await authService.login(loginIdentifier, password);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wardIds: user.wardIds,
        contact: user.contact,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const { name, email, password, role, wardIds, contact } = req.body;

    const { token, user } = await authService.register({
      name,
      email,
      password,
      role,
      wardIds,
      contact,
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wardIds: user.wardIds,
        contact: user.contact,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    res.status(200).json({ user: req.user });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, me };
