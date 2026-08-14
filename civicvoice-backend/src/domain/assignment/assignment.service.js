const AssignmentRule = require('../../models/AssignmentRule');
const Officer = require('../../models/Officer');
const logger = require('../../utils/logger');

async function assignOfficer({ wardId, category }) {
  if (wardId == null) {
    return null;
  }

  try {
    // 1. Try match by BOTH wardId and category in Officer arrays (highest priority)
    let officer = await Officer.findOne({
      active: true,
      isDeleted: { $ne: true },
      wardIds: wardId,
      categories: category,
    });

    // 2. Try match by category-only across any ward
    if (!officer && category) {
      officer = await Officer.findOne({
        active: true,
        isDeleted: { $ne: true },
        categories: category,
      });
    }

    // 3. Match by department fallback
    if (!officer && category) {
      officer = await Officer.findOne({
        active: true,
        isDeleted: { $ne: true },
        department: new RegExp(category, 'i'),
      });
    }

    // 4. Fallback to any active officer assigned to the ward
    if (!officer) {
      officer = await Officer.findOne({
        active: true,
        isDeleted: { $ne: true },
        wardIds: wardId,
      });
    }

    if (officer) {
      return officer._id;
    }

    // Legacy fallback to AssignmentRule
    let rule = await AssignmentRule.findOne({ wardId, category }).sort({ priority: -1 });

    if (!rule) {
      rule = await AssignmentRule.findOne({ wardId }).sort({ priority: -1 });
    }

    return rule ? rule.officerId : null;
  } catch (err) {
    logger.error('Officer assignment failed', {
      error: err.message,
      wardId: wardId.toString(),
      category,
    });
    return null;
  }
}

module.exports = { assignOfficer };
