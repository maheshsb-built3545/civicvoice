/**
 * test_photo_search.js
 * -----------------------------------------------------------------------
 * Integration test verifying that GET /api/admin/complaints/by-phone/:senderId
 * returns the expected complaints and their attachment arrays.
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');
const connectDB = require('../src/config/db');
const createApp = require('../src/app');
const Complaint = require('../src/models/Complaint');

async function runTest() {
  console.log('Connecting to database...');
  await connectDB();

  const testPhone = '+919999912345';

  // 1. Clean up and insert test complaints for this phone number
  await Complaint.deleteMany({ senderId: testPhone });

  const complaint1 = await Complaint.create({
    traceId: 'trace_photo_search_test_1',
    channel: 'whatsapp',
    senderId: testPhone,
    rawText: 'Pothole photo test complaint',
    status: 'received',
    structured: {
      category: 'roads',
      subcategory: 'pothole',
      description: 'Pothole on the main road',
      urgency: 'medium',
      locationMentioned: 'Central Zone Ward 10',
      language: 'en',
      confidence: 0.95
    },
    attachments: [
      {
        url: '/uploads/pothole_1.jpg',
        mediaId: 'media_id_test_pothole_1',
        mimeType: 'image/jpeg',
        uploadedAt: new Date()
      }
    ]
  });

  const complaint2 = await Complaint.create({
    traceId: 'trace_photo_search_test_2',
    channel: 'whatsapp',
    senderId: testPhone,
    rawText: 'Text complaint without photo',
    status: 'assigned',
    structured: {
      category: 'sanitation',
      subcategory: 'garbage',
      description: 'Garbage dump pile',
      urgency: 'low',
      locationMentioned: 'Central Zone Ward 10',
      language: 'en',
      confidence: 0.90
    },
    attachments: []
  });

  console.log('Created test complaints in database.');

  // 2. Generate a valid admin token
  const payload = {
    id: '6a6b540c8ac98f6d844bdfff',
    email: 'photo-admin-tester@civicvoice.in',
    role: 'superadmin',
    username: 'PhotoAdminTester'
  };
  const token = jwt.sign(payload, config.jwtSecret);

  // 3. Start local server on random port
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  console.log(`Server listening on port ${port}`);

  try {
    console.log(`Sending GET request to /api/admin/complaints/by-phone/${encodeURIComponent(testPhone)}...`);
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/complaints/by-phone/${encodeURIComponent(testPhone)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Response status: ${res.status}`);
    const data = await res.json();
    console.log(`Response body:`, JSON.stringify(data, null, 2));

    if (res.status !== 200) {
      throw new Error(`Expected status 200, got ${res.status}`);
    }

    if (!data.complaints || data.complaints.length !== 2) {
      throw new Error(`Expected 2 complaints in list, got ${data.complaints ? data.complaints.length : 0}`);
    }

    // Verify attachments are populated
    const complaintWithPhoto = data.complaints.find(c => c.traceId === 'trace_photo_search_test_1');
    if (!complaintWithPhoto || !complaintWithPhoto.attachments || complaintWithPhoto.attachments.length !== 1) {
      throw new Error('Complaint 1 attachments were not correctly populated or returned');
    }

    console.log('✅ BACKEND API VERIFICATION PASSED!');
  } catch (err) {
    console.error('❌ BACKEND API VERIFICATION FAILED:', err);
  } finally {
    // Cleanup test data
    await Complaint.deleteMany({ senderId: testPhone });
    server.close();
    await mongoose.disconnect();
    console.log('Database disconnected and server closed.');
  }
}

runTest();
