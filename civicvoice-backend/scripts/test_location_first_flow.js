/**
 * test_location_first_flow.js
 * -----------------------------------------------------------------------
 * Integration test verifying Option A (Interactive Prompt) where the user
 * sends a location pin first, followed by a text description.
 */

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

let sentMessages = [];
const mockSend = async (recipientId, text) => {
  console.log(`[TEST SEND] "${text}"`);
  sentMessages.push({ recipientId, text });
  return { success: true };
};

const clientPath1 = require.resolve('../src/channels/whatsapp/whatsapp.client');
const clientPath2 = require.resolve('../src/channels/whatsapp/whatsappClient');

require.cache[clientPath1] = {
  id: clientPath1,
  filename: clientPath1,
  loaded: true,
  exports: { sendMessage: mockSend }
};

require.cache[clientPath2] = {
  id: clientPath2,
  filename: clientPath2,
  loaded: true,
  exports: { sendMessage: mockSend }
};

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const createApp = require('../src/app');
const Complaint = require('../src/models/Complaint');
const ConversationState = require('../src/models/ConversationState');
const Citizen = require('../src/models/Citizen');
const Ward = require('../src/models/Ward');

const extractionService = require('../src/ai/extraction/extraction.service');
extractionService.extractComplaint = async (transcript, metadata) => {
  return {
    structuredComplaint: {
      category: 'roads',
      subcategory: 'pothole',
      description: 'Big pothole on Main Street.',
      urgency: 'high',
      locationMentioned: 'Central Zone Ward 10',
      language: 'en',
      confidence: 0.95,
      needsClarification: false
    },
    needsClarification: false
  };
};

async function runTest() {
  console.log('Connecting to database...');
  await connectDB();

  const testPhone = '919999922222';
  const senderId = `+${testPhone}`;

  // Cleanup
  await ConversationState.deleteMany({ phoneNumber: testPhone });
  await Citizen.deleteMany({ phone: senderId });
  await Complaint.deleteMany({ senderId });

  // Initialize citizen and state
  await Citizen.create({
    name: 'Location First Citizen',
    phone: senderId,
    language: 'en'
  });
  await ConversationState.create({
    phoneNumber: testPhone,
    step: 'active',
    language: 'en'
  });

  let testWard = await Ward.findOne({ name: 'Central Zone Ward 10' });
  if (!testWard) {
    await Ward.create({
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

  const postWebhook = async (msgId, messageObject) => {
    const payload = {
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
                    id: msgId,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    ...messageObject
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };
    const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.status;
  };

  try {
    // Step 1: Send Location Pin in active state
    console.log('\n--- STEP 1: Sending location pin in active state ---');
    sentMessages = [];
    let status = await postWebhook('wamid_loc_first_1', {
      type: 'location',
      location: {
        latitude: 12.97,
        longitude: 77.64,
        name: 'Central Zone Metro Station',
        address: 'Central Zone Ward 10, Bangalore, Karnataka 560038'
      }
    });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);
    let state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    if (state?.step !== 'awaiting_complaint_text') {
      throw new Error('Step 1 Failed: step was not awaiting_complaint_text');
    }
    if (!state?.pendingComplaint?.location) {
      throw new Error('Step 1 Failed: location was not stored in pendingComplaint');
    }
    console.log('✅ Step 1 Passed: location pin accepted and step is awaiting_complaint_text!');

    // Step 2: Send complaint description text
    console.log('\n--- STEP 2: Sending complaint description ---');
    sentMessages = [];
    status = await postWebhook('wamid_loc_first_2', {
      type: 'text',
      text: { body: 'Large pothole here on main street' }
    });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);
    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    if (state?.step !== 'awaiting_complaint_confirm') {
      throw new Error('Step 2 Failed: step was not awaiting_complaint_confirm');
    }
    if (state?.pendingComplaint?.rawText !== 'Large pothole here on main street') {
      throw new Error('Step 2 Failed: rawText description was not saved/merged');
    }
    console.log('✅ Step 2 Passed: description text accepted and merged with location!');

    // Step 3: Answer "Yes" to confirm intake
    console.log('\n--- STEP 3: Confirming intake ---');
    sentMessages = [];
    status = await postWebhook('wamid_loc_first_3', {
      type: 'text',
      text: { body: 'Yes' }
    });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);
    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    if (state?.step !== 'awaiting_presubmit_confirm') {
      throw new Error('Step 3 Failed: step was not awaiting_presubmit_confirm');
    }
    if (state?.pendingStructuredComplaint?.location?.lat !== 12.97) {
      throw new Error('Step 3 Failed: location coordinates were lost during extraction/routing');
    }
    console.log('✅ Step 3 Passed: intake confirmed, AI extraction completed, and coordinates preserved!');

    // Step 4: Confirm and submit summary
    console.log('\n--- STEP 4: Submitting summary ---');
    sentMessages = [];
    status = await postWebhook('wamid_loc_first_4', {
      type: 'text',
      text: { body: '1' }
    });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    
    const complaint = await Complaint.findOne({ senderId });
    if (!complaint) {
      throw new Error('Step 4 Failed: Complaint was not created');
    }
    console.log('Complaint coordinates:', complaint.location?.coordinates);
    console.log('Complaint wardId:', complaint.wardId);
    
    if (state?.step !== 'active') {
      throw new Error('Step 4 Failed: step is not active (did not skip awaiting_location)');
    }
    if (!complaint.location || complaint.location.coordinates[0] !== 77.64 || complaint.location.coordinates[1] !== 12.97) {
      throw new Error('Step 4 Failed: coordinates were not persisted on the created complaint');
    }
    if (!complaint.wardId) {
      throw new Error('Step 4 Failed: wardId was not resolved from coordinates');
    }
    
    // Check that we sent citizen registration acknowledgment showing recorded location message
    lastMsg = sentMessages.find(m => m.text && m.text.includes('Recorded location'));
    if (!lastMsg && !sentMessages[sentMessages.length - 1].text.includes('successfully recorded')) {
      throw new Error('Step 4 Failed: Citizen ack message did not show that location was successfully recorded');
    }

    console.log('✅ Step 4 Passed: Complaint filed, coordinates persisted, ward resolved, and skipped awaiting_location!');
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTest();
