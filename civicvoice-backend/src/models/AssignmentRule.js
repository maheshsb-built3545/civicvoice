/**
 * AssignmentRule.js
 * -----------------------------------------------------------------------
 * Assignment rule for automatic routing of complaints to officers.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const assignmentRuleSchema = new Schema(
  {
    wardId: { type: Schema.Types.ObjectId, ref: 'Ward', default: null },
    category: { type: String, required: true },
    officerId: { type: Schema.Types.ObjectId, ref: 'Officer', required: true },
    priority: { type: Number, default: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AssignmentRule', assignmentRuleSchema);
