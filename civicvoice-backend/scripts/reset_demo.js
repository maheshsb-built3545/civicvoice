const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Officer = require('../src/models/Officer');
const Citizen = require('../src/models/Citizen');
const Complaint = require('../src/models/Complaint');
const Ward = require('../src/models/Ward');
const ConversationState = require('../src/models/ConversationState');
const AssignmentRule = require('../src/models/AssignmentRule');
const bcrypt = require('bcryptjs');

async function run() {
  const testPhone = process.argv[2];
  if (!testPhone) {
    console.error('Please specify your test WhatsApp phone number as an argument.');
    console.error('Example: node scripts/reset_demo.js 919999999999');
    process.exit(1);
  }

  const cleanPhone = testPhone.replace(/\D/g, '');
  const contactPhone = `+${cleanPhone}`;

  console.log(`Resetting CivicVoice demo environment for test number: ${contactPhone}`);
  
  await connectDB();

  // 1. Clear complaints
  console.log('Clearing old complaints...');
  await Complaint.deleteMany({});

  // 2. Reset Conversation States
  console.log(`Resetting ConversationState for ${cleanPhone}...`);
  await ConversationState.deleteMany({ phoneNumber: cleanPhone });
  
  // Clear any existing Citizen object for this number
  console.log(`Resetting Citizen profile for ${cleanPhone}...`);
  await Citizen.deleteMany({ phone: contactPhone });

  // 3. Clear Redis keys
  console.log('Clearing Redis rate-limiting and alert state...');
  try {
    const { redisClient } = require('../src/utils/redis');
    if (redisClient) {
      let retries = 5;
      while (redisClient.status !== 'ready' && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
      }
      if (redisClient.status === 'ready') {
        const rateLimitKey = `ratelimit:complaints:${cleanPhone}`;
        await redisClient.del(rateLimitKey);
        await redisClient.del('alertwindow:failures:ai_extraction');
        await redisClient.del('alertwindow:failures:geocoding');
        await redisClient.del('alertwindow:failures:whatsapp_send');
        await redisClient.del('alertwindow:alerted:ai_extraction');
        await redisClient.del('alertwindow:alerted:geocoding');
        await redisClient.del('alertwindow:alerted:whatsapp_send');
        console.log(' - Successfully cleared Redis keys.');
      } else {
        console.log(' - Redis is offline; skipped clearing Redis keys.');
      }
    }
  } catch (err) {
    console.warn(' - Failed to clear Redis keys (Redis offline):', err.message);
  }

  // 4. Ensure demo officers exist with the WhatsApp contact set to the test number
  console.log('Configuring demo officers and assignment rules...');
  
  console.log('Clearing existing wards and seeding 5 Kopargaon wards...');
  await Ward.deleteMany({});
  const defaultWards = [
    {
      name: 'Sanjivani Campus Ward',
      marathiName: 'संजीवनी कॅम्पस प्रभाग',
      boundary: { type: 'Polygon', coordinates: [[[74.485, 19.870], [74.500, 19.870], [74.500, 19.890], [74.485, 19.890], [74.485, 19.870]]] }
    },
    {
      name: 'Mahadevnagar',
      marathiName: 'महादेवनगर',
      boundary: { type: 'Polygon', coordinates: [[[74.462, 19.855], [74.485, 19.855], [74.485, 19.872], [74.462, 19.872], [74.462, 19.855]]] }
    },
    {
      name: 'Sainagar',
      marathiName: 'साईनगर',
      boundary: { type: 'Polygon', coordinates: [[[74.440, 19.872], [74.462, 19.872], [74.462, 19.892], [74.440, 19.892], [74.440, 19.872]]] }
    },
    {
      name: 'Singnapur',
      marathiName: 'शिंगणापूर',
      boundary: { type: 'Polygon', coordinates: [[[74.500, 19.870], [74.520, 19.870], [74.520, 19.892], [74.500, 19.892], [74.500, 19.870]]] }
    },
    {
      name: 'Kojagiri',
      marathiName: 'कोजागिरी',
      boundary: { type: 'Polygon', coordinates: [[[74.440, 19.892], [74.500, 19.892], [74.500, 19.912], [74.440, 19.912], [74.440, 19.892]]] }
    },
  ];
  wards = await Ward.insertMany(defaultWards);

  const sanjivaniWard   = wards.find(w => w.name === 'Sanjivani Campus Ward');
  const mahadevnagarWard = wards.find(w => w.name === 'Mahadevnagar');

  await Officer.deleteMany({});
  await AssignmentRule.deleteMany({});

  const [anita, ravi] = await Officer.insertMany([
    {
      name: 'Shanaya Deshmukh',
      officerId: 'OFF-1001',
      department: 'Roads and Infrastructure',
      contact: contactPhone,
      wardIds: [sanjivaniWard._id],
      categories: ['roads'],
      active: true
    },
    {
      name: 'Akaay Kulkarni',
      officerId: 'OFF-1002',
      department: 'Sanitation',
      contact: contactPhone,
      wardIds: [mahadevnagarWard._id],
      categories: ['sanitation'],
      active: true
    }
  ]);

  await AssignmentRule.insertMany([
    {
      wardId: sanjivaniWard._id,
      category: 'roads',
      officerId: anita._id,
      priority: 1,
    },
    {
      wardId: mahadevnagarWard._id,
      category: 'sanitation',
      officerId: ravi._id,
      priority: 1,
    }
  ]);

  await User.deleteMany({ role: 'admin' });
  await User.deleteMany({ username: { $in: ['anita', 'shanaya'] } });
  
  const adminPassword = 'password123';
  const officerPassword = 'anita-test-password';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const officerHash = await bcrypt.hash(officerPassword, 10);

  await User.create([
    { name: 'Super Admin', email: 'admin@civicvoice.gov', username: 'admin', passwordHash: adminHash, role: 'admin' },
    { name: 'Shanaya Deshmukh', email: 'shanaya@civicvoice.org', username: 'shanaya', passwordHash: officerHash, role: 'officer', officerId: anita._id }
  ]);

  console.log('\n=======================================');
  console.log('CivicVoice Demo Environment Reset Complete!');
  console.log('=======================================');
  console.log(`- Test Phone Number: ${contactPhone}`);
  console.log('- Demo User logins:');
  console.log(`  * Admin Dashboard: admin@civicvoice.gov / ${adminPassword}`);
  console.log(`  * Officer Portal (Shanaya): shanaya / ${officerPassword}`);
  console.log('- All officers updated to route outbound WhatsApp notifications to your phone number!');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
