const mongoose = require('mongoose');
const config = require('../src/config/env');
const Ward = require('../src/models/Ward');

(async () => {
  try {
    await mongoose.connect(config.mongoUri);
    const wards = await Ward.find({});
    console.log(`Found ${wards.length} wards:`);
    wards.forEach(w => console.log(`- ${w.name} (${w._id})`));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();
