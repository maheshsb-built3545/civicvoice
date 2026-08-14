/**
 * rbac.middleware.js
 * -----------------------------------------------------------------------
 * Role-based access control middleware generator.
 * Example: requireRole('superadmin', 'ward_admin')
 */

const AppError = require('../../utils/AppError');

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          'FORBIDDEN',
          403,
          `Access denied: requires one of the following roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    return next();
  };
}

module.exports = { requireRole };
