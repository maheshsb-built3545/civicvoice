/**
 * test_audio_webhook.js
 * -----------------------------------------------------------------------
 * Integration test verifying that incoming WhatsApp voice/audio webhook
 * payloads are correctly intercepted, transcribed, and fed into the complaints pipeline.
 */

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const config = require('../src/config/env');
const createApp = require('../src/app');
const Complaint = require('../src/models/Complaint');
const ConversationState = require('../src/models/ConversationState');
const Citizen = require('../src/models/Citizen');
const Ward = require('../src/models/Ward');

// 1. Mock the downloadMedia client function and transcribeAudio service function
const whatsappClient = require('../src/channels/whatsapp/whatsapp.client');
whatsappClient.downloadMedia = async (mediaId) => {
  console.log(`[TEST MOCK] Intercepted downloadMedia for ID: ${mediaId}`);
  return {
    buffer: Buffer.from('mock ogg audio buffer data'),
    mimeType: 'audio/ogg'
  };
};

const transcriber = require('../src/ai/stt/transcriber');
const testTranscript = 'Heavy pipeline leakage on Central Road near the public library, Central Zone Ward 10.';
transcriber.transcribeAudio = async (buffer, mimeType) => {
  console.log(`[TEST MOCK] Intercepted transcribeAudio. Returning transcript: "${testTranscript}"`);
  return {
    transcript: testTranscript,
    detectedLanguage: 'en',
    confidence: 0.98
  };
};

async function runAudioTest() {
  console.log('Connecting to database...');
  await connectDB();

  // Seed conversation state and ward to bypass onboarding & trigger spatial assignment
  const testPhone = '919999955555';
  const senderId = `+${testPhone}`;

  await ConversationState.deleteMany({ phoneNumber: testPhone });
  await Citizen.deleteMany({ phone: senderId });
  await Complaint.deleteMany({ senderId });

  await ConversationState.create({
    phoneNumber: testPhone,
    step: 'active',
    language: 'en'
  });
  await Citizen.create({
    name: 'Audio Test Citizen',
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

  const audioPayload = {
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
                  id: 'wamid_audio_test_12345',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'audio',
                  audio: {
                    id: 'media_id_audio_test_999',
                    mime_type: 'audio/ogg'
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
    console.log(`Triggering audio webhook POST to local port ${port}...`);
    const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(audioPayload)
    });

    console.log(`HTTP Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response text: ${text}`);

    if (res.status === 200 && text === 'EVENT_RECEIVED') {
      console.log('Webhook processed initial request. Waiting 7.5s for async background processing...');
      await new Promise(resolve => setTimeout(resolve, 7500));

      const complaint = await Complaint.findOne({ senderId });
      if (complaint) {
        console.log('\n======================================================');
        console.log('✅ AUDIO WEBHOOK INTEGRATION TEST PASSED!');
        console.log('======================================================');
        console.log('Created Complaint ID: ', complaint._id);
        console.log('Raw Transcript text:  ', complaint.rawText);
        console.log('Structured Category: ', complaint.structured?.category);
        console.log('Assigned Ward ID:    ', complaint.wardId || 'N/A');
        console.log('======================================================');
      } else {
        console.error('❌ FAIL: Complaint was not created in the database.');
      }
    } else {
      console.error(`❌ FAIL: Expected 200 OK EVENT_RECEIVED, got ${res.status} - ${text}`);
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
    console.log('Disconnected database and stopped server.');
  }
}

runAudioTest();
