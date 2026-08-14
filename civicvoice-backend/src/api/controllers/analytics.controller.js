/**
 * analytics.controller.js
 * -----------------------------------------------------------------------
 * Admin-only analytics endpoint. Validates role and delegates to
 * analytics.service.js for aggregation.
 */

const analyticsService = require('../../domain/analytics/analytics.service');
const Complaint = require('../../models/Complaint');
const AppError = require('../../utils/AppError');
const crypto = require('crypto');

async function getAnalytics(req, res, next) {
  try {
    // Admin-only check — same pattern as admin-officer.controller.js
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.role !== 'ward_admin')) {
      throw new AppError('FORBIDDEN', 403, 'Admin access required');
    }

    const analytics = await analyticsService.getAnalytics();

    res.status(200).json(analytics);
  } catch (err) {
    next(err);
  }
}

async function getExportReport(req, res, next) {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.role !== 'ward_admin')) {
      throw new AppError('FORBIDDEN', 403, 'Admin access required');
    }

    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = {
      isDeleted: false,
      createdAt: { $gte: startDate }
    };

    // If ward_admin, filter by their wardIds
    if (req.user.role === 'ward_admin') {
      const userWardIds = req.user.wardIds || [];
      query.wardId = { $in: userWardIds };
    }

    const complaints = await Complaint.find(query)
      .populate('wardId')
      .populate('assignedOfficerId')
      .sort({ createdAt: -1 })
      .lean();

    // Generate CSV content
    const headers = [
      'Tracking ID',
      'Submission Timestamp',
      'Current Status',
      'Input Channel',
      'Primary Category',
      'AI Confidence Score',
      'Original Raw Citizen Description',
      'Extracted Structured Summary',
      'Mentioned Location String',
      'Geocoded Coordinates',
      'Resolved Administrative Ward ID',
      'Resolved Administrative Ward Name',
      'Geocoding Method / Match Precision',
      'Assigned Officer Name',
      'Assigned Officer ID',
      'Assigned Department',
      'Assignment Trigger',
      'First Response Time (Min)',
      'Total Resolution Speed (Hours)',
      'SLA Compliance Status',
      'Resolution Timestamp',
      'Masked Citizen Phone',
      'Citizen Phone Hash'
    ];

    let csvContent = headers.join(',') + '\n';

    for (const c of complaints) {
      // Input Channel classification
      let channel = c.channel || 'whatsapp';
      if (channel === 'whatsapp') {
        const hasPhoto = c.attachments && c.attachments.some(a => a.mimeType && a.mimeType.startsWith('image/'));
        channel = hasPhoto ? 'Photo Attachment' : 'WhatsApp Text';
      } else if (channel === 'voice') {
        channel = 'Voice Note';
      } else if (channel === 'text') {
        channel = 'Web Portal Text';
      }

      // AI Confidence Formatting
      const confidence = c.structured?.confidence != null ? c.structured.confidence : 0.8;
      const confidenceText = `${confidence.toFixed(2)} (${confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low'})`;

      // Coordinates
      let coords = '';
      if (c.location && c.location.coordinates && c.location.coordinates.length === 2) {
        // coordinates are [lng, lat]
        coords = `${c.location.coordinates[1]}, ${c.location.coordinates[0]}`;
      }

      // Geocoding Method
      const geoMethod = c.location && c.location.coordinates && c.location.coordinates.length === 2 ? 'Nominatim Geocoding' : 'Default Fallback';

      // Assignment Trigger & Operational Metrics
      let assignmentTrigger = 'N/A';
      let firstResponseTime = '';
      let resolutionSpeed = '';
      let slaStatus = 'N/A';
      let resolutionTimestamp = '';

      const logs = c.lifecycleLog || [];

      // Assignment log checking
      const assignLog = logs.find(l => l.stage === 'assigned' || l.stage === 'in_progress');
      if (assignLog) {
        assignmentTrigger = assignLog.actorId === 'system' ? 'Direct Category Match' : 'Manual Dispatch';
      }

      // First response time (difference between creation and first log entry after 'created'/'received')
      const firstActionLog = logs.find(l => l.stage !== 'received' && l.stage !== 'created');
      if (firstActionLog && c.createdAt) {
        const diffMs = firstActionLog.timestamp - c.createdAt;
        firstResponseTime = Math.max(0, Math.round(diffMs / 1000 / 60)).toString(); // in minutes
      }

      // Resolution Speed & SLA
      const resolvedLog = logs.find(l => l.stage === 'resolved');
      if (resolvedLog && c.createdAt) {
        resolutionTimestamp = resolvedLog.timestamp.toISOString();
        const diffHours = (resolvedLog.timestamp - c.createdAt) / 1000 / 60 / 65;
        resolutionSpeed = Math.max(0, Math.round(diffHours * 10) / 10).toString(); // in hours
        slaStatus = diffHours <= 24 ? 'Met' : 'Breached';
      } else if (c.status === 'resolved' && c.createdAt) {
        // Fallback if resolved status exists but no log entry
        const logsSorted = [...logs].sort((a,b) => b.timestamp - a.timestamp);
        const lastLog = logsSorted[0];
        if (lastLog) {
          resolutionTimestamp = lastLog.timestamp.toISOString();
          const diffHours = (lastLog.timestamp - c.createdAt) / 1000 / 60 / 60;
          resolutionSpeed = Math.max(0, Math.round(diffHours * 10) / 10).toString();
          slaStatus = diffHours <= 24 ? 'Met' : 'Breached';
        }
      } else if (c.createdAt) {
        // Open ticket SLA status check
        const diffHours = (new Date() - c.createdAt) / 1000 / 60 / 60;
        slaStatus = diffHours <= 24 ? 'Within Target' : 'Breached (Open)';
      }

      // Phone Masking & Hash
      const rawPhone = c.senderId || '';
      let maskedPhone = '';
      let phoneHash = '';
      if (rawPhone) {
        const cleaned = rawPhone.replace(/\D/g, '');
        if (cleaned.length >= 7) {
          maskedPhone = cleaned.slice(0, 3) + '*****' + cleaned.slice(-3);
        } else {
          maskedPhone = cleaned;
        }
        phoneHash = crypto.createHash('md5').update(rawPhone).digest('hex').slice(0, 16);
      }

      // Escape helper
      const esc = (val) => {
        if (val == null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const row = [
        esc(c.traceId),
        esc(c.createdAt ? c.createdAt.toISOString() : ''),
        esc(c.status),
        esc(channel),
        esc(c.structured?.category || 'General'),
        esc(confidenceText),
        esc(c.rawText),
        esc(c.structured?.description || ''),
        esc(c.structured?.locationMentioned || ''),
        esc(coords),
        esc(c.wardId ? c.wardId._id : ''),
        esc(c.wardId ? c.wardId.name : 'Unassigned'),
        esc(geoMethod),
        esc(c.assignedOfficerId ? c.assignedOfficerId.name : 'Unassigned'),
        esc(c.assignedOfficerId ? c.assignedOfficerId.officerId : ''),
        esc(c.assignedOfficerId ? c.assignedOfficerId.department : ''),
        esc(assignmentTrigger),
        esc(firstResponseTime),
        esc(resolutionSpeed),
        esc(slaStatus),
        esc(resolutionTimestamp),
        esc(maskedPhone),
        esc(phoneHash)
      ];

      csvContent += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=civicvoice_export_${days}d.csv`);
    return res.status(200).send(csvContent);

  } catch (err) {
    next(err);
  }
}

module.exports = { getAnalytics, getExportReport };
