const mongoose = require('mongoose');

const { Schema } = mongoose;

const citizenSchema = new Schema({
  name: { type: String, required: true },
  phone: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^\+91\d{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid Indian phone number (+91XXXXXXXXXX)!`
    }
  },
  passwordHash: { type: String, default: null },
  language: { type: String, enum: ['en', 'mr', 'hi', null], default: null },
  otp: { type: String, default: null },
  otpExpires: { type: Date, default: null },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Citizen', citizenSchema);
