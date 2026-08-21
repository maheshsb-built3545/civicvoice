/**
 * test_e2e_pipeline.js
 * -----------------------------------------------------------------------
 * End-to-End Pipeline Integration Test Script.
 * Verifies:
 *  1. Real MongoDB connection (no in-memory fallback)
 *  2. End-to-end text complaint creation and persistence
 *  3. 30-minute window duplicate complaint rejection
 *  4. WhatsApp webhook HMAC verification, 200 ACK, queue processing, & persistence
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const config = require('../src/config/env');
const whatsappConfig = require('../src/config/whatsapp.config');
const createApp = require('../src/app');
const Complaint = require('../src/models/Complaint');
const Ward = require('../src/models/Ward');
const { createComplaint } = require('../src/domain/complaints/complaint.service');

async function runE2ETestPipeline() {
  console.log('===========================================================');
  console.log('       CIVICVOICE E2E PIPELINE INTEGRATION TEST            ');
  console.log('===========================================================');

  const summary = {
    mongoConnectedReal: false,
    check1_mongoConnection: 'FAIL',
    check2_textComplaintE2E: 'FAIL',
    check3_duplicateSubmission: 'FAIL',
    check4_whatsAppWebhookQueue: 'FAIL',
  };

  // -----------------------------------------------------------------------
  // Check 1: Real MongoDB Connection
  // -----------------------------------------------------------------------
  console.log('\n--- CHECK 1: Connecting to Real MongoDB ---');
  try {
    await connectDB();
    if (mongoose.connection.readyState === 1) {
      summary.mongoConnectedReal = true;
      summary.check1_mongoConnection = 'PASS';
      console.log(`[PASS] MongoDB connected to real URI: ${config.mongoUri.split('@').pop()}`);
    } else {
      throw new Error(`Mongoose readyState is ${mongoose.connection.readyState}`);
    }
  } catch (err) {
    console.error(`[FAIL] MongoDB connection failed: ${err.message}`);
    console.error('CRITICAL: Test aborted. Real MongoDB persistence is required.');
    process.exit(1);
  }

  // Ensure a test Ward exists in real MongoDB for spatial resolution
  let testWard = await Ward.findOne({ name: 'Central Zone Ward 10' });
  if (!testWard) {
    testWard = await Ward.create({
      name: 'Central Zone Ward 10',
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [77.63, 12.96],
          [77.65, 12.96],
          [77.65, 12.98],
          [77.63, 12.98],
          [77.63, 12.96],
        ]],
      },
      defaultDepartmentMap: { water_supply: 'Water Dept East' },
    });
    console.log(`Seeded test ward in real MongoDB: ${testWard._id}`);
  }

  const createdSenderIds = [];
  const createdPhoneNumbers = [];

  // -----------------------------------------------------------------------
  // Check 2: Simulate Text Complaint End-to-End
  // -----------------------------------------------------------------------
  console.log('\n--- CHECK 2: Simulate Text Complaint End-to-End ---');
  const uniqueSender1 = `+91999911${Date.now().toString().slice(-4)}`;
  createdSenderIds.push(uniqueSender1);
  createdPhoneNumbers.push(uniqueSender1.replace(/\D/g, ''));
  const textRawInput = 'Heavy water pipeline leakage near Central Park main gate, Central Zone Ward 10 since morning.';
  const coordinatesInput = { lat: 12.97, lng: 77.64 };

  let complaint1Doc = null;
  try {
    const result1 = await createComplaint({
      channel: 'text',
      senderId: uniqueSender1,
      rawText: textRawInput,
      coordinates: coordinatesInput,
    });

    const createdId = result1._id || result1.complaint?._id;

    // Fetch directly from real MongoDB
    complaint1Doc = await Complaint.findById(createdId);

    console.log('\nReal Persisted Complaint Document from Mongo:');
    console.log(JSON.stringify(complaint1Doc, null, 2));

    const hasWardId = Boolean(complaint1Doc?.wardId);
    const hasCategory = Boolean(complaint1Doc?.structured?.category);
    const hasStatus = Boolean(complaint1Doc?.status);

    console.log(`\nDocument Validation Checks:`);
    console.log(` - wardId populated: ${hasWardId} (${complaint1Doc?.wardId})`);
    console.log(` - category populated: ${hasCategory} ("${complaint1Doc?.structured?.category}")`);
    console.log(` - status populated: ${hasStatus} ("${complaint1Doc?.status}")`);

    if (complaint1Doc && hasWardId && hasCategory && hasStatus) {
      summary.check2_textComplaintE2E = 'PASS';
    }
  } catch (err) {
    console.error(`[FAIL] Check 2 failed with error: ${err.message}`, err);
  }

  // -----------------------------------------------------------------------
  // Check 3: Duplicate Submission Verification
  // -----------------------------------------------------------------------
  console.log('\n--- CHECK 3: Duplicate Submission in 30-min Window ---');
  try {
    const dupResult = await createComplaint({
      channel: 'text',
      senderId: uniqueSender1,
      rawText: textRawInput,
      coordinates: coordinatesInput,
    });

    console.log('Duplicate Call Result:');
    console.log(JSON.stringify(dupResult, null, 2));

    const dbCount = await Complaint.countDocuments({ senderId: uniqueSender1 });
    console.log(`Matching documents in Mongo for senderId ${uniqueSender1}: ${dbCount}`);

    if (dupResult.duplicate === true && String(dupResult.existingComplaintId) === String(complaint1Doc._id) && dbCount === 1) {
      summary.check3_duplicateSubmission = 'PASS';
      console.log('[PASS] Duplicate correctly detected. Only 1 document exists in Mongo.');
    } else {
      console.error('[FAIL] Duplicate detection failed or document count > 1.');
    }
  } catch (err) {
    console.error(`[FAIL] Check 3 failed with error: ${err.message}`);
  }

  // -----------------------------------------------------------------------
  // Check 4: WhatsApp Webhook & Queue Integration
  // -----------------------------------------------------------------------
  console.log('\n--- CHECK 4: WhatsApp Webhook & Queue Processing ---');
  let server = null;
  try {
    const app = createApp();
    server = app.listen(0);
    const port = server.address().port;

    const waSenderId = `+91988877${Date.now().toString().slice(-4)}`;
    createdSenderIds.push(waSenderId);
    createdPhoneNumbers.push(waSenderId.replace(/\D/g, ''));
    const waPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_ENTRY_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550248142', phone_number_id: '1052445858' },
                messages: [
                  {
                    from: waSenderId,
                    id: `wamid_${Date.now()}`,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'location',
                    location: {
                      latitude: 12.97,
                      longitude: 77.64,
                      name: 'Central Zone Metro Station',
                      address: 'Central Zone Ward 10, Bangalore'
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    // Seed ConversationState and Citizen records to bypass onboarding flow in E2E test
    const ConversationState = require('../src/models/ConversationState');
    const Citizen = require('../src/models/Citizen');
    const cleanPhone = waSenderId.replace(/\D/g, '');
    await ConversationState.create({
      phoneNumber: cleanPhone,
      step: 'location_requested',
      language: 'en',
      pendingStructuredComplaint: {
        rawText: 'Garbage accumulation near Metro station, Central Zone Ward 10',
        structured: {
          category: 'sanitation',
          subcategory: 'garbage_accumulation',
          description: 'Garbage accumulation near Metro station',
          urgency: 'medium',
          locationMentioned: 'Central Zone Ward 10',
          language: 'en',
          confidence: 0.9,
          needsClarification: false
        },
        traceId: `trace_wa_${Date.now()}`
      }
    });
    await Citizen.create({
      name: 'Test Citizen',
      phone: waSenderId,
      language: 'en'
    });

    const rawBodyBuffer = Buffer.from(JSON.stringify(waPayload));
    const hmacSig = crypto
      .createHmac('sha256', whatsappConfig.appSecret || 'dev_app_secret')
      .update(rawBodyBuffer)
      .digest('hex');

    console.log(`Sending POST /api/webhooks/whatsapp to HTTP server port ${port}...`);
    const httpRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': `sha256=${hmacSig}`,
      },
      body: rawBodyBuffer,
    });

    console.log(`HTTP Webhook Response Status: ${httpRes.status}`);

    if (httpRes.status === 200) {
      console.log('Webhook returned 200 OK immediately. Waiting 15s for queued worker job execution...');
      await new Promise((resolve) => setTimeout(resolve, 15000));

      const waPersistedComplaint = await Complaint.findOne({ senderId: waSenderId }).sort({ createdAt: -1 });

      console.log('\nPersisted Complaint Document from WhatsApp Webhook Job:');
      console.log(JSON.stringify(waPersistedComplaint, null, 2));

      if (waPersistedComplaint && waPersistedComplaint.senderId === waSenderId) {
        summary.check4_whatsAppWebhookQueue = 'PASS';
        console.log('[PASS] WhatsApp webhook processed through queue and persisted to Mongo.');
      } else {
        console.error('[FAIL] Queued job did not result in a persisted complaint in Mongo.');
      }
    } else {
      console.error(`[FAIL] Webhook returned non-200 status: ${httpRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] Check 4 failed with error: ${err.message}`, err);
  } finally {
    try {
      if (mongoose.connection.readyState !== 0 && createdSenderIds.length > 0) {
        console.log('\nCleaning up E2E test data from MongoDB...');
        const Complaint = require('../src/models/Complaint');
        const Citizen = require('../src/models/Citizen');
        const ConversationState = require('../src/models/ConversationState');
        
        await Promise.all([
          Complaint.deleteMany({ senderId: { $in: createdSenderIds } }),
          Citizen.deleteMany({ phone: { $in: createdSenderIds } }),
          ConversationState.deleteMany({ phoneNumber: { $in: createdPhoneNumbers } })
        ]);
        console.log('Cleanup finished successfully.');
      }
    } catch (cleanupErr) {
      console.error('Error during test cleanup:', cleanupErr);
    }
    
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  // -----------------------------------------------------------------------
  // Summary Line Report
  // -----------------------------------------------------------------------
  console.log('\n===========================================================');
  console.log('                E2E TEST SUMMARY REPORT                    ');
  console.log('===========================================================');
  console.log(` Real Mongo Connected : ${summary.mongoConnectedReal ? 'YES' : 'NO'}`);
  console.log(` Check 1 (Mongo Connection)       : ${summary.check1_mongoConnection}`);
  console.log(` Check 2 (Text Complaint E2E)     : ${summary.check2_textComplaintE2E}`);
  console.log(` Check 3 (Duplicate Deduplication): ${summary.check3_duplicateSubmission}`);
  console.log(` Check 4 (WhatsApp Webhook/Queue) : ${summary.check4_whatsAppWebhookQueue}`);
  console.log('===========================================================');
}

runE2ETestPipeline();
