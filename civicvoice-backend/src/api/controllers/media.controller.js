const fs = require('fs');
const path = require('path');
const Complaint = require('../../models/Complaint');
const Officer = require('../../models/Officer');
const Citizen = require('../../models/Citizen');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

async function getMedia(req, res, next) {
  try {
    const { filename } = req.params;

    // 1. Directory traversal validation
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new AppError('INVALID_INPUT', 400, 'Invalid filename');
    }

    // 2. Query MongoDB for the complaint containing this filename in attachments
    const complaint = await Complaint.findOne({
      $or: [
        { 'attachments.url': `/uploads/${filename}` },
        { 'attachments.url': `/api/media/${filename}` }
      ]
    });

    if (!complaint || complaint.isDeleted) {
      throw new AppError('NOT_FOUND', 404, 'File not found');
    }

    // 3. Permission checks
    const role = req.user.role;
    let isAuthorized = false;

    if (role === 'superadmin' || role === 'admin') {
      isAuthorized = true;
    } else if (role === 'ward_admin') {
      const userWardIds = req.user.wardIds || [];
      if (complaint.wardId && userWardIds.some(id => String(id) === String(complaint.wardId))) {
        isAuthorized = true;
      }
    } else if (role === 'officer') {
      if (String(complaint.assignedOfficerId) === req.user.id) {
        isAuthorized = true;
      } else {
        const officer = await Officer.findById(req.user.id);
        if (officer && officer.wardIds && complaint.wardId && officer.wardIds.some(id => String(id) === String(complaint.wardId))) {
          isAuthorized = true;
        }
      }
    } else if (role === 'citizen') {
      const citizen = await Citizen.findById(req.user.citizenId);
      if (citizen && citizen.phone) {
        const cleanPhone = citizen.phone.replace(/\D/g, '');
        const cleanSender = complaint.senderId.replace(/\D/g, '');
        if (cleanPhone === cleanSender) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      throw new AppError('FORBIDDEN', 403, 'Access denied');
    }

    // 4. Resolve local file path
    const filePath = path.join(process.cwd(), 'uploads', filename);
    if (!fs.existsSync(filePath)) {
      throw new AppError('NOT_FOUND', 404, 'File not found');
    }

    // 5. Send mime-type and stream file
    const ext = filename.split('.').pop().toLowerCase();
    const mimeMap = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      ogg: 'audio/ogg'
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      logger.error('Error streaming media file', { error: err.message, filename });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream media file' });
      }
    });
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { getMedia };
