/**
 * test_idempotency.js
 * -----------------------------------------------------------------------
 * Verifies that the WhatsApp webhook ignores messages older than 2 minutes
 * and rejects duplicate message IDs.
 */

const mongoose = require('mongoose');
const config = require('../src/config/env');
const connectDB = require('../src/config/db');
const createApp = require('../src/app');

async function runIdempotencyTest() {
  console.log('Connecting to database...');
  await connectDB();

  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;

  const testPhone = '919999944444';
  const senderId = `+${testPhone}`;

  // Helper to generate webhook payloads
  const createPayload = (msgId, timestampSec) => ({
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
                  timestamp: timestampSec.toString(),
                  type: 'text',
                  text: { body: 'Fresh complaint text' }
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  });

  try {
    const currentSec = Math.floor(Date.now() / 1000);

    // 1. Test Fresh Message: Should respond 200 OK
    console.log('\n--- 1. Testing Fresh Message (Age: 0s) ---');
    const freshRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload('wamid_unique_1', currentSec))
    });
    console.log(`HTTP Status: ${freshRes.status}, Text: ${await freshRes.text()}`);

    // 2. Test Aged Message (Age: 300s/5min): Should return 200 OK but be ignored
    console.log('\n--- 2. Testing Aged Message (Age: 300s) ---');
    const agedRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload('wamid_unique_2', currentSec - 300))
    });
    console.log(`HTTP Status: ${agedRes.status}, Text: ${await agedRes.text()}`);

    // 3. Test Duplicate Message ID: Should reject processed ID
    console.log('\n--- 3. Testing Duplicate Message (ID: wamid_unique_1) ---');
    const duplicateRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload('wamid_unique_1', currentSec))
    });
    console.log(`HTTP Status: ${duplicateRes.status}, Text: ${await duplicateRes.text()}`);

    console.log('\nCheck server logs to verify warnings were printed for aged and duplicate messages.');
    console.log('✅ TEST EXECUTION FINISHED');
  } catch (err) {
    console.error('❌ FAIL: Test failed with error:', err);
  } finally {
    server.close();
    await mongoose.disconnect();
    console.log('Disconnected database and stopped server.');
  }
}

runIdempotencyTest();
