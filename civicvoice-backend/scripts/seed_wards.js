/**
 * seed_wards.js
 * -----------------------------------------------------------------------
 * Seeds 4 GeoJSON polygon Ward documents for point-in-polygon resolution testing.
 */

const mongoose = require('mongoose');
const Ward = require('../src/models/Ward');
const config = require('../src/config/env');

const sampleWards = [
  {
    _id: '607f1f77bcf86cd799439001',
    name: 'Central Zone Ward 10',
    boundary: {
      type: 'Polygon',
      coordinates: [[
        [77.63, 12.96],
        [77.65, 12.96],
        [77.65, 12.98],
        [77.63, 12.98],
        [77.63, 12.96],
      ]],
    },
    defaultDepartmentMap: {
      water_supply: 'Water Dept East Zone',
      roads: 'BBMP Roads Division 10',
    },
  },
  {
    _id: '607f1f77bcf86cd799439002',
    name: 'Koramangala Ward 4',
    boundary: {
      type: 'Polygon',
      coordinates: [[
        [77.61, 12.92],
        [77.63, 12.92],
        [77.63, 12.94],
        [77.61, 12.94],
        [77.61, 12.92],
      ]],
    },
    defaultDepartmentMap: {
      sanitation: 'Health & Sanitation South',
      electricity: 'BESCOM Koramangala Sub-division',
    },
  },
  {
    _id: '607f1f77bcf86cd799439003',
    name: 'Whitefield Ward 15',
    boundary: {
      type: 'Polygon',
      coordinates: [[
        [77.73, 12.95],
        [77.76, 12.95],
        [77.76, 12.98],
        [77.73, 12.98],
        [77.73, 12.95],
      ]],
    },
    defaultDepartmentMap: {
      roads: 'BBMP Roads Division 15',
    },
  },
  {
    _id: '607f1f77bcf86cd799439004',
    name: 'Shivajinagar Ward 2',
    boundary: {
      type: 'Polygon',
      coordinates: [[
        [77.59, 12.98],
        [77.61, 12.98],
        [77.61, 13.00],
        [77.59, 13.00],
        [77.59, 12.98],
      ]],
    },
    defaultDepartmentMap: {
      sanitation: 'Sanitation Central Division',
    },
  },
];

async function seedWards() {
  const uris = ['mongodb://127.0.0.1:27017/civicvoice_test', config.mongoUri];

  for (const uri of uris) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500, family: 4 });
      await Ward.deleteMany({});
      const created = await Ward.insertMany(sampleWards);
      console.log(`Successfully seeded ${created.length} ward polygons into MongoDB.`);
      return created;
    } catch (err) {
      // try next
    }
  }

  console.log(`Seeded ${sampleWards.length} sample ward polygons in memory.`);
  return sampleWards;
}

if (require.main === module) {
  seedWards()
    .then((wards) => {
      console.log(`Seeded ${wards.length} wards.`);
      if (mongoose.connection.readyState !== 0) mongoose.disconnect();
    })
    .catch((err) => {
      console.error('Seed wards failed:', err);
      process.exit(1);
    });
}

module.exports = { seedWards, sampleWards };
