const fs = require('fs');
const path = require('path');
const createApp = require('../src/app');

async function verify() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const testFilename = `test_static_${Date.now()}.txt`;
  const testFilepath = path.join(uploadsDir, testFilename);
  const testContent = 'Verification content for Express uploads static serving.';
  fs.writeFileSync(testFilepath, testContent);

  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    console.log(`Requesting test file statically from http://127.0.0.1:${port}/uploads/${testFilename}`);
    const res = await fetch(`http://127.0.0.1:${port}/uploads/${testFilename}`);
    console.log(`HTTP Status: ${res.status}`);
    const body = await res.text();
    console.log(`Served content: "${body}"`);

    if (res.status === 200 && body === testContent) {
      console.log('✅ TEST PASSED: Static uploads folder is successfully served by Express!');
    } else {
      console.error('❌ TEST FAILED: Serving static folder returned wrong status or content.');
    }
  } catch (err) {
    console.error('❌ TEST FAILED with error:', err.message);
  } finally {
    // Cleanup test file
    if (fs.existsSync(testFilepath)) {
      fs.unlinkSync(testFilepath);
    }
    server.close();
    console.log('Teardown complete.');
  }
}

verify();
