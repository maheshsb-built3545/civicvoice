/**
 * Complaint.js
 * -----------------------------------------------------------------------
 * Mongoose schema for a citizen complaint document.
 * Fields:
 *  - traceId
 *  - channel: 'text' | 'whatsapp' | 'voice'
 *  - senderId, rawText
 *  - structured: { category, subcategory, description, urgency, locationMentioned, language, confidence, needsClarification }
 *  - status
 *  - wardId, assignedOfficerId
 *  - location: GeoJSON Point { type: 'Point', coordinates: [lng, lat] }
 *  - lifecycleLog: array of { stage, timestamp, actorId, note }
 */

const mongoose = require('mongoose');
const { COMPLAINT_STATUS } = require('../domain/complaints/complaint.state');

const { Schema } = mongoose;

const structuredSchema = new Schema(
  {
    category: { type: String, default: null },
    subcategory: { type: String, default: null },
    description: { type: String, default: null },
    urgency: { type: String, default: null },
    locationMentioned: { type: String, default: null },
    language: { type: String, default: null },
    confidence: { type: Number, default: null },
    needsClarification: { type: Boolean, default: false },
  },
  { _id: false }
);

const lifecycleEntrySchema = new Schema(
  {
    stage: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actorId: { type: String, default: 'system' },
    note: { type: String, default: null },
  },
  { _id: false }
);

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    mediaId: { type: String, default: null },
    mimeType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    visionAnalysis: {
      visible_issue_category: { type: String, default: null },
      visual_description: { type: String, default: null },
      severity_estimate: { type: String, default: null },
      matches_caption: { type: String, default: null },
      is_civic_complaint_image: { type: Boolean, default: null },
      confidence: { type: Number, default: null },
      flag_for_human_review: { type: Boolean, default: null },
    },
  },
  { _id: false }
);

const complaintSchema = new Schema({
  traceId: { type: String, required: true },
  channel: { type: String, required: true, enum: ['text', 'whatsapp', 'voice'] },
  senderId: { type: String, required: true },
  rawText: { type: String, required: true },

  structured: { type: structuredSchema, default: () => ({}) },

  status: {
    type: String,
    enum: Object.values(COMPLAINT_STATUS),
    default: COMPLAINT_STATUS.RECEIVED,
  },

  lifecycleLog: { type: [lifecycleEntrySchema], default: [] },

  wardId: { type: Schema.Types.ObjectId, ref: 'Ward', default: null },
  assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'Officer', default: null },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: null }, // [lng, lat], GeoJSON order
  },
  attachments: { type: [attachmentSchema], default: [] },
  flaggedForReview: { type: Boolean, default: false },
  flagReason: { type: String, default: null },
  flaggedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false, index: true },
});

module.exports = mongoose.model('Complaint', complaintSchema);
