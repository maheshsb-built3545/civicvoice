/**
 * test_image_webhook.js
 * -----------------------------------------------------------------------
 * Integration test verifying that incoming WhatsApp image webhook payloads
 * are parsed, downloaded, and saved as a database attachment without vision.
 */

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const createApp = require('../src/app');
const Complaint = require('../src/models/Complaint');
const ConversationState = require('../src/models/ConversationState');
const Citizen = require('../src/models/Citizen');
const Ward = require('../src/models/Ward');

// 1. Mock outbound WhatsApp sendMessage (both mock and real client wrappers)
const whatsappClientWrapper = require('../src/channels/whatsapp/whatsappClient');
whatsappClientWrapper.sendMessage = async (recipientId, text) => {
  console.log(`[TEST MOCK] Intercepted whatsappClientWrapper.sendMessage: "${text}" to "${recipientId}"`);
  return { success: true };
};

const whatsappClient = require('../src/channels/whatsapp/whatsapp.client');
whatsappClient.sendMessage = async (recipientId, text) => {
  console.log(`[TEST MOCK] Intercepted whatsapp.client.sendMessage: "${text}" to "${recipientId}"`);
  return { success: true };
};

// 2. Mock mediaDownloader
const mediaDownloader = require('../src/media/mediaDownloader');
let mockMimeType = 'image/jpeg';
mediaDownloader.downloadMedia = async (mediaId, mimeType) => {
  console.log(`[TEST MOCK] Intercepted downloadMedia for ID: ${mediaId}, MimeType: ${mimeType}`);
  return {
    buffer: Buffer.from('mock image bytes'),
    url: '/uploads/mock_image_simplified_123.jpg',
    filePath: 'c:\\Users\\borde\\OneDrive\\Desktop\\CivicVoice\\civicvoice-backend\\uploads\\mock_image_simplified_123.jpg',
    mimeType: mimeType || mockMimeType
  };
};

const extractionService = require('../src/ai/extraction/extraction.service');
let mockTextCategory = 'roads';
extractionService.extractComplaint = async (transcript, metadata) => {
  console.log(`[TEST MOCK] Intercepted extractionService.extractComplaint. Transcript: "${transcript}"`);
  return {
    structuredComplaint: {
      category: mockTextCategory,
      subcategory: 'pothole',
      description: 'Pothole on the road.',
      urgency: 'medium',
      locationMentioned: 'Central Zone Ward 10',
      language: 'en',
      confidence: 0.9,
      needsClarification: false
    },
    needsClarification: false
  };
};

async function runImageTest() {
  console.log('Connecting to database...');
  await connectDB();

  const testPhone = '919999966666';
  const senderId = `+${testPhone}`;

  // Cleanup existing data
  await ConversationState.deleteMany({ phoneNumber: testPhone });
  await Citizen.deleteMany({ phone: senderId });
  await Complaint.deleteMany({ senderId });

  // Seed states
  await ConversationState.create({
    phoneNumber: testPhone,
    step: 'active',
    language: 'en'
  });
  await Citizen.create({
    name: 'Image Test Citizen',
    phone: senderId,
    language: 'en'
  });

  let testWard = await Ward.findOne({ name: 'Central Zone Ward 10' });
  if (!testWard) {
    testWard = await Ward.create({
      name: 'Central Zone Ward 10',
      boundary: {
        type: 'Polygon',
        coordinates: [[[77.63, 12.96], [77.65, 12.96], [77.65, 12.98], [77.63, 12.98], [77.63, 12.96]]]
      },
      defaultDepartmentMap: { water_supply: 'Water Dept East' }
    });
  }

  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;

  const imagePayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1234567890',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              messages: [
                {
                  from: senderId,
                  id: 'wamid_image_test_99999',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'image',
                  image: {
                    id: 'media_id_image_test_simplified_999',
                    mime_type: 'image/jpeg',
                    caption: 'There is a huge pothole here!'
                  }
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  try {
    console.log('\n--- TEST CASE: Simplified Image Complaint (Download & Store) ---');
    console.log(`Triggering image webhook POST to local port ${port}...`);
    let res = await fetch(`http://127.0.0.1:${port}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imagePayload)
    });

    console.log(`HTTP Status: ${res.status}`);
    let text = await res.text();
    console.log(`Response text: ${text}`);

    if (res.status === 200 && text === 'EVENT_RECEIVED') {
      console.log('Waiting 5s for async background processing...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      const complaint = await Complaint.findOne({ senderId }).sort({ createdAt: -1 });
      if (complaint) {
        console.log('Created Complaint ID: ', complaint._id);
        console.log('Raw Text:             ', complaint.rawText);
        console.log('Structured Category: ', complaint.structured?.category);
        console.log('Status:               ', complaint.status);
        console.log('Attachments Count:    ', complaint.attachments?.length);
        if (complaint.attachments?.length > 0) {
          console.log('Attachment URL:       ', complaint.attachments[0].url);
          console.log('Attachment MimeType:  ', complaint.attachments[0].mimeType);
          console.log('Has Vision Analysis:  ', !!complaint.attachments[0].visionAnalysis?.visible_issue_category);
        }
        if (complaint.attachments?.length === 1 && !complaint.attachments[0].visionAnalysis?.visible_issue_category) {
          console.log('✅ TEST PASSED! Attachment successfully saved and vision analysis excluded.');
        } else {
          console.error('❌ FAIL: Attachment list empty or vision analysis was incorrectly populated.');
        }
      } else {
        console.error('❌ FAIL: Complaint was not created.');
      }
    } else {
      console.error(`❌ FAIL: Expected 200 OK EVENT_RECEIVED`);
    }

  } catch (err) {
    console.error('❌ FAIL: Test encountered error:', err);
  } finally {
    // Cleanup test data
    await ConversationState.deleteMany({ phoneNumber: testPhone });
    await Citizen.deleteMany({ phone: senderId });
    await Complaint.deleteMany({ senderId });
    
    server.close();
    await mongoose.disconnect();
    console.log('\nDisconnected database and stopped server. Test run complete.');
  }
}

runImageTest();
