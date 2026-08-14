const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Complaint = require('../src/models/Complaint');
const { assignComplaint } = require('../src/domain/assignment/assignmentEngine');

async function run() {
  await connectDB();

  try {
    const complaint = await Complaint.findById('6a7f21655f6d28f211ca1d43');
    if (!complaint) {
      console.log('Complaint not found');
      return;
    }
    console.log('Testing assignComplaint for:', complaint._id);
    console.log('  wardId:', complaint.wardId);
    console.log('  structured:', complaint.structured);
    const result = await assignComplaint(complaint);
    console.log('Result from assignmentEngine:', result);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
