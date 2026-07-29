const http = require('http');

function makeRequest(path, method = 'GET', body = null, token = '') {
  return new Promise((resolve) => {
    const dataString = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (dataString) options.headers['Content-Length'] = Buffer.byteLength(dataString);
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', err => resolve({ status: 'ERROR', error: err.message }));
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runAuthTests() {
  console.log('--- Logging in as admin ---');
  let loginRes = await makeRequest('/api/users/login', 'POST', { username: 'admin', password: 'Admin@123' });
  console.log(`Login Status: ${loginRes.status}`);

  const token = loginRes.body ? loginRes.body.token : null;
  if (!token) {
    console.error('Login response:', loginRes.body);
    return;
  }
  console.log('✅ Authentication token obtained!');

  console.log('\n--- Unit Testing Authenticated API Endpoints ---');
  const endpoints = [
    '/api/users',
    '/api/roles',
    '/api/customers',
    '/api/vendors',
    '/api/items',
    '/api/categories',
    '/api/units',
    '/api/taxes',
    '/api/sales',
    '/api/purchase',
    '/api/hotel/rooms',
    '/api/hotel/guests',
    '/api/hotel/bookings',
    '/api/restaurant/tables',
    '/api/restaurant/menu/items',
    '/api/inventory',
    '/api/employees'
  ];

  let passCount = 0;
  for (const ep of endpoints) {
    const res = await makeRequest(ep, 'GET', null, token);
    const count = Array.isArray(res.body) ? res.body.length : (typeof res.body === 'object' ? Object.keys(res.body).length : 0);
    const pass = (res.status === 200);
    if (pass) passCount++;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${ep} -> Status: ${res.status} | Data Count: ${count}`);
  }

  console.log(`\n===================================`);
  console.log(`Unit Test Results: ${passCount}/${endpoints.length} Endpoints Passed!`);
  console.log(`===================================`);
}

runAuthTests();
