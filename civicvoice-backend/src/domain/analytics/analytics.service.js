/**
 * analytics.service.js
 * -----------------------------------------------------------------------
 * Aggregation-only service — generates read-only analytics dashboards
 * using MongoDB aggregation pipelines. Does not write to or modify any
 * data; purely read-only projection.
 */

const Complaint = require('../../models/Complaint');
const Ward = require('../../models/Ward');
const logger = require('../../utils/logger');

/**
 * Fetch aggregated analytics data.
 * Returns:
 *   - totalComplaints: count of all Complaint documents
 *   - byStatus: array of { status, count }
 *   - byCategory: array of { category, count }
 *   - byWard: array of { wardId, wardName, count }
 *   - avgResolutionTimeHours: average hours to resolve, or null if no resolved complaints
 */
async function getAnalytics() {
  try {
    // Total complaint count — excludes soft-deleted records to match the Queue
    const totalComplaints = await Complaint.countDocuments({ isDeleted: { $ne: true } });

    // Group by status — excludes soft-deleted records
    const byStatus = await Complaint.aggregate([
      {
        $match: { isDeleted: { $ne: true } },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $project: {
          _id: 0,
          status: '$_id',
          count: 1,
        },
      },
    ]);

    // Group by category — excludes soft-deleted records
    const byCategory = await Complaint.aggregate([
      {
        $match: { isDeleted: { $ne: true } },
      },
      {
        $group: {
          _id: '$structured.category',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          count: 1,
        },
      },
    ]);

    // Group by ward with lookup to get ward name — excludes soft-deleted records
    const byWard = await Complaint.aggregate([
      {
        $match: { isDeleted: { $ne: true } },
      },
      {
        $group: {
          _id: '$wardId',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'wards',
          localField: '_id',
          foreignField: '_id',
          as: 'ward',
        },
      },
      {
        $project: {
          _id: 0,
          wardId: '$_id',
          wardName: { $arrayElemAt: ['$ward.name', 0] },
          count: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Calculate average resolution time for resolved complaints
    const resolutionData = await Complaint.aggregate([
      {
        $match: {
          status: 'resolved',
        },
      },
      {
        $addFields: {
          resolvedEntry: {
            $filter: {
              input: '$lifecycleLog',
              as: 'entry',
              cond: { $eq: ['$$entry.stage', 'resolved'] },
            },
          },
        },
      },
      {
        $addFields: {
          resolvedAt: { $arrayElemAt: ['$resolvedEntry.timestamp', 0] },
        },
      },
      {
        $addFields: {
          resolutionHours: {
            $cond: [
              { $ne: ['$resolvedAt', null] },
              {
                $divide: [
                  { $subtract: ['$resolvedAt', '$createdAt'] },
                  3600000, // milliseconds to hours
                ],
              },
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResolutionTimeHours: { $avg: '$resolutionHours' },
        },
      },
    ]);

    const avgResolutionTimeHours =
      resolutionData.length > 0 && resolutionData[0].avgResolutionTimeHours
        ? Math.round(resolutionData[0].avgResolutionTimeHours * 10) / 10 // round to 1 decimal
        : null;

    logger.info('Analytics aggregated', {
      totalComplaints,
      byStatusCount: byStatus.length,
      byCategoryCount: byCategory.length,
      byWardCount: byWard.length,
      avgResolutionTimeHours,
    });

    return {
      totalComplaints,
      byStatus,
      byCategory,
      byWard,
      avgResolutionTimeHours,
    };
  } catch (err) {
    logger.error('Analytics aggregation failed', { error: err.message });
    throw err;
  }
}

module.exports = { getAnalytics };
