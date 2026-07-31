const http = require('http');

const PORT = 3006;
const BASE_URL = `http://localhost:${PORT}`;
let authToken = '';

function login() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ username: 'Parshav', password: 'Parshav' });
    const req = http.request(`${BASE_URL}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        authToken = json.token;
        resolve(json);
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      'x-client-id': '0',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const req = http.request(`${BASE_URL}${path}`, {
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, body: json, raw: data });
      });
    });
    req.on('error', (err) => resolve({ status: 500, body: { error: err.message } }));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runNegativeTests() {
  console.log('🔑 Authenticating test agent...');
  await login();
  console.log('✅ Authenticated! Token acquired.\n');

  console.log('🧪 Starting Deep Edge-Case & Negative Data Validation Tests...\n');
  let passedCount = 0;
  let totalCount = 0;

  async function assertNegativeTest(testName, path, method, payload, expectedStatus = 400) {
    totalCount++;
    try {
      const res = await makeRequest(path, method, payload);
      if (res.status === expectedStatus) {
        console.log(`[TEST ${totalCount}] ${testName}`);
        console.log(`  └─ ✅ PASSED (Cleanly Rejected with HTTP ${res.status}: "${res.body.error || res.body.message}")`);
        passedCount++;
      } else {
        console.log(`[TEST ${totalCount}] ${testName}`);
        console.log(`  └─ ❌ FAILED (Expected HTTP ${expectedStatus}, got ${res.status}: ${JSON.stringify(res.body)})`);
      }
    } catch (err) {
      console.log(`[TEST ${totalCount}] ${testName}`);
      console.log(`  └─ ❌ FAILED (Execution Error: ${err.message})`);
    }
  }

  // 1. Category API Negative Tests
  await assertNegativeTest('Category API: Blank Name ("")', '/api/categories', 'POST', { name: '' });
  await assertNegativeTest('Category API: Whitespace Name ("   ")', '/api/categories', 'POST', { name: '   ' });

  // 2. Tax API Negative Tests
  await assertNegativeTest('Tax API: Blank Tax Name', '/api/taxes', 'POST', { name: '', percentage: 18 });
  await assertNegativeTest('Tax API: Negative Percentage (-15%)', '/api/taxes', 'POST', { name: 'Bad Tax', percentage: -15 });
  await assertNegativeTest('Tax API: Over 100% Percentage (250%)', '/api/taxes', 'POST', { name: 'Super Tax', percentage: 250 });
  await assertNegativeTest('Tax API: Non-Numeric Percentage ("abc")', '/api/taxes', 'POST', { name: 'Str Tax', percentage: 'abc' });

  // 3. Item API Negative Tests
  await assertNegativeTest('Item API: Blank Item Name', '/api/items', 'POST', { name: '', sales_price: 100 });
  await assertNegativeTest('Item API: Negative Sales Price (-99.00)', '/api/items', 'POST', { name: 'Neg Item', sales_price: -99 });
  await assertNegativeTest('Item API: Non-Numeric Sales Price ("abc")', '/api/items', 'POST', { name: 'NaN Item', sales_price: 'abc' });

  // 4. Customer API Negative Tests
  await assertNegativeTest('Customer API: Blank First Name', '/api/customers', 'POST', { first_name: '', phone: '9876543210' });
  await assertNegativeTest('Customer API: Invalid Phone Number ("call-me-maybe")', '/api/customers', 'POST', { first_name: 'John', phone: 'call-me-maybe' });

  // 5. Vendor API Negative Tests
  await assertNegativeTest('Vendor API: Blank Name and Blank Company', '/api/vendors', 'POST', { first_name: '', company: '' });
  await assertNegativeTest('Vendor API: Invalid Phone Number ("invalid-phone")', '/api/vendors', 'POST', { first_name: 'Acme', phone: 'invalid-phone' });

  // 6. Hotel Room API Negative Tests
  await assertNegativeTest('Hotel API: Blank Room Number', '/api/hotel/rooms', 'POST', { room_no: '', price: 1500 });
  await assertNegativeTest('Hotel API: Negative Room Price (-500.00)', '/api/hotel/rooms', 'POST', { room_no: '999', price: -500 });

  // 7. Sales Invoice API Negative Tests
  await assertNegativeTest('Sales API: Empty Line Items Array ([])', '/api/sales', 'POST', { sales_bill_no: 'INV-TEST', gross: 100, total: 100, items: [] });

  console.log('\n=====================================================');
  console.log(`📊 NEGATIVE UNIT TEST RESULT: ${passedCount}/${totalCount} BAD DATA PAYLOADS CLEANLY REJECTED!`);
  console.log('=====================================================\n');
}

const serverProcess = require('child_process').fork('server.js', { cwd: 'new_user_backend', env: { ...process.env, PORT: '3006' } });

setTimeout(() => {
  runNegativeTests().then(() => {
    serverProcess.kill();
    process.exit(0);
  });
}, 5000);
