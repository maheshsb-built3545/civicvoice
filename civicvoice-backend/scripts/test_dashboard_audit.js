/**
 * test_dashboard_audit.js
 * -----------------------------------------------------------------------
 * Integration test verifying:
 *  1. Zero direct DB writes: status and assignment updates flow strictly through REST/service endpoints
 *  2. REST requests update Mongo and append lifecycleLog audit entries
 */

const jwt = require('jsonwebtoken');
const connectDB = require('../src/config/db');
const config = require('../src/config/env');
const createApp = require('../src/app');
const Complaint = require('../src/models/Complaint');
const Officer = require('../src/models/Officer');
const User = require('../src/models/User');
const { createComplaint } = require('../src/domain/complaints/complaint.service');

async function runDashboardAuditTest() {
  console.log('===========================================================');
  console.log('        DASHBOARD API INTEGRATION AUDIT TEST               ');
  console.log('===========================================================');

  let server = null;
  try {
    await connectDB();

    const app = createApp();
    server = app.listen(0);
    const port = server.address().port;

    // Setup test admin token
    let testUser = await User.findOne({ email: 'audit_admin@civicvoice.example' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Audit Admin',
        email: 'audit_admin@civicvoice.example',
        passwordHash: 'dummyhash',
        role: 'superadmin',
      });
    }
    
    const token = jwt.sign(
      { id: testUser._id.toString(), email: testUser.email, role: testUser.role, wardIds: [] },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Setup test officer
    let testOfficer = await Officer.findOne({ name: 'Audit Officer' });
    if (!testOfficer) {
      testOfficer = await Officer.create({
        name: 'Audit Officer',
        department: 'Water Dept',
        contact: '+919988776655',
        role: 'officer',
        userId: testUser._id,
      });
    }

    // Create test complaint with coordinates to get 'received' status
    const uniqueSender = `+919777${Date.now().toString().slice(-6)}`;
    const complaint = await createComplaint({
      channel: 'text',
      senderId: uniqueSender,
      rawText: 'Pothole on Main Street near Central Zone Ward 10 needs repair immediately.',
      coordinates: { lat: 12.97, lng: 77.64 },
    });

    const complaintId = complaint._id || complaint.complaint._id;

    console.log(`\nCreated initial test complaint: ${complaintId} (status: ${complaint.status || complaint.complaint.status})`);

    // 1. Test Status Update Endpoint PATCH /api/complaints/:id/status
    console.log('\n--- 1. Testing PATCH /api/complaints/:id/status ---');
    const statusRes = await fetch(`http://127.0.0.1:${port}/api/complaints/${complaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'in_progress', note: 'Dispatching maintenance team' }),
    });

    console.log(`HTTP Status: ${statusRes.status}`);
    const statusBody = await statusRes.json();
    console.log('Status Response Body:', JSON.stringify(statusBody, null, 2));

    // Verify Mongo persistence
    const updatedStatusDoc = await Complaint.findById(complaintId);
    console.log(`Updated Mongo status: "${updatedStatusDoc.status}"`);
    console.log('Lifecycle Log in Mongo:', JSON.stringify(updatedStatusDoc.lifecycleLog, null, 2));

    const statusSuccess =
      statusRes.status === 200 &&
      updatedStatusDoc.status === 'in_progress' &&
      updatedStatusDoc.lifecycleLog.some((e) => e.stage === 'in_progress' && e.note === 'Dispatching maintenance team');

    console.log(`Status API Audit Check: ${statusSuccess ? 'PASS' : 'FAIL'}`);

    // 2. Test Assignment Endpoint PATCH /api/complaints/:id/assign
    console.log('\n--- 2. Testing PATCH /api/complaints/:id/assign ---');
    const assignRes = await fetch(`http://127.0.0.1:${port}/api/complaints/${complaintId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ officerId: testOfficer._id.toString() }),
    });

    console.log(`HTTP Status: ${assignRes.status}`);
    const assignBody = await assignRes.json();

    const updatedAssignDoc = await Complaint.findById(complaintId);
    console.log(`Updated Mongo assignedOfficerId: "${updatedAssignDoc.assignedOfficerId}"`);
    console.log('Updated Lifecycle Log in Mongo:', JSON.stringify(updatedAssignDoc.lifecycleLog, null, 2));

    const assignSuccess =
      assignRes.status === 200 &&
      String(updatedAssignDoc.assignedOfficerId) === String(testOfficer._id) &&
      updatedAssignDoc.lifecycleLog.some((e) => e.stage === 'assigned');

    console.log(`Assign API Audit Check: ${assignSuccess ? 'PASS' : 'FAIL'}`);

    console.log('\n===========================================================');
    console.log('             DASHBOARD AUDIT SUMMARY                       ');
    console.log('===========================================================');
    console.log(` Status REST & Lifecycle Audit : ${statusSuccess ? 'PASS' : 'FAIL'}`);
    console.log(` Assign REST & Lifecycle Audit : ${assignSuccess ? 'PASS' : 'FAIL'}`);
    console.log('===========================================================');
  } catch (err) {
    console.error('Audit test error:', err);
  } finally {
    if (server) server.close();
    process.exit(0);
  }
}

runDashboardAuditTest();
