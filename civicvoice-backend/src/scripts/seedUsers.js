const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Officer = require('../models/Officer');
const User = require('../models/User');

async function seedUsers() {
  await connectDB();

  try {
    const anita = await Officer.findOne({ name: 'Shanaya Deshmukh' });
    if (!anita) {
      throw new Error('Shanaya Deshmukh officer not found. Seed officers first.');
    }

    const adminPassword = 'password123';
    const anitaPassword = 'anita-test-password';

    // Remove existing admins and Anita
    await User.deleteMany({ role: 'admin' });
    await User.deleteMany({ username: { $in: ['anita', 'shanaya'] } });

    const adminHash = await bcrypt.hash(adminPassword, 10);
    const anitaHash = await bcrypt.hash(anitaPassword, 10);

    await User.create([
      { 
        name: 'Super Admin', 
        email: 'admin@civicvoice.gov', 
        username: 'admin', 
        passwordHash: adminHash, 
        role: 'admin' 
      },
      { 
        name: 'Shanaya Deshmukh', 
        email: 'shanaya@civicvoice.org', 
        username: 'shanaya', 
        passwordHash: anitaHash, 
        role: 'officer', 
        officerId: anita._id 
      },
    ]);

    console.log('Seeded users:');
    console.log(' - admin -> admin@civicvoice.gov /', adminPassword);
    console.log(' - shanaya ->', anitaPassword);
  } finally {
    await mongoose.disconnect();
  }
}

seedUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
