/**
 * assignmentEngine.js
 * -----------------------------------------------------------------------
 * Automatic assignment lookup for complaints based on ward, category, and department rules.
 */

const AssignmentRule = require('../../models/AssignmentRule');
const Officer = require('../../models/Officer');
const logger = require('../../utils/logger');

/**
 * @param {object} complaint
 * @returns {Promise<{ officerId: string, departmentId?: string } | null>}
 */
async function assignComplaint(complaint) {
  if (!complaint) return null;

  const rawWardId = complaint.wardId;
  let wardId = rawWardId && rawWardId._id ? rawWardId._id : (rawWardId || null);
  if (wardId && typeof wardId === 'string') {
    try {
      const mongoose = require('mongoose');
      wardId = new mongoose.Types.ObjectId(wardId);
    } catch (e) {
      // ignore
    }
  }
  const category = complaint.structured?.category || null;

  if (!category && !wardId) {
    return null;
  }

  // 1. Try match by wardId (highest priority since officers are now dedicated per-ward)
  if (wardId) {
    const officerMatch = await Officer.findOne({
      active: true,
      isDeleted: { $ne: true },
      wardIds: wardId,
    }).lean();

    if (officerMatch) {
      return {
        officerId: officerMatch._id,
        departmentId: officerMatch.department || null,
      };
    }

    // Check AssignmentRule legacy exact match
    const exactRule = await AssignmentRule.findOne({ wardId, category })
      .sort({ priority: -1 })
      .lean();

    if (exactRule) {
      const officer = await Officer.findById(exactRule.officerId).lean();
      return {
        officerId: exactRule.officerId,
        departmentId: officer?.department || null,
      };
    }
  }

  // 2. Try match by category-only across any ward
  if (category) {
    const categoryMatch = await Officer.findOne({
      active: true,
      isDeleted: { $ne: true },
      categories: category,
    }).lean();

    if (categoryMatch) {
      return {
        officerId: categoryMatch._id,
        departmentId: categoryMatch.department || null,
      };
    }

    // Check AssignmentRule legacy category fallback
    const categoryRule = await AssignmentRule.findOne({ category })
      .sort({ priority: -1 })
      .lean();

    if (categoryRule) {
      const officer = await Officer.findById(categoryRule.officerId).lean();
      return {
        officerId: categoryRule.officerId,
        departmentId: officer?.department || null,
      };
    }

    // 3. Match by department fallback
    const deptMatch = await Officer.findOne({
      active: true,
      isDeleted: { $ne: true },
      department: new RegExp(category, 'i'),
    }).lean();

    if (deptMatch) {
      return {
        officerId: deptMatch._id,
        departmentId: deptMatch.department || null,
      };
    }
  }

  // 4. Fallback to any active officer assigned to the ward
  if (wardId) {
    const wardOfficer = await Officer.findOne({
      active: true,
      isDeleted: { $ne: true },
      wardIds: wardId,
    }).lean();

    if (wardOfficer) {
      return {
        officerId: wardOfficer._id,
        departmentId: wardOfficer.department || null,
      };
    }
  }

  logger.info('No matching assignment found for complaint', {
    complaintId: complaint._id,
    wardId,
    category,
  });

  return null;
}

module.exports = { assignComplaint };
