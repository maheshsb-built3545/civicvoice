const mongoose = require('mongoose');
const config = require('../src/config/env');
const createApp = require('../src/app');
const Citizen = require('../src/models/Citizen');
const ConversationState = require('../src/models/ConversationState');
const Complaint = require('../src/models/Complaint');
const { MongoMemoryServer } = require('mongodb-memory-server');

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
    // Test 1: Phone number with no WhatsApp history
    console.log('\n--- 1. Testing OTP request for phone with no WhatsApp history ---');
    const fakePhone = '+919876500000';
    const fakeRes = await apiRequest('/api/citizen/request-otp', 'POST', { phone: fakePhone });
    console.log('Status (Expected 404):', fakeRes.status);
    console.log('Message:', fakeRes.data.message);
    if (fakeRes.status !== 404) {
      throw new Error(`Should fail with 404, got: ${fakeRes.status}`);
    }

    // Test 2: Phone number with WhatsApp history
    console.log('\n--- 2. Testing OTP request for phone WITH WhatsApp history ---');
    const activePhone = '+919999222333';
    
    // Simulate WhatsApp history by adding ConversationState
    await ConversationState.create({
      phoneNumber: '919999222333',
      step: 'active'
    });
    console.log('Simulated WhatsApp conversation state created.');

    const otpRes1 = await apiRequest('/api/citizen/request-otp', 'POST', { phone: activePhone });
    console.log('Status (Expected 200):', otpRes1.status);
    console.log('Message:', otpRes1.data.message);
    if (otpRes1.status !== 200) {
      throw new Error(`OTP request failed, got status: ${otpRes1.status}`);
    }

    // Fetch citizen from DB to verify state
    let citizen = await Citizen.findOne({ phone: activePhone });
    console.log('Citizen auto-created:', !!citizen);
    console.log('Name:', citizen.name);
    console.log('OTP saved in DB:', citizen.otp);
    console.log('OTP Expires in DB:', citizen.otpExpires);
    
    if (!citizen || !citizen.otp) {
      throw new Error('Citizen or OTP not saved correctly in database.');
    }

    const savedOtp = citizen.otp;

    // Test 3: Rate limiting on requesting OTP (Max 3)
    console.log('\n--- 3. Testing request-otp Rate Limiting (Limit is 3) ---');
    const otpRes2 = await apiRequest('/api/citizen/request-otp', 'POST', { phone: activePhone });
    console.log('2nd OTP request status (Expected 200):', otpRes2.status);
    
    const otpRes3 = await apiRequest('/api/citizen/request-otp', 'POST', { phone: activePhone });
    console.log('3rd OTP request status (Expected 200):', otpRes3.status);

    const otpRes4 = await apiRequest('/api/citizen/request-otp', 'POST', { phone: activePhone });
    console.log('4th OTP request status (Expected 429):', otpRes4.status);
    console.log('Message:', otpRes4.data.message);
    
    if (otpRes4.status !== 429) {
      throw new Error(`4th OTP request should be rate limited, got status: ${otpRes4.status}`);
    }

    // Test 4: Verify OTP and Set Password with invalid OTP
    console.log('\n--- 4. Verify with INVALID OTP ---');
    const verifyFailRes = await apiRequest('/api/citizen/verify-otp-set-password', 'POST', {
      phone: activePhone,
      otp: '000000',
      newPassword: 'citizenpassword123'
    });
    console.log('Verify Status (Expected 400):', verifyFailRes.status);
    console.log('Message:', verifyFailRes.data.message);
    if (verifyFailRes.status !== 400) {
      throw new Error(`Should fail with 400, got: ${verifyFailRes.status}`);
    }

    // Test 5: Verify OTP and Set Password with correct OTP
    console.log('\n--- 5. Verify with CORRECT OTP and set password ---');
    const finalCitizen = await Citizen.findOne({ phone: activePhone });
    const latestOtp = finalCitizen.otp;

    const verifySuccessRes = await apiRequest('/api/citizen/verify-otp-set-password', 'POST', {
      phone: activePhone,
      otp: latestOtp,
      newPassword: 'citizenpassword123'
    });
    console.log('Verify Status (Expected 200):', verifySuccessRes.status);
    console.log('Message:', verifySuccessRes.data.message);
    if (verifySuccessRes.status !== 200) {
      throw new Error(`Verify OTP failed, got status: ${verifySuccessRes.status}`);
    }

    // Fetch citizen from DB to verify password hash and OTP cleared
    citizen = await Citizen.findOne({ phone: activePhone });
    console.log('Citizen passwordHash exists:', !!citizen.passwordHash);
    console.log('Citizen OTP cleared:', citizen.otp === null);
    
    if (!citizen.passwordHash || citizen.otp !== null) {
      throw new Error('Password hash not set or OTP not cleared on database.');
    }

    // Test 6: Verify normal login works with the newly set password
    console.log('\n--- 6. Log in with the newly set password ---');
    const loginRes = await apiRequest('/api/citizen/login', 'POST', {
      phone: activePhone,
      password: 'citizenpassword123'
    });
    console.log('Login Status (Expected 200):', loginRes.status);
    console.log('Login Token Issued:', !!loginRes.data.token);
    
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Citizen login failed, got status: ${loginRes.status}`);
    }

    console.log('\nAll OTP and Set Password tests passed successfully!');
  } catch (err) {
    console.error('\nTest failed with error:', err.message);
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
