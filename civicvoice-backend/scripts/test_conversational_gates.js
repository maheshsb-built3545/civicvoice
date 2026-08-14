/**
 * test_conversational_gates.js
 * -----------------------------------------------------------------------
 * Integration test verifying:
 * 1. Default message intake -> triggers confirmation prompt
 * 2. Answering Yes -> triggers extraction, sends summary, moves to presubmit confirm
 * 3. Answering 1/Yes -> creates the complaint in MongoDB
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
    name: 'Gate Test Citizen',
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

  const postWebhook = async (msgId, textBody) => {
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
                    type: 'text',
                    text: { body: textBody }
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
    let status = await postWebhook('wamid_gate_1', 'There is a huge pothole on Main Street!');
    console.log(`HTTP Webhook status: ${status}`);
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);
    
    let state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    
    if (state?.step === 'awaiting_complaint_confirm' && lastMsg?.text?.includes('Do you want me to take this as a new complaint now?')) {
      console.log('✅ Step 1 Passed: Intent check prompted successfully!');
    } else {
      throw new Error('Step 1 Failed');
    }

    // Step 2: Answer "Yes" to intent check
    console.log('\n--- STEP 2: Answering "Yes" to intent check ---');
    sentMessages = [];
    status = await postWebhook('wamid_gate_2', 'Yes');
    console.log(`HTTP Webhook status: ${status}`);
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    lastMsg = sentMessages[sentMessages.length - 1];
    console.log(`Bot responded with: ${JSON.stringify(lastMsg?.text)}`);
    
    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    
    if (state?.step === 'awaiting_presubmit_confirm' && lastMsg?.text?.includes('Complaint Summary')) {
      console.log('✅ Step 2 Passed: Pre-submit summary displayed successfully!');
    } else {
      throw new Error('Step 2 Failed');
    }

    // Step 3: Answer "1" to confirm and submit
    console.log('\n--- STEP 3: Confirming pre-submit summary ---');
    sentMessages = [];
    status = await postWebhook('wamid_gate_3', '1');
    console.log(`HTTP Webhook status: ${status}`);
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    state = await ConversationState.findOne({ phoneNumber: testPhone });
    console.log(`Current Step: ${state?.step}`);
    
    const complaint = await Complaint.findOne({ senderId });
    if (complaint && state?.step === 'active') {
      console.log('Created Complaint ID: ', complaint._id);
      console.log('Complaint rawText:    ', complaint.rawText);
      console.log('Complaint status:     ', complaint.status);
      console.log('✅ Step 3 Passed: Complaint created successfully after double-confirmation!');
    } else {
      throw new Error('Step 3 Failed: Complaint was not created');
    }

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
