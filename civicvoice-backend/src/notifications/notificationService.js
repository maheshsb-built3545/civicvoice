/**
 * notificationService.js
 * -----------------------------------------------------------------------
 * Subscribes to internal eventBus events and dispatches WhatsApp messages.
 */

const eventBus = require('../domain/events/eventBus');
const Officer = require('../models/Officer');
const { sendMessage } = require('../channels/whatsapp/whatsapp.client');
const {
  getCitizenAckMessage,
  getCitizenStatusChangeMessage,
  getOfficerAssignmentMessage,
} = require('./templates/complaintTemplates');
const logger = require('../utils/logger');

function initNotificationService() {
  // On complaint created
  eventBus.on('complaint.created', async (complaint) => {
    logger.info('NotificationService: event complaint.created handler triggered', {
      complaintId: complaint?._id,
      channel: complaint?.channel,
      senderId: complaint?.senderId,
    });
    try {
      if (complaint.channel === 'whatsapp' && complaint.senderId) {
        const { formatIndianPhoneNumber } = require('../utils/phoneHelper');
        const cleanPhone = formatIndianPhoneNumber(complaint.senderId).replace(/\D/g, '');
        const Citizen = require('../models/Citizen');
        const ConversationState = require('../models/ConversationState');
        const citizen = await Citizen.findOne({ phone: `+${cleanPhone}` });
        const state = await ConversationState.findOne({ phoneNumber: cleanPhone });
        const lang = citizen?.language || state?.language || 'en';

        const text = getCitizenAckMessage(complaint, lang);
        logger.info('NotificationService: Outbound WhatsApp trigger matched. Calling sendMessage...', {
          recipient: complaint.senderId,
        });
        await sendMessage(complaint.senderId, text);
        logger.info('Citizen creation notification sent via WhatsApp', {
          complaintId: complaint._id,
          recipient: complaint.senderId,
        });
      } else {
        logger.info('NotificationService: Event ignored (not WhatsApp channel or missing senderId)', {
          channel: complaint?.channel,
          senderId: complaint?.senderId,
        });
      }
    } catch (err) {
      logger.error('Failed to send complaint creation notification', {
        complaintId: complaint._id,
        error: err.message,
      });
    }
  });

  // On complaint assigned to officer
  eventBus.on('complaint.assigned', async ({ complaint, officerId }) => {
    try {
      const targetOfficerId = officerId || complaint.assignedOfficerId;
      if (!targetOfficerId) return;

      const officer = await Officer.findById(targetOfficerId);
      if (officer && officer.contact) {
        const text = getOfficerAssignmentMessage(
          complaint._id.toString(),
          complaint.structured?.category,
          complaint.structured?.locationMentioned,
          complaint.rawText,
          officer.language || 'en'
        );
        await sendMessage(officer.contact, text);
        logger.info('Officer assignment notification sent via WhatsApp', {
          complaintId: complaint._id,
          officerId: officer._id,
          contact: officer.contact,
        });
      }
    } catch (err) {
      logger.error('Failed to send officer assignment notification', {
        complaintId: complaint?._id,
        error: err.message,
      });
    }
  });

  // On complaint status changed
  eventBus.on('complaint.status_changed', async ({ complaint, note }) => {
    try {
      if (complaint.senderId) {
        const { formatIndianPhoneNumber } = require('../utils/phoneHelper');
        const cleanPhone = formatIndianPhoneNumber(complaint.senderId).replace(/\D/g, '');
        const Citizen = require('../models/Citizen');
        const ConversationState = require('../models/ConversationState');
        const citizen = await Citizen.findOne({ phone: `+${cleanPhone}` });
        const state = await ConversationState.findOne({ phoneNumber: cleanPhone });
        const lang = citizen?.language || state?.language || 'en';

        const text = getCitizenStatusChangeMessage(complaint, lang);
        await sendMessage(complaint.senderId, text);
        logger.info('Citizen status change notification sent via WhatsApp', {
          complaintId: complaint._id,
          recipient: complaint.senderId,
          status: complaint.status,
        });
      }
    } catch (err) {
      logger.error('Failed to send citizen status change notification', {
        complaintId: complaint?._id,
        error: err.message,
      });
    }
  });

  logger.info('Notification service initialized and listening to eventBus');
}

module.exports = { initNotificationService };
