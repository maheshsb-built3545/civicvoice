const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { resolveWard } = require('../geo/ward.service');

async function main() {
  await connectDB();

  const cases = [
    { label: 'inside Ward A', lat: 18.515, lng: 73.815 },
    { label: 'inside Ward C', lat: 18.535, lng: 73.835 },
    { label: 'outside all wards', lat: 18.6000, lng: 73.9000 },
  ];

  for (const testCase of cases) {
    const ward = await resolveWard({ lat: testCase.lat, lng: testCase.lng });
    console.log(JSON.stringify({
      label: testCase.label,
      input: { lat: testCase.lat, lng: testCase.lng },
      result: ward ? { id: ward._id.toString(), name: ward.name } : null,
    }));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
