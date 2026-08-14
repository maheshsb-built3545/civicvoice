const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Complaint = require('../src/models/Complaint');
const Officer = require('../src/models/Officer');
const Ward = require('../src/models/Ward');

async function run() {
  await connectDB();

  try {
    const complaints = await Complaint.find({}).populate('wardId').populate('assignedOfficerId');
    console.log(`Total complaints: ${complaints.length}`);
    for (const c of complaints) {
      console.log(`ID: ${c._id}`);
      console.log(`  Description: ${c.structured?.description || c.rawText}`);
      console.log(`  Ward: ${c.wardId ? c.wardId.name : 'None'} (${c.wardId ? c.wardId._id : ''})`);
      console.log(`  Assigned Officer: ${c.assignedOfficerId ? c.assignedOfficerId.name : 'None'} (${c.assignedOfficerId ? c.assignedOfficerId._id : ''})`);
      console.log(`  Status: ${c.status}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
