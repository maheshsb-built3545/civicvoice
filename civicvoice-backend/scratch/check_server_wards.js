const mongoose = require('mongoose');
const http = require('http');
const config = require('../src/config/env');
const Ward = require('../src/models/Ward');

(async () => {
  console.log('--- 🔍 RUNNING SYSTEM WARD DIAGNOSTICS ---');
  try {
    // 1. Check database content directly
    await mongoose.connect(config.mongoUri);
    const dbWards = await Ward.find({}).select('name').lean();
    console.log(`[DB STATUS] Found ${dbWards.length} Wards inside MongoDB.`);
    dbWards.forEach(w => console.log(` - Ward Name: "${w.name}" (ID: ${w._id})`));
    await mongoose.disconnect();

    if (dbWards.length === 0) {
      console.log('\n[REMEDY] Your database currently has 0 wards. Please run "node scripts/seedWards.js" to seed them!');
    }
  } catch (err) {
    console.error('[DB ERROR] Failed to query database directly:', err.message);
  }
})();
