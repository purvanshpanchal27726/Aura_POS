const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, '../new_user_backend');
const express = require(path.join(backendDir, 'node_modules/express'));
const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));

dotenv.config({ path: path.join(backendDir, '.env') });

const db = require(path.join(backendDir, 'db'));
const authMiddleware = require(path.join(backendDir, 'authMiddleware'));

const app = express();
app.use(express.json());

app.use('/api', authMiddleware);

const userRoutes = require(path.join(backendDir, 'UserAPI'));
app.use('/api/users', userRoutes);
const roleRoutes = require(path.join(backendDir, 'RoleAPI'));
app.use('/api/roles', roleRoutes);
const customerRoutes = require(path.join(backendDir, 'CustomerAPI'));
app.use('/api/customers', customerRoutes);
const unitRoutes = require(path.join(backendDir, 'UnitAPI'));
app.use('/api/units', unitRoutes);
const taxRoutes = require(path.join(backendDir, 'TaxAPI'));
app.use('/api/taxes', taxRoutes);
const categoryRoutes = require(path.join(backendDir, 'CategoryAPI'));
app.use('/api/categories', categoryRoutes);
const itemRoutes = require(path.join(backendDir, 'ItemAPI'));
app.use('/api/items', itemRoutes);
const vendorRoutes = require(path.join(backendDir, 'VendorAPI'));
app.use('/api/vendors', vendorRoutes);
const employeeRoutes = require(path.join(backendDir, 'EmployeeAPI'));
app.use('/api/employees', employeeRoutes);
const hotelRoutes = require(path.join(backendDir, 'HotelAPI'));
app.use('/api/hotel', hotelRoutes);
const restaurantRoutes = require(path.join(backendDir, 'RestaurantAPI'));
app.use('/api/restaurant', restaurantRoutes);

const server = app.listen(3006, async () => {
  console.log('Duplicate Prevention Test Server running on port 3006');

  const http = require('http');

  function makeReq(path, method = 'GET', body = null, token = '') {
    return new Promise((resolve) => {
      const dataString = body ? JSON.stringify(body) : '';
      const options = {
        hostname: 'localhost',
        port: 3006,
        path: path,
        method: method,
        headers: { 'Content-Type': 'application/json' }
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

  console.log('1️⃣ Authenticating SuperAdmin...');
  const loginRes = await makeReq('/api/users/login', 'POST', { username: 'admin', password: 'Admin@123' });
  if (loginRes.status !== 200 || !loginRes.body.token) {
    console.error('❌ Login failed:', loginRes.body);
    server.close();
    process.exit(1);
  }
  const token = loginRes.body.token;
  console.log(`✅ Logged in successfully!\n`);

  console.log('=====================================================');
  console.log('🧪 VERIFYING DUPLICATE PREVENTION (ANTI-REPETITION) TESTS');
  console.log('=====================================================\n');

  let passCount = 0;
  let testCount = 0;

  const testDuplicate = async (testName, path, payload) => {
    testCount++;
    console.log(`[TEST ${testCount}] ${testName}...`);
    // Step 1: Insert original record
    const res1 = await makeReq(path, 'POST', payload, token);
    
    // Step 2: Attempt to insert duplicate payload
    const res2 = await makeReq(path, 'POST', payload, token);

    if (res2.status === 400 || res2.status === 409) {
      passCount++;
      console.log(`  └─ ✅ PASSED! Server rejected duplicate with Status ${res2.status}: "${res2.body.error || res2.body.message}"`);
    } else {
      console.log(`  └─ ❌ FAILED! Server allowed duplicate (Status ${res2.status})`);
    }
  };

  const ts = Date.now().toString();

  // Test 1: Category Duplicate Check
  await testDuplicate('Duplicate Category Prevention', '/api/categories', {
    name: 'Unique Bakery Category ' + ts,
    description: 'Fresh bread and pastries'
  });

  // Test 2: Unit Duplicate Check
  await testDuplicate('Duplicate Unit Prevention', '/api/units', {
    name: 'Unique Box Unit ' + ts,
    short_code: 'bx-' + ts.slice(-4)
  });

  // Test 3: Customer Duplicate Phone Prevention
  await testDuplicate('Duplicate Customer Phone Prevention', '/api/customers', {
    first_name: 'Manish',
    last_name: 'Shah ' + ts.slice(-4),
    phone_1: '91' + ts.slice(-8),
    email_1: 'manish.' + ts.slice(-4) + '@example.com',
    address_1: 'C-304 Venus Park, Satellite',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India'
  });

  // Test 4: Vendor Duplicate Prevention
  await testDuplicate('Duplicate Vendor Name/Phone Prevention', '/api/vendors', {
    first_name: 'Surat Textiles ' + ts.slice(-4),
    last_name: 'Supplier',
    phone_1: '92' + ts.slice(-8),
    address_1: 'Ring Road Market, Surat',
    city: 'Surat',
    country: 'India'
  });

  // Test 5: Item Duplicate Name Prevention
  await testDuplicate('Duplicate Item Name Prevention', '/api/items', {
    code: 'DUP-SKU-' + ts.slice(-4),
    name: 'Basmati Rice 5kg Pack ' + ts.slice(-4),
    sales_price: 450.00,
    purchase_price: 380.00
  });

  // Test 6: Employee Duplicate Phone Prevention
  await testDuplicate('Duplicate Employee Phone Prevention', '/api/employees', {
    first_name: 'Ketan',
    last_name: 'Joshi ' + ts.slice(-3),
    phone: '93' + ts.slice(-8),
    email: 'ketan.j' + ts.slice(-4) + '@company.com',
    designation: 'Billing Executive',
    salary: 22000.00
  });

  // Test 7: Hotel Room Number Duplicate Prevention
  await testDuplicate('Duplicate Hotel Room Number Prevention', '/api/hotel/rooms', {
    room_no: '201-' + ts.slice(-4),
    room_type: 'Executive Room',
    price_per_night: 3500.00
  });

  // Test 8: Hotel Guest Phone Duplicate Prevention
  await testDuplicate('Duplicate Hotel Guest Phone Prevention', '/api/hotel/guests', {
    name: 'Pooja Trivedi ' + ts.slice(-3),
    phone: '94' + ts.slice(-8),
    id_proof_type: 'Driving License'
  });

  // Test 9: Restaurant Table Number Duplicate Prevention
  await testDuplicate('Duplicate Restaurant Table Number Prevention', '/api/restaurant/tables', {
    table_no: 'T-99-' + ts.slice(-4),
    capacity: 6
  });

  // Test 10: Restaurant Menu Category Duplicate Prevention
  await testDuplicate('Duplicate Restaurant Menu Category Prevention', '/api/restaurant/menu/categories', {
    name: 'Beverages & Mocktails ' + ts.slice(-4),
    display_order: 2
  });

  console.log('\n=====================================================');
  console.log(`📊 DUPLICATE PREVENTION RESULT: ${passCount}/${testCount} TESTS PASSED!`);
  console.log('=====================================================');

  server.close();
  process.exit(0);
});
