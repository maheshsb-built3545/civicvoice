const mongoose = require('mongoose');
const config = require('../src/config/env');
const createApp = require('../src/app');
const Citizen = require('../src/models/Citizen');
const User = require('../src/models/User');
const Officer = require('../src/models/Officer');
const Complaint = require('../src/models/Complaint');
const { register } = require('../src/domain/auth/auth.service');
const { signup } = require('../src/domain/auth/citizen-auth.service');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

let mongoServer;

async function setupDatabase() {
  try {
    console.log('Starting in-memory MongoDB Server (MongoMemoryServer)...');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    console.log('In-memory MongoDB Server connected successfully!');
    return true;
  } catch (err) {
    console.log('Failed to start MongoMemoryServer:', err.message);
  }
  return false;
}

async function runTests() {
  const dbConnected = await setupDatabase();
  if (!dbConnected) {
    console.error('Cannot run tests without a database connection.');
    process.exit(1);
  }

  // Setup app & server
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  try {
    // 1. Create Admin
    console.log('\n--- 1. Creating Admin ---');
    const adminRes = await register({
      name: 'Super Admin',
      email: 'admin@civicvoice.org',
      password: 'SecurePassword123!',
      role: 'superadmin'
    });
    const adminToken = adminRes.token;
    console.log('Admin Token Issued:', !!adminToken);

    // 2. Create Citizen
    console.log('\n--- 2. Creating Citizen ---');
    const citizenRes = await signup('Test Citizen', '+919999111222', 'citizenpass123');
    const citizenToken = citizenRes.token;
    console.log('Citizen Token Issued:', !!citizenToken);

    // 3. Create Officer
    console.log('\n--- 3. Creating Officer ---');
    const officer = await Officer.create({
      name: 'Officer Rajesh',
      officerId: 'OFF-1234',
      department: 'Water Dept',
      contact: '+919876543210',
      role: 'officer',
      categories: ['water_supply']
    });
    const officerToken = jwt.sign(
      { officerId: 'OFF-1234', id: officer._id.toString(), role: 'officer' },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    console.log('Officer Token Issued:', !!officerToken);

    // 4. Create Complaint
    console.log('\n--- 4. Creating a Complaint via Admin/System ---');
    const complaint = await Complaint.create({
      traceId: 'test_trace_123',
      channel: 'text',
      senderId: '+919999111222',
      rawText: 'Broken water pipe near temple',
      structured: {
        category: 'water_supply',
        description: 'Broken water pipe near temple',
        urgency: 'high',
        language: 'en',
        confidence: 0.9,
        needsClarification: false
      },
      status: 'received'
    });
    console.log('Complaint Created ID:', complaint._id.toString());

    // 5. Test Admin updating status (allowed)
    console.log('\n--- 5. Testing Admin status update (PATCH /api/complaints/:id/status) ---');
    const adminPatchRes = await apiRequest(`/api/complaints/${complaint._id}/status`, 'PATCH', {
      status: 'in_progress',
      note: 'Admin assigned it'
    }, adminToken);
    console.log('Admin Patch Status:', adminPatchRes.status);
    if (adminPatchRes.status !== 200) {
      throw new Error(`Admin should be allowed to update status, got: ${adminPatchRes.status}`);
    }

    // 6. Test Citizen updating status (Forbidden)
    console.log('\n--- 6. Testing Citizen status update (PATCH /api/complaints/:id/status) ---');
    const citizenPatchRes = await apiRequest(`/api/complaints/${complaint._id}/status`, 'PATCH', {
      status: 'resolved',
      note: 'Citizen closed it'
    }, citizenToken);
    console.log('Citizen Patch Status (Expected 403):', citizenPatchRes.status);
    if (citizenPatchRes.status !== 403) {
      throw new Error(`Citizen should be rejected with 403, got: ${citizenPatchRes.status}`);
    }

    // 7. Test Officer updating status on assigned complaint (PATCH /api/officer/complaints/:id/status)
    // First, assign the complaint to the officer
    complaint.assignedOfficerId = officer._id;
    await complaint.save();
    console.log('\nAssigned Complaint to Officer.');

    console.log('\n--- 7. Testing Officer status update (PATCH /api/officer/complaints/:id/status) ---');
    const officerPatchRes = await apiRequest(`/api/officer/complaints/${complaint._id}/status`, 'PATCH', {
      status: 'resolved',
      note: 'Officer fixed it'
    }, officerToken);
    console.log('Officer Patch Status:', officerPatchRes.status);
    console.log('Response Message:', officerPatchRes.data.message);
    if (officerPatchRes.status !== 200) {
      throw new Error(`Officer should be allowed to update assigned complaint status, got: ${officerPatchRes.status}`);
    }

    console.log('\nAll security tests passed successfully!');
  } catch (err) {
    console.error('\nSecurity Test failed with error:', err.message);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runTests();
