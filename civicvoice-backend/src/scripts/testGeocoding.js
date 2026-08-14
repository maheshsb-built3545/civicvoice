const { geocodeLocation } = require('../geo/geo.service');

const testCases = [
  {
    name: 'Shivajinagar Pune',
    location: 'Shivajinagar, Pune',
  },
  {
    name: 'MG Road Bangalore',
    location: 'MG Road, Bangalore',
  },
];

(async () => {
  for (const testCase of testCases) {
    const result = await geocodeLocation(testCase.location);
    console.log(`=== ${testCase.name} ===`);
    console.log(JSON.stringify({
      query: testCase.location,
      result,
    }, null, 2));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
