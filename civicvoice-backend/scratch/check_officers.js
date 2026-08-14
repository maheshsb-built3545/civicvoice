const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Officer = require('../src/models/Officer');
const Ward = require('../src/models/Ward');

async function run() {
  await connectDB();

  try {
    const officers = await Officer.find({}).populate('wardIds');
    console.log(`Total officers: ${officers.length}`);
    for (const o of officers) {
      console.log(`Officer: ${o.name} (${o.officerId})`);
      console.log(`  Wards: ${o.wardIds.map(w => `${w.name} (${w._id})`).join(', ')}`);
      console.log(`  Categories: ${o.categories.join(', ')}`);
      console.log(`  Active: ${o.active}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
