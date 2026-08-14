/**
 * seedOfficers.js
 * -----------------------------------------------------------------------
 * Seeds 5 demo officers — one for each Kopargaon ward.
 * Must run AFTER seedWards.js.
 * Run: node src/scripts/seedOfficers.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Ward = require('../models/Ward');
const Officer = require('../models/Officer');
const AssignmentRule = require('../models/AssignmentRule');
const connectDB = require('../config/db');

const KOPARGAON_WARDS = [
  'Sanjivani Campus Ward',
  'Mahadevnagar',
  'Sainagar',
  'Singnapur',
  'Kojagiri',
];

async function seedOfficers() {
  await connectDB();

  try {
    const wards = await Ward.find({ name: { $in: KOPARGAON_WARDS } });
    const wardsByName = new Map(wards.map((w) => [w.name, w]));

    const missing = KOPARGAON_WARDS.filter((n) => !wardsByName.has(n));
    if (missing.length > 0) {
      throw new Error(
        `These wards must be seeded before officers: ${missing.join(', ')}\n` +
        'Run: node src/scripts/seedWards.js'
      );
    }

    await AssignmentRule.deleteMany({});
    await Officer.deleteMany({});

    // Hash password for all officers
    const plainPassword = 'Demo@123';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const [anita, ravi, priya, suresh, kavita] = await Officer.insertMany([
      {
        name: 'Shanaya Deshmukh',
        officerId: 'OFF-1001',
        password: passwordHash,
        email: 'shanaya.deshmukh@kopargaon.gov.in',
        department: 'Roads and Infrastructure',
        contact: 'shanaya.deshmukh@kopargaon.gov.in',
        wardIds: [wardsByName.get('Sanjivani Campus Ward')._id],
        categories: ['roads'],
        active: true,
      },
      {
        name: 'Akaay Kulkarni',
        officerId: 'OFF-1002',
        password: passwordHash,
        email: 'akaay.kulkarni@kopargaon.gov.in',
        department: 'Sanitation',
        contact: 'akaay.kulkarni@kopargaon.gov.in',
        wardIds: [wardsByName.get('Mahadevnagar')._id],
        categories: ['sanitation'],
        active: true,
      },
      {
        name: 'Ananya Shinde',
        officerId: 'OFF-1003',
        password: passwordHash,
        email: 'ananya.shinde@kopargaon.gov.in',
        department: 'Water Supply',
        contact: 'ananya.shinde@kopargaon.gov.in',
        wardIds: [wardsByName.get('Sainagar')._id],
        categories: ['water_supply'],
        active: true,
      },
      {
        name: 'Vihaan Patil',
        officerId: 'OFF-1004',
        password: passwordHash,
        email: 'vihaan.patil@kopargaon.gov.in',
        department: 'Roads and Infrastructure',
        contact: 'vihaan.patil@kopargaon.gov.in',
        wardIds: [wardsByName.get('Singnapur')._id],
        categories: ['roads', 'electricity'],
        active: true,
      },
      {
        name: 'Vamika More',
        officerId: 'OFF-1005',
        password: passwordHash,
        email: 'vamika.more@kopargaon.gov.in',
        department: 'Sanitation',
        contact: 'vamika.more@kopargaon.gov.in',
        wardIds: [wardsByName.get('Kojagiri')._id],
        categories: ['sanitation', 'water_supply'],
        active: true,
      },
    ]);

    await AssignmentRule.insertMany([
      {
        wardId: wardsByName.get('Sanjivani Campus Ward')._id,
        category: 'roads',
        officerId: anita._id,
        priority: 1,
      },
      {
        wardId: wardsByName.get('Mahadevnagar')._id,
        category: 'sanitation',
        officerId: ravi._id,
        priority: 1,
      },
      {
        wardId: wardsByName.get('Sainagar')._id,
        category: 'water_supply',
        officerId: priya._id,
        priority: 1,
      },
      {
        wardId: wardsByName.get('Singnapur')._id,
        category: 'roads',
        officerId: suresh._id,
        priority: 1,
      },
      {
        wardId: wardsByName.get('Kojagiri')._id,
        category: 'sanitation',
        officerId: kavita._id,
        priority: 1,
      },
    ]);

    console.log('✅ Seeded 5 Kopargaon officers and assignment rules:');
    console.log('   • Shanaya Deshmukh (OFF-1001) → Sanjivani Campus Ward (Roads)');
    console.log('   • Akaay Kulkarni   (OFF-1002) → Mahadevnagar (Sanitation)');
    console.log('   • Ananya Shinde    (OFF-1003) → Sainagar (Water Supply)');
    console.log('   • Vihaan Patil     (OFF-1004) → Singnapur (Roads/Electricity)');
    console.log('   • Vamika More      (OFF-1005) → Kojagiri (Sanitation/Water)');
    console.log(`\nAll officers configured with the default password: "${plainPassword}"`);
  } finally {
    await mongoose.disconnect();
  }
}

seedOfficers().catch((err) => {
  console.error(err);
  process.exit(1);
});
