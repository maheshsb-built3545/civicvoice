const adminUserService = require('../../domain/admin/admin-user.service');
const AppError = require('../../utils/AppError');

async function createAdmin(req, res, next) {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      throw new AppError('FORBIDDEN', 403, 'Administrator access required');
    }

    const { name, email, contact } = req.body;
    const creatorId = req.user?.id;

    const result = await adminUserService.createAdminAccount({
      name,
      email,
      contact,
      creatorId,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function listAdmins(req, res, next) {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      throw new AppError('FORBIDDEN', 403, 'Administrator access required');
    }

    const admins = await adminUserService.listAdmins();
    res.status(200).json({ admins });
  } catch (err) {
    next(err);
  }
}

async function updateAdmin(req, res, next) {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      throw new AppError('FORBIDDEN', 403, 'Administrator access required');
    }

    const adminId = req.params.id;
    const { active } = req.body;

    const admin = await adminUserService.updateAdminStatus(adminId, { active });
    res.status(200).json({ admin, message: 'Admin status updated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAdmin,
  listAdmins,
  updateAdmin,
};
