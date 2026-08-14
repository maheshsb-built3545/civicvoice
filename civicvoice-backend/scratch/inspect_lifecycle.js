const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Complaint = require('../src/models/Complaint');

async function run() {
  await connectDB();

  try {
    const complaint = await Complaint.findById('6a7f21655f6d28f211ca1d43').lean();
    if (!complaint) {
      console.log('Complaint not found');
      return;
    }
    console.log('Complaint:', complaint._id);
    console.log('  status:', complaint.status);
    console.log('  assignedOfficerId:', complaint.assignedOfficerId);
    console.log('  lifecycleLog:', JSON.stringify(complaint.lifecycleLog, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
