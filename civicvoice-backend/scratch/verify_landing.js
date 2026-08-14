const createApp = require('../src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function testConfigRoute() {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/citizen/config`);
    console.log('GET /api/citizen/config status:', res.status);
    const data = await res.json();
    console.log('Response body:', data);
    if (res.status === 200 && data.whatsappNumber) {
      console.log('Config route is working properly!');
    } else {
      throw new Error(`Invalid response: ${res.status}`);
    }
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

testConfigRoute();
