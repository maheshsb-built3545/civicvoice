/**
 * seedWards.js  (src/scripts)
 * -----------------------------------------------------------------------
 * Seeds 5 Kopargaon ward polygons for point-in-polygon resolution.
 * Run: node src/scripts/seedWards.js
 */

const mongoose = require('mongoose');
const Ward = require('../models/Ward');
const connectDB = require('../config/db');

async function seedWards() {
  await connectDB();

  const wards = [
    // ── 1. Sanjivani Campus Ward ─────────────────────────────────────────
    // Covers Sanjivani College of Engineering, Saidham, Model Colony.
    // Primary demo anchor – the fallback resolver targets this ward.
    {
      name: 'Sanjivani Campus Ward',
      marathiName: 'संजीवनी कॅम्पस प्रभाग',
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [74.485, 19.870],
          [74.500, 19.870],
          [74.500, 19.890],
          [74.485, 19.890],
          [74.485, 19.870],
        ]],
      },
      defaultDepartmentMap: {
        roads: 'Roads & Infrastructure – Kopargaon',
        sanitation: 'Sanitation – Kopargaon',
      },
    },

    // ── 2. Mahadevnagar ──────────────────────────────────────────────────
    // South / Central zone of Kopargaon.
    {
      name: 'Mahadevnagar',
      marathiName: 'महादेवनगर',
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [74.462, 19.855],
          [74.485, 19.855],
          [74.485, 19.872],
          [74.462, 19.872],
          [74.462, 19.855],
        ]],
      },
      defaultDepartmentMap: {
        roads: 'Roads & Infrastructure – Kopargaon',
        sanitation: 'Sanitation – Kopargaon',
      },
    },

    // ── 3. Sainagar ───────────────────────────────────────────────────────
    // West zone of Kopargaon.
    {
      name: 'Sainagar',
      marathiName: 'साईनगर',
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [74.440, 19.872],
          [74.462, 19.872],
          [74.462, 19.892],
          [74.440, 19.892],
          [74.440, 19.872],
        ]],
      },
      defaultDepartmentMap: {
        water_supply: 'Water Supply – Kopargaon',
        sanitation: 'Sanitation – Kopargaon',
      },
    },

    // ── 4. Singnapur ─────────────────────────────────────────────────────
    // East zone of Kopargaon.
    {
      name: 'Singnapur',
      marathiName: 'शिंगणापूर',
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [74.500, 19.870],
          [74.520, 19.870],
          [74.520, 19.892],
          [74.500, 19.892],
          [74.500, 19.870],
        ]],
      },
      defaultDepartmentMap: {
        roads: 'Roads & Infrastructure – Kopargaon',
        electricity: 'Electricity – Kopargaon',
      },
    },

    // ── 5. Kojagiri ──────────────────────────────────────────────────────
    // North / West zone of Kopargaon.
    {
      name: 'Kojagiri',
      marathiName: 'कोजागिरी',
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [74.440, 19.892],
          [74.500, 19.892],
          [74.500, 19.912],
          [74.440, 19.912],
          [74.440, 19.892],
        ]],
      },
      defaultDepartmentMap: {
        sanitation: 'Sanitation – Kopargaon',
        water_supply: 'Water Supply – Kopargaon',
      },
    },
  ];

  await Ward.deleteMany({});
  await Ward.insertMany(wards);

  console.log(`✅ Seeded ${wards.length} Kopargaon ward polygons:`);
  wards.forEach((w) => console.log(`   • ${w.name}`));

  await mongoose.disconnect();
}

seedWards().catch((err) => {
  console.error(err);
  process.exit(1);
});
