/**
 * test_location_flow.js
 * -----------------------------------------------------------------------
 * Integration test verifying the WhatsApp location collection flow:
 * 1. Default message intake -> triggers confirmation prompt
 * 2. Answering Yes -> triggers extraction, sends summary, moves to presubmit confirm
 * 3. Answering 1/Yes -> creates the complaint, asks for location pin, moves to awaiting_location
 * 4. Sending location pin -> updates complaint coordinates in MongoDB, moves step back to active
 * 5. Or fallback: sending text address -> geocodes address, updates location, moves step back to active
 * 6. Edge cases: sending unsupported types (e.g. image) -> prompts retry.
 */

// 1. Set up cache intercepts for WhatsApp sendMessage BEFORE importing other modules
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

// 2. Import regular dependencies
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

  const testPhone = '919999988888';
  const senderId = `+${testPhone}`;

  // Cleanup
  await ConversationState.deleteMany({ phoneNumber: testPhone });
  await Citizen.deleteMany({ phone: senderId });
  await Complaint.deleteMany({ senderId });

  // Initialize citizen and state
  await Citizen.create({
    name: 'Location Test Citizen',
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
    // Step 1: Send the initial complaint description
    console.log('\n--- STEP 1: Sending initial complaint description ---');
    sentMessages = [];
    let status = await postWebhook('wamid_loc_1', { type: 'text', text: { body: 'There is a huge pothole on Main Street!' } });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    let lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);
    let state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    if (state?.step !== 'awaiting_complaint_confirm') {
      throw new Error('Step 1 Failed: step was not awaiting_complaint_confirm');
    }

    // Step 2: Answer "Yes" to intent check
    console.log('\n--- STEP 2: Answering "Yes" to intent check ---');
    sentMessages = [];
    status = await postWebhook('wamid_loc_2', { type: 'text', text: { body: 'Yes' } });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);
    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    if (state?.step !== 'awaiting_presubmit_confirm') {
      throw new Error('Step 2 Failed: step was not awaiting_presubmit_confirm');
    }

    // Step 3: Answer "1" to confirm and submit
    console.log('\n--- STEP 3: Confirming pre-submit summary ---');
    sentMessages = [];
    status = await postWebhook('wamid_loc_3', { type: 'text', text: { body: '1' } });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    console.log(`State pendingComplaintId: ${state?.pendingComplaintId}`);
    
    lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);

    const complaint = await Complaint.findOne({ senderId });
    if (!complaint) {
      throw new Error('Step 3 Failed: Complaint was not created');
    }
    if (state?.step !== 'awaiting_location') {
      throw new Error('Step 3 Failed: step is not awaiting_location');
    }
    console.log('✅ Step 3 Passed: Complaint created and step is awaiting_location!');

    // Step 4: Send an invalid type (e.g. image) to test graceful edge case handling
    console.log('\n--- STEP 4: Sending unsupported media (image) during location step ---');
    sentMessages = [];
    status = await postWebhook('wamid_loc_4', {
      type: 'image',
      image: { id: 'some_image_id', mime_type: 'image/jpeg' }
    });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);
    
    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    
    if (state?.step !== 'awaiting_location' || !lastMsg?.text?.includes('Location attachment feature')) {
      throw new Error('Step 4 Failed: did not prompt user to resend location gracefully');
    }
    console.log('✅ Step 4 Passed: Gracefully handled unsupported media type!');

    // Step 5: Send location pin
    console.log('\n--- STEP 5: Sending location pin ---');
    sentMessages = [];
    status = await postWebhook('wamid_loc_5', {
      type: 'location',
      location: {
        latitude: 12.97,
        longitude: 77.64,
        name: 'Central Zone Metro Station',
        address: 'Central Zone Ward 10, Bangalore, Karnataka 560038'
      }
    });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    
    lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);

    const updatedComplaint = await Complaint.findById(complaint._id);
    console.log('Updated Complaint location:', updatedComplaint?.location);
    console.log('Updated Complaint locationMentioned:', updatedComplaint?.structured?.locationMentioned);
    console.log('Updated Complaint wardId:', updatedComplaint?.wardId);

    if (state?.step !== 'active' || !updatedComplaint?.location?.coordinates) {
      throw new Error('Step 5 Failed: location pin not stored or step not reset to active');
    }
    if (updatedComplaint.location.coordinates[0] !== 77.64 || updatedComplaint.location.coordinates[1] !== 12.97) {
      throw new Error('Step 5 Failed: coordinates are incorrect');
    }
    console.log('✅ Step 5 Passed: Location pin successfully stored and step reset to active!');

    // Step 6: Test fallback to typed text
    // Reset state to awaiting_location manually for testing fallback
    console.log('\n--- STEP 6: Testing typed text fallback ---');
    state.step = 'awaiting_location';
    state.pendingComplaintId = complaint._id;
    await state.save();

    sentMessages = [];
    status = await postWebhook('wamid_loc_6', {
      type: 'text',
      text: { body: 'Pune Railway Station, Pune' }
    });
    console.log(`HTTP Webhook status: ${status}`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);

    lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);

    const textComplaint = await Complaint.findById(complaint._id);
    console.log('Text Complaint location:', textComplaint?.location);
    console.log('Text Complaint locationMentioned:', textComplaint?.structured?.locationMentioned);

    if (state?.step !== 'active' || textComplaint?.structured?.locationMentioned !== 'Pune Railway Station, Pune') {
      throw new Error('Step 6 Failed: text fallback did not work or step not reset to active');
    }
    console.log('✅ Step 6 Passed: Fallback to typed text successfully stored and step reset to active!');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    // Clean up
    await ConversationState.deleteMany({ phoneNumber: testPhone });
    await Citizen.deleteMany({ phone: senderId });
    await Complaint.deleteMany({ senderId });

    server.close();
    await mongoose.disconnect();
    console.log('\nDisconnected database and stopped server.');
  }
}

runTest();
