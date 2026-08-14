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
const wardIdToRemove = '6a5fa0e46d89779215eb7a84';

async function performRemoval() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  // 1. Reassign Complaints to null (Unassigned)
  console.log(`\n1. Reassigning complaints referencing wardId: ${wardIdToRemove} to null (Unassigned)...`);
  const updateResult = await Complaint.updateMany(
    { wardId: wardIdToRemove },
    { $set: { wardId: null } }
  );
  console.log(`Successfully updated ${updateResult.modifiedCount} complaints.`);

  // 2. Remove the Ward Document
  console.log(`\n2. Deleting ward with ID ${wardIdToRemove} ("Indiranagar Ward 10")...`);
  const deleteResult = await Ward.deleteOne({ _id: wardIdToRemove });
  console.log(`Successfully deleted ${deleteResult.deletedCount} ward document.`);

  // 3. Double Check no remaining officers point to it (just in case)
  console.log(`\n3. Verifying no officers reference the wardId...`);
  const officerUpdateResult = await Officer.updateMany(
    { wardIds: wardIdToRemove },
    { $pull: { wardIds: wardIdToRemove } }
  );
  console.log(`Removed ward reference from ${officerUpdateResult.modifiedCount} officer records.`);

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB. Removal complete.');
}

performRemoval().catch(err => {
  console.error('Removal failed:', err);
  process.exit(1);
});
