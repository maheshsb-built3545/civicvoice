require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Officer = require('../src/models/Officer');
const Ward = require('../src/models/Ward');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');

function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

async function run() {
  await connectDB();
  const adminUser = await User.findOne({ username: 'admin' });
  const ward = await Ward.findOne({});
  
  if (!adminUser || !ward) {
    console.error('Prerequisites not met!');
    process.exit(1);
  }

  const token = generateToken({
    id: adminUser._id.toString(),
    email: adminUser.email,
    username: adminUser.username,
    role: adminUser.role,
    tokenVersion: adminUser.tokenVersion || 0
  });

  const app = require('../src/app')();
  const port = 9185;
  const server = app.listen(port);

  // Test creating an officer with 'wards' as a non-empty array
  console.log('Sending create officer POST request...');
  const res = await fetch(`http://localhost:${port}/api/admin/officers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Test Officer Array',
      phone: '+919999999999',
      categories: ['roads'],
      wards: [ward._id.toString()]
    })
  });

  console.log('HTTP Status:', res.status);
  const json = await res.json();
  console.log('Response:', json);

  // Clean up created test officer
  if (json.officer && json.officer._id) {
    await Officer.deleteOne({ _id: json.officer._id });
    await User.deleteOne({ username: json.username });
    console.log('Cleaned up created test officer account.');
  }

  server.close();
  await mongoose.disconnect();
}

run().catch(console.error);
