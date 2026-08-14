/**
 * test_whatsapp_webhook.js
 * -----------------------------------------------------------------------
 * Integration tests for the WhatsApp webhook GET and POST endpoints.
 * Uses MongoMemoryServer to verify full pipeline database writes.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../src/config/env');
const createApp = require('../src/app');

// Import Complaint model to check record creation
const Complaint = require('../src/models/Complaint');

let mongoServer;

async function setupDatabase() {
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, { family: 4 });
    console.log(`Connected to MongoMemoryServer: ${uri}`);
    return true;
  } catch (err) {
    console.error('Failed to connect to MongoMemoryServer:', err);
    return false;
  }
}

async function runTests() {
  const dbConnected = await setupDatabase();
  if (!dbConnected) {
    console.error('Database connection failed. Exiting tests.');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Test server running at ${baseUrl}`);

  try {
    // -------------------------------------------------------------------------
    // Test 1: GET webhook handshake (Success)
    // -------------------------------------------------------------------------
    console.log('\nRunning Test 1: GET webhook handshake (Success)...');
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'civicvoice-verify-123';
    const challenge = 'test_challenge_12345';
    
    const getSuccessRes = await fetch(
      `${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`
    );
    const getSuccessText = await getSuccessRes.text();
    
    if (getSuccessRes.status === 200 && getSuccessText === challenge) {
      console.log('✅ GET handshake success test passed');
    } else {
      console.error(`❌ GET handshake success test failed: Status = ${getSuccessRes.status}, Text = ${getSuccessText}`);
    }

    // -------------------------------------------------------------------------
    // Test 2: GET webhook handshake (Failure - incorrect token)
    // -------------------------------------------------------------------------
    console.log('\nRunning Test 2: GET webhook handshake (Failure - incorrect token)...');
    const getFailureRes = await fetch(
      `${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=${challenge}`
    );
    if (getFailureRes.status === 403) {
      console.log('✅ GET handshake failure test passed');
    } else {
      console.error(`❌ GET handshake failure test failed: Status = ${getFailureRes.status}`);
    }

    // -------------------------------------------------------------------------
    // Test 3: POST webhook text message (Success)
    // -------------------------------------------------------------------------
    console.log('\nRunning Test 3: POST webhook text message...');
    const textPayload = {
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
                    from: '+919999988888',
                    type: 'text',
                    text: {
                      body: 'The street light near the public park is broken and needs repair immediately.'
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

    // Seed ConversationState and Citizen records to bypass onboarding flow in test
    const ConversationState = require('../src/models/ConversationState');
    const Citizen = require('../src/models/Citizen');
    await ConversationState.create({
      phoneNumber: '919999988888',
      step: 'active',
      language: 'en'
    });
    await Citizen.create({
      name: 'Test Citizen',
      phone: '+919999988888',
      language: 'en'
    });

    const postRes = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(textPayload)
    });
    
    const postText = await postRes.text();
    if (postRes.status === 200 && postText === 'EVENT_RECEIVED') {
      console.log('✅ POST webhook responded 200 OK immediately');
    } else {
      console.error(`❌ POST webhook failed to respond 200: Status = ${postRes.status}, Text = ${postText}`);
    }

    // Give it a short delay for asynchronous processing (AI extraction and DB write)
    console.log('Waiting for asynchronous processing...');
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Verify complaint creation in DB
    const complaint = await Complaint.findOne({ senderId: '+919999988888' });
    if (complaint) {
      console.log('✅ Complaint created in DB successfully!');
      console.log('Created Complaint details:', {
        id: complaint._id,
        senderId: complaint.senderId,
        channel: complaint.channel,
        rawText: complaint.rawText,
        status: complaint.status,
        category: complaint.structured?.category,
        urgency: complaint.structured?.urgency,
      });
    } else {
      console.error('❌ Complaint was not found in DB!');
    }

    // -------------------------------------------------------------------------
    // Test 4: POST webhook audio message (Logged and skipped)
    // -------------------------------------------------------------------------
    console.log('\nRunning Test 4: POST webhook audio message...');
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
                    from: '+919999988888',
                    type: 'audio',
                    audio: {
                      id: 'audio_id_123'
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

    const postAudioRes = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(audioPayload)
    });

    if (postAudioRes.status === 200) {
      console.log('✅ POST audio webhook responded 200 OK immediately');
    } else {
      console.error(`❌ POST audio webhook failed: Status = ${postAudioRes.status}`);
    }

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('\nTests completed.');
  }
}

runTests();
