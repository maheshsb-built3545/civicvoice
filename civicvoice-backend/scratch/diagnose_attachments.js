const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Complaint = require('../src/models/Complaint');

async function diagnose() {
  console.log('Connecting to database...');
  await connectDB();

  try {
    const complaints = await Complaint.find({ 'attachments.0': { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    if (complaints.length === 0) {
      console.log('No complaints with attachments found in database.');
    } else {
      console.log(`Found ${complaints.length} complaint(s) with attachments:`);
      complaints.forEach((comp, idx) => {
        console.log(`\n--- Complaint ${idx + 1} ---`);
        console.log(`ID:         ${comp._id}`);
        console.log(`Created At: ${comp.createdAt}`);
        console.log(`rawText:    ${comp.rawText}`);
        console.log(`Attachments:`, JSON.stringify(comp.attachments, null, 2));
      });
    }
  } catch (err) {
    console.error('Diagnosis query failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected database.');
  }
}

diagnose();
