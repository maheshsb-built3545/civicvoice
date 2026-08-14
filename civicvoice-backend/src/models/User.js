/**
 * User.js
 * -----------------------------------------------------------------------
 * User model for authentication and access control.
 * Roles: 'citizen' | 'officer' | 'ward_admin' | 'superadmin' | 'admin'
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['citizen', 'officer', 'ward_admin', 'superadmin', 'admin'],
      default: 'citizen',
    },
    wardIds: [{ type: Schema.Types.ObjectId, ref: 'Ward' }],
    contact: { type: String },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    passwordResetRequested: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
