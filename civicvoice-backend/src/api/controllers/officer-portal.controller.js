const officerPortalService = require('../../domain/officers/officer-portal.service');
const AppError = require('../../utils/AppError');

async function loginOfficer(req, res, next) {
  try {
    const { officerId, password } = req.body;
    const result = await officerPortalService.officerLogin({ officerId, password });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const officerId = req.user?.officerId;
    if (!officerId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const { currentPassword, newPassword } = req.body;
    const result = await officerPortalService.changeOfficerPassword({
      officerId,
      currentPassword,
      newPassword,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getComplaints(req, res, next) {
  try {
    const officerId = req.user?.officerId;
    if (!officerId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const { status, category } = req.query;
    const complaints = await officerPortalService.listAssignedComplaints({
      officerId,
      status,
      category,
    });
    res.status(200).json({ complaints });
  } catch (err) {
    next(err);
  }
}

async function updateComplaintStatus(req, res, next) {
  try {
    const officerId = req.user?.officerId;
    if (!officerId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const complaintId = req.params.id;
    const { status, note } = req.body;
    const complaint = await officerPortalService.updateAssignedComplaintStatus({
      officerId,
      complaintId,
      status,
      note,
    });
    res.status(200).json({ complaint, message: 'Status updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const { officerId } = req.body;
    const result = await officerPortalService.requestPasswordReset({ officerId });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateComplaintWard(req, res, next) {
  try {
    const officerId = req.user?.officerId;
    if (!officerId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const complaintId = req.params.id;
    const { wardId } = req.body;
    const complaint = await officerPortalService.updateAssignedComplaintWard({
      officerId,
      complaintId,
      wardId,
    });
    res.status(200).json({ complaint, message: 'Ward updated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  loginOfficer,
  changePassword,
  getComplaints,
  updateComplaintStatus,
  requestPasswordReset,
  updateComplaintWard,
};
