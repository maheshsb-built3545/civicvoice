const mongoose = require('mongoose');
const config = require('../src/config/env');
const createApp = require('../src/app');
const Citizen = require('../src/models/Citizen');
const Complaint = require('../src/models/Complaint');

const { MongoMemoryServer } = require('mongodb-memory-server');
let mongoServer;

async function setupDatabase() {
  const uris = [
    'mongodb://127.0.0.1:27017/civicvoice_test',
    config.mongoUri,
  ];

  for (const uri of uris) {
    try {
      console.log(`Connecting to MongoDB (${uri.split('@').pop()})...`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000, family: 4 });
      console.log('MongoDB connected successfully!');
      return true;
    } catch (err) {
      console.log(`Connection to ${uri.split('@').pop()} failed: ${err.message}`);
    }
  }

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
    const uniquePhone = `+919999${Math.floor(100000 + Math.random() * 900000)}`;
    console.log(`\n--- 1. Testing Citizen Registration for phone ${uniquePhone} ---`);
    
    const regRes = await apiRequest('/api/citizen/signup', 'POST', {
      name: 'Test Citizen',
      phone: uniquePhone,
      password: 'citizenpassword123'
    });

    console.log('Registration Status:', regRes.status);
    console.log('Registration Response:', JSON.stringify(regRes.data));

    if (regRes.status !== 201 || !regRes.data.token) {
      throw new Error('Registration failed');
    }

    const token = regRes.data.token;

    console.log('\n--- 2. Testing Citizen Login ---');
    const loginRes = await apiRequest('/api/citizen/login', 'POST', {
      phone: uniquePhone,
      password: 'citizenpassword123'
    });

    console.log('Login Status:', loginRes.status);
    console.log('Login Response:', JSON.stringify(loginRes.data));
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error('Login failed');
    }

    console.log('\n--- 3. Testing Get Empty Complaints ---');
    const emptyRes = await apiRequest('/api/citizen/complaints', 'GET', null, token);
    console.log('Get Empty Complaints Status:', emptyRes.status);
    console.log('Complaints Count:', emptyRes.data.length);
    if (emptyRes.status !== 200 || !Array.isArray(emptyRes.data)) {
      throw new Error('Get complaints failed');
    }

    console.log('\n--- 4. Testing Create Complaint with explicit Overrides ---');
    const createRes = await apiRequest('/api/citizen/complaints', 'POST', {
      description: 'Big water leak at Main St, sewage smells bad',
      category: 'water_supply',
      location: 'Main St Near Post Office'
    }, token);

    console.log('Create Complaint Status:', createRes.status);
    console.log('Create Complaint Response ID:', createRes.data._id);
    console.log('Structured Info:', JSON.stringify(createRes.data.structured));
    
    if (createRes.status !== 201 || !createRes.data._id) {
      throw new Error('Create complaint with overrides failed');
    }

    if (createRes.data.structured.category !== 'water_supply' || createRes.data.structured.locationMentioned !== 'Main St Near Post Office') {
      throw new Error('Category or location override not applied correctly');
    }

    console.log('\n--- 5. Testing Create Complaint with AI Inference ---');
    const createAIRes = await apiRequest('/api/citizen/complaints', 'POST', {
      description: 'Pot holes all over Mahatma Gandhi road'
    }, token);

    console.log('Create AI Complaint Status:', createAIRes.status);
    console.log('Create AI Complaint Response ID:', createAIRes.data._id);
    console.log('AI Structured Info:', JSON.stringify(createAIRes.data.structured));

    if (createAIRes.status !== 201 || !createAIRes.data._id) {
      throw new Error('Create complaint with AI inference failed');
    }

    console.log('\n--- 6. Testing Get Complaints List ---');
    const listRes = await apiRequest('/api/citizen/complaints', 'GET', null, token);
    console.log('List Status:', listRes.status);
    console.log('List Count (Expected 2):', listRes.data.length);
    console.log('First Complaint (Should be most recent AI complaint):', JSON.stringify(listRes.data[0]));
    
    if (listRes.data.length !== 2) {
      throw new Error('Complaints count does not match');
    }

    if (new Date(listRes.data[0].createdAt) < new Date(listRes.data[1].createdAt)) {
      throw new Error('Complaints are not sorted by createdAt descending');
    }

    console.log('\n--- 7. Testing Get Complaints with Status Filter ---');
    const filterRes = await apiRequest(`/api/citizen/complaints?status=needsClarification`, 'GET', null, token);
    console.log('Filtered Status:', filterRes.status);
    console.log('Filtered Count:', filterRes.data.length);

    console.log('\nAll tests completed successfully!');
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
