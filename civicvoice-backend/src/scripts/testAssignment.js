const mongoose = require('mongoose');
const Ward = require('../models/Ward');
const connectDB = require('../config/db');
const { assignOfficer } = require('../domain/assignment/assignment.service');

async function testAssignment() {
  await connectDB();

  try {
    const wardA = await Ward.findOne({ name: 'Ward C' });

    if (!wardA) {
      throw new Error('Ward C was not found');
    }

    const exactMatch = await assignOfficer({ wardId: wardA._id, category: 'roads' });
    console.log('Ward C / roads:', exactMatch);

    const fallbackMatch = await assignOfficer({ wardId: wardA._id, category: 'streetlights' });
    console.log('Ward C / streetlights:', fallbackMatch);

    const noMatch = await assignOfficer({
      wardId: new mongoose.Types.ObjectId(),
      category: 'roads',
    });
    console.log('Unknown ward / roads:', noMatch);
  } finally {
    await mongoose.disconnect();
  }

  process.exit(0);
}

testAssignment().catch((err) => {
  console.error(err);
  process.exit(1);
});
