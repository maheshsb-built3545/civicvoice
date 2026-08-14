const mongoose = require('mongoose');
const http = require('http');
const config = require('../src/config/env');
const Ward = require('../src/models/Ward');
const User = require('../src/models/User');
const jwt = require('jsonwebtoken');
const createApp = require('../src/app');

(async () => {
  let server;
  try {
    await mongoose.connect(config.mongoUri);
    const wardCount = await Ward.countDocuments({});
    console.log(`Wards count in DB: ${wardCount}`);
    
    const admin = await User.findOne({ role: { $in: ['superadmin', 'admin', 'ward_admin'] } });
    if (!admin) {
      console.log('No admin/superadmin user found in DB');
      return;
    }
    
    console.log(`Found admin user: ${admin.email} (Role: ${admin.role})`);
    const payload = {
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role,
    };
    const token = jwt.sign(payload, config.jwtSecret);
    
    const app = createApp();
    server = app.listen(5099);
    
    const options = {
      hostname: '127.0.0.1',
      port: 5099,
      path: '/api/admin/wards',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('API GET /api/admin/wards status:', res.statusCode);
        console.log('API response body:', data);
        server.close();
        mongoose.disconnect();
      });
    });
    
    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      server.close();
      mongoose.disconnect();
    });
    
    req.end();
  } catch (err) {
    console.error('Error during test:', err);
    if (server) server.close();
    await mongoose.disconnect();
  }
})();
