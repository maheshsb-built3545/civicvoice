const dns = require('dns');
// Windows-specific DNS resolution fix for MongoDB Atlas SRV URI
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const Ward = require('../src/models/Ward');
const Officer = require('../src/models/Officer');
const Complaint = require('../src/models/Complaint');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/civicvoice';

async function search() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  console.log('\n--- SEARCHING FOR WARDS ---');
  const wards = await Ward.find({});
  const matchedWards = wards.filter(w => 
    /indira/i.test(w.name) || /nagar/i.test(w.name) || /indiranagar/i.test(w.name)
  );

  console.log(`Found ${matchedWards.length} matching wards:`);
  console.log(JSON.stringify(matchedWards, null, 2));

  if (matchedWards.length > 0) {
    const wardIds = matchedWards.map(w => w._id);
    
    console.log('\n--- SEARCHING FOR COMPLAINTS ---');
    const complaints = await Complaint.find({ wardId: { $in: wardIds } });
    console.log(`Found ${complaints.length} complaints assigned to these wards:`);
    console.log(JSON.stringify(complaints.map(c => ({
      _id: c._id,
      traceId: c.traceId,
      rawText: c.rawText,
      status: c.status,
      wardId: c.wardId
    })), null, 2));

    console.log('\n--- SEARCHING FOR OFFICERS ---');
    const officers = await Officer.find({ wardIds: { $in: wardIds } });
    console.log(`Found ${officers.length} officers assigned to these wards:`);
    console.log(JSON.stringify(officers.map(o => ({
      _id: o._id,
      name: o.name,
      officerId: o.officerId,
      department: o.department,
      wardIds: o.wardIds
    })), null, 2));
  } else {
    console.log('No matching wards found.');
  }

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB.');
}

search().catch(err => {
  console.error(err);
  process.exit(1);
});
