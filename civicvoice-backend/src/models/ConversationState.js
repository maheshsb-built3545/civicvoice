const mongoose = require('mongoose');

const { Schema } = mongoose;

const conversationStateSchema = new Schema({
  phoneNumber: { type: String, required: true, unique: true },
  step: {
    type: String,
    enum: [
      'awaiting_language',
      'awaiting_intent',
      'awaiting_timeout_choice',
      'active',
      'awaiting_complaint_confirm',
      'awaiting_presubmit_confirm',
      'awaiting_location',
      'awaiting_complaint_text',
      'category_extracted',
      'ward_selected',
      'exact_location_received',
      'collecting_input',
      'awaiting_confirm_edit',
      'location_requested',
      'awaiting_free_text_address',
      null
    ],
    default: null,
  },
  language: {
    type: String,
    enum: ['en', 'mr', 'hi', null],
    default: null,
  },
  pendingComplaint: { type: Schema.Types.Mixed, default: null },
  pendingStructuredComplaint: { type: Schema.Types.Mixed, default: null },
  pendingComplaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', default: null },
  lastInteractionAt: { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: false, updatedAt: true },
});

module.exports = mongoose.model('ConversationState', conversationStateSchema);
