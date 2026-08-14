/**
 * Officer.js
 * -----------------------------------------------------------------------
 * Represents a civic officer who complaints can be assigned to.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const officerSchema = new Schema(
  {
    name: { type: String, required: true },
    officerId: { type: String, unique: true, sparse: true },
    password: { type: String, default: null },
    email: { type: String, default: '' },
    department: { type: String, default: 'General' },
    wardIds: [{ type: Schema.Types.ObjectId, ref: 'Ward' }],
    contact: { type: String, required: true },
    role: { type: String, default: 'officer' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    categories: { type: [String], default: [] },
    active: { type: Boolean, default: true, alias: 'isActive' },
    passwordResetRequested: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, index: true },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Officer', officerSchema);
