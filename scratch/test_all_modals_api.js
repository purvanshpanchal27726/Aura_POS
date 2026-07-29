const http = require('http');

async function testEndpoint(path, token = '') {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data.slice(0, 100) });
      });
    });
    req.on('error', (err) => resolve({ status: 'ERROR', error: err.message }));
    req.end();
  });
}

async function runTests() {
  console.log('--- Testing API Endpoints ---');
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
    '/api/restaurant/menu-items',
    '/api/inventory',
    '/api/employees'
  ];

  for (const ep of endpoints) {
    const res = await testEndpoint(ep);
    console.log(`${ep} -> Status: ${res.status}`);
  }
}

runTests();
