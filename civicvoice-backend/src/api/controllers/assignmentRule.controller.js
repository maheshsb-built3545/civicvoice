/**
 * assignmentRule.controller.js
 * -----------------------------------------------------------------------
 * CRUD controller for Assignment Rules.
 */

const AssignmentRule = require('../../models/AssignmentRule');
const AppError = require('../../utils/AppError');

async function listAssignmentRules(req, res, next) {
  try {
    const { wardId, category } = req.query;
    const filter = {};
    if (wardId) filter.wardId = wardId;
    if (category) filter.category = category;

    const rules = await AssignmentRule.find(filter)
      .populate('wardId', 'name wardNumber')
      .populate('officerId', 'name department contact')
      .sort({ priority: -1, createdAt: -1 });

    res.status(200).json({ rules, total: rules.length });
  } catch (err) {
    next(err);
  }
}

async function createAssignmentRule(req, res, next) {
  try {
    const { wardId, category, officerId, priority } = req.body;

    if (!category || typeof category !== 'string') {
      throw new AppError('INVALID_INPUT', 400, 'category is required');
    }
    if (!officerId) {
      throw new AppError('INVALID_INPUT', 400, 'officerId is required');
    }

    const rule = await AssignmentRule.create({
      wardId: wardId || null,
      category,
      officerId,
      priority: priority !== undefined ? Number(priority) : 1,
    });

    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAssignmentRules, createAssignmentRule };
