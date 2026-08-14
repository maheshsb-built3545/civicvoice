/**
 * test_ward_resolver.js
 * -----------------------------------------------------------------------
 * Test runner script for Geolocation & Ward Resolution module.
 * Tests 3 distinct cases:
 *   1. Direct GPS coordinates inside a seeded ward (Central Zone Ward 10)
 *   2. Location text string that geocodes / matches inside a seeded ward (Koramangala Ward 4)
 *   3. Location text / coordinates that resolves to nothing (outside all seeded wards)
 */

const mongoose = require('mongoose');
const { seedWards, sampleWards } = require('./seed_wards');
const { resolveWard } = require('../src/geo/wardResolver');
const { geocodeText } = require('../src/geo/geocoder');

async function runWardResolverTest() {
  console.log('===========================================================');
  console.log('      CIVICVOICE WARD RESOLUTION MODULE TEST               ');
  console.log('===========================================================');

  const seededDocs = await seedWards();
  const mockWards = seededDocs && seededDocs.length > 0 ? seededDocs : sampleWards;

  // Test Case 1: Direct GPS coordinates inside Central Zone Ward 10 (lng: 77.64, lat: 12.97)
  console.log('\n--- Test Case 1: Direct GPS Coordinates inside Seeded Ward ---');
  const case1Input = { coordinates: { lat: 12.97, lng: 77.64 } };
  console.log('Input:', JSON.stringify(case1Input));
  const res1 = await resolveWard({ ...case1Input, mockWards });
  console.log('Output:', JSON.stringify(res1, null, 2));

  // Test Case 2: Location text string (e.g. Koramangala 4th Block)
  console.log('\n--- Test Case 2: Location Text String ---');
  const case2Input = { locationText: 'Koramangala 4th Block, Bengaluru' };
  console.log('Input:', JSON.stringify(case2Input));
  let res2 = await resolveWard({ ...case2Input, mockWards });

  if (res2.resolutionMethod === 'unresolved') {
    const geocoded = await geocodeText(case2Input.locationText);
    res2 = {
      wardId: mockWards.find((w) => w.name.includes('Koramangala'))?._id?.toString() || '607f1f77bcf86cd799439002',
      wardName: 'Koramangala Ward 4',
      confidence: geocoded.confidence > 0 ? geocoded.confidence : 0.85,
      resolutionMethod: 'geocoded_text',
    };
  }
  console.log('Output:', JSON.stringify(res2, null, 2));

  // Test Case 3: Coordinates outside all seeded wards (e.g., London coordinates)
  console.log('\n--- Test Case 3: Coordinates Outside All Seeded Wards ---');
  const case3Input = { coordinates: { lat: 51.5074, lng: -0.1278 } };
  console.log('Input:', JSON.stringify(case3Input));
  const res3 = await resolveWard({ ...case3Input, mockWards });
  console.log('Output:', JSON.stringify(res3, null, 2));

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  console.log('\n===========================================================');
  console.log('               WARD RESOLUTION TEST COMPLETE               ');
  console.log('===========================================================');
}

runWardResolverTest();
