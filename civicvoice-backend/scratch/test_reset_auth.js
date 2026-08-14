const http = require('http');
const createApp = require('../src/app');

(async () => {
  let server;
  try {
    const app = createApp();
    server = app.listen(5098);
    
    const postData = JSON.stringify({ officerId: 'OFF-1234' });
    
    const options = {
      hostname: '127.0.0.1',
      port: 5098,
      path: '/api/officer/request-password-reset',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('--- TEST RESULT ---');
        console.log('API Status code:', res.statusCode);
        console.log('API Response body:', data);
        server.close();
      });
    });
    
    req.on('error', (e) => {
      console.error(`Request error: ${e.message}`);
      server.close();
    });
    
    req.write(postData);
    req.end();
  } catch (err) {
    console.error('Test startup error:', err);
    if (server) server.close();
  }
})();
