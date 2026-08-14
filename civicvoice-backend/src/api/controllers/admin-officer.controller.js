const adminOfficerService = require('../../domain/admin/admin-officer.service');
const AppError = require('../../utils/AppError');

async function createOfficer(req, res, next) {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'ward_admin') {
      throw new AppError('FORBIDDEN', 403, 'Admin access required');
    }

    const { name, phone, email, categories, wards } = req.body;
    const result = await adminOfficerService.createOfficerAccount({
      name,
      phone,
      email,
      categories,
      wards,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function listOfficers(req, res, next) {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'ward_admin') {
      throw new AppError('FORBIDDEN', 403, 'Admin access required');
    }

    const officers = await adminOfficerService.listOfficers();
    res.status(200).json({ officers });
  } catch (err) {
    next(err);
  }
}

async function resetOfficerPassword(req, res, next) {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'ward_admin') {
      throw new AppError('FORBIDDEN', 403, 'Admin access required');
    }

    const officerId = req.params.id;
    const result = await adminOfficerService.adminResetOfficerPassword(officerId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { createOfficer, listOfficers, resetOfficerPassword };
