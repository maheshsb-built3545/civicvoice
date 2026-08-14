const Citizen = require('../../models/Citizen');
const ConversationState = require('../../models/ConversationState');
const Complaint = require('../../models/Complaint');
const { sendMessage } = require('../../channels/whatsapp/whatsapp.client');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const bcrypt = require('bcryptjs');
const { formatIndianPhoneNumber } = require('../../utils/phoneHelper');

const otpRateLimitMap = new Map();
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const OTP_MAX_REQUESTS = 3;

function isOtpRateLimited(phone) {
  const now = Date.now();
  const requests = otpRateLimitMap.get(phone) || [];
  const validRequests = requests.filter((timestamp) => now - timestamp < OTP_RATE_LIMIT_WINDOW_MS);

  if (validRequests.length >= OTP_MAX_REQUESTS) {
    return true;
  }

  validRequests.push(now);
  otpRateLimitMap.set(phone, validRequests);
  return false;
}

async function requestOtp(req, res, next) {
  try {
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      throw new AppError('INVALID_INPUT', 400, 'phone number is required');
    }

    const formattedPhone = formatIndianPhoneNumber(phone);

    if (isOtpRateLimited(formattedPhone)) {
      throw new AppError('TOO_MANY_REQUESTS', 429, 'Rate limit exceeded. Please try again later.');
    }

    // Look up citizen by phone
    const cleanPhone = formattedPhone.replace(/\D/g, '');
    let citizen = await Citizen.findOne({ phone: formattedPhone });

    if (!citizen) {
      // Check if they've messaged the bot
      const stateExists = await ConversationState.exists({
        $or: [
          { phoneNumber: cleanPhone },
          { phoneNumber: formattedPhone }
        ]
      });

      const complaintExists = await Complaint.exists({
        $or: [
          { senderId: formattedPhone },
          { senderId: cleanPhone }
        ]
      });

      if (stateExists || complaintExists) {
        // Create new citizen record without password
        citizen = await Citizen.create({
          name: 'WhatsApp Citizen',
          phone: formattedPhone,
          passwordHash: null
        });
      } else {
        throw new AppError('NOT_FOUND', 404, 'No account found for this number. Please message our WhatsApp number first.');
      }
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    citizen.otp = otp;
    citizen.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await citizen.save();

    // Send via WhatsApp
    try {
      await sendMessage(citizen.phone, `Your CivicVoice verification code is: ${otp}. It expires in 5 minutes.`);
    } catch (sendErr) {
      logger.warn('WhatsApp OTP send failed (non-blocking)', { phone: citizen.phone, error: sendErr.message });
    }

    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (err) {
    next(err);
  }
}

async function verifyOtpAndSetPassword(req, res, next) {
  try {
    const { phone, otp, newPassword } = req.body;

    if (!phone || !otp || !newPassword) {
      throw new AppError('INVALID_INPUT', 400, 'phone, otp, and newPassword are required');
    }

    const formattedPhone = formatIndianPhoneNumber(phone);

    const citizen = await Citizen.findOne({ phone: formattedPhone });

    if (!citizen) {
      throw new AppError('NOT_FOUND', 404, 'Citizen not found');
    }

    if (!citizen.otp || citizen.otp !== otp.toString().trim()) {
      throw new AppError('INVALID_OTP', 400, 'Invalid OTP');
    }

    if (!citizen.otpExpires || citizen.otpExpires < new Date()) {
      throw new AppError('OTP_EXPIRED', 400, 'OTP has expired');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Save password and clear OTP
    citizen.passwordHash = passwordHash;
    citizen.otp = null;
    citizen.otpExpires = null;
    await citizen.save();

    return res.status(200).json({ message: 'Password set successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requestOtp,
  verifyOtpAndSetPassword
};
