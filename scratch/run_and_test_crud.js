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

const server = app.listen(3005, async () => {
  console.log('Test Server running on port 3005');

  const http = require('http');

  function makeReq(path, method = 'GET', body = null, token = '') {
    return new Promise((resolve) => {
      const dataString = body ? JSON.stringify(body) : '';
      const options = {
        hostname: 'localhost',
        port: 3005,
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

  console.log('1️⃣ Authenticating SuperAdmin (admin / Admin@123)...');
  const loginRes = await makeReq('/api/users/login', 'POST', { username: 'admin', password: 'Admin@123' });
  if (loginRes.status !== 200 || !loginRes.body.token) {
    console.error('❌ Login failed:', loginRes.body);
    server.close();
    process.exit(1);
  }
  const token = loginRes.body.token;
  console.log(`✅ Logged in successfully! (user_id: ${loginRes.body.user.user_id}, client_id: ${loginRes.body.user.client_id})\n`);

  let passCount = 0;
  let testCount = 0;

  const testInsert = async (testName, path, method, payload) => {
    testCount++;
    console.log(`[TEST ${testCount}] ${testName}...`);
    const res = await makeReq(path, method, payload, token);
    if (res.status === 200 || res.status === 201) {
      passCount++;
      const idStr = res.body ? (res.body.item_id || res.body.customer_id || res.body.vendor_id || res.body.category_id || res.body.employee_id || res.body.room_id || res.body.guest_id || res.body.table_id || res.body.id || 'OK') : 'OK';
      console.log(`  └─ ✅ PASSED (Status ${res.status}, Created Record ID: ${idStr})`);
    } else {
      console.log(`  └─ ❌ FAILED (Status ${res.status}):`, JSON.stringify(res.body));
    }
  };

  // Test 1: Category Insertion
  await testInsert('Create Category (Dairy & Beverages)', '/api/categories', 'POST', {
    name: 'Dairy & Beverages ' + Date.now(),
    description: 'Fresh milk, curd, and beverages'
  });

  // Test 2: Unit Insertion
  await testInsert('Create Unit (Pouch / Pkg)', '/api/units', 'POST', {
    name: 'Pouch ' + Date.now(),
    short_code: 'pch'
  });

  // Test 3: Tax Insertion
  await testInsert('Create Tax (GST 18%)', '/api/taxes', 'POST', {
    name: 'GST 18% ' + Date.now(),
    rate: 18.00
  });

  // Test 4: Customer Insertion (Indian POS Schema)
  const timestamp = Date.now().toString();
  await testInsert('Create Customer (Rahul Sharma - Indian POV)', '/api/customers', 'POST', {
    first_name: 'Rahul',
    last_name: 'Sharma ' + timestamp.slice(-4),
    phone_1: '98' + timestamp.slice(-8),
    email_1: 'rahul.' + timestamp.slice(-4) + '@example.com',
    address_1: 'A-102 Swastik Complex, SG Highway',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    gstin: '24AAACG1234A1Z5'
  });

  // Test 5: Vendor Insertion (Indian POS Schema)
  await testInsert('Create Vendor (Gujarat Co-op Milk Federation)', '/api/vendors', 'POST', {
    name: 'Amul Dairy Supplier ' + timestamp.slice(-4),
    company_name: 'Gujarat Co-op Milk Federation Ltd',
    phone: '97' + timestamp.slice(-8),
    email: 'supply' + timestamp.slice(-4) + '@amuldairy.com',
    address: 'Anand, Gujarat - 388001',
    gstin: '24AAAAA0000A1Z0'
  });

  // Test 6: Item Insertion
  await testInsert('Create Stock Item (Amul Taaza T-Special 500ml)', '/api/items', 'POST', {
    code: 'SKU-' + timestamp.slice(-5),
    name: 'Amul Taaza 500ml ' + timestamp.slice(-4),
    short_name: 'Amul Milk',
    sales_price: 34.00,
    purchase_price: 30.00,
    base_quantity: 100,
    visible: 1,
    active: 1
  });

  // Test 7: Employee Insertion
  await testInsert('Create Employee (Amit Patel - Manager)', '/api/employees', 'POST', {
    first_name: 'Amit',
    last_name: 'Patel ' + timestamp.slice(-3),
    phone: '96' + timestamp.slice(-8),
    email: 'amit.patel' + timestamp.slice(-4) + '@company.com',
    designation: 'Store Manager',
    department: 'Sales & Inventory',
    salary: 35000.00,
    join_date: '2026-01-15'
  });

  // Test 8: Hotel Room Insertion
  await testInsert('Create Hotel Room (Room 105 Deluxe)', '/api/hotel/rooms', 'POST', {
    room_no: '105-' + Date.now().toString().slice(-3),
    room_type: 'Deluxe AC Suite',
    price_per_night: 2800.00,
    status: 'available'
  });

  // Test 9: Hotel Guest Insertion
  await testInsert('Create Hotel Guest (Vikram Mehta)', '/api/hotel/guests', 'POST', {
    name: 'Vikram Mehta ' + timestamp.slice(-3),
    phone: '95' + timestamp.slice(-8),
    email: 'vikram.' + timestamp.slice(-4) + '@example.com',
    id_proof_type: 'Aadhaar Card',
    id_proof_number: '1234-5678-' + timestamp.slice(-4)
  });

  // Test 10: Restaurant Table Insertion
  await testInsert('Create Restaurant Table (Table T-12)', '/api/restaurant/tables', 'POST', {
    table_no: 'T12-' + Date.now().toString().slice(-3),
    capacity: 4
  });

  // Test 11: Restaurant Menu Category Insertion
  await testInsert('Create Restaurant Menu Category (North Indian Thali)', '/api/restaurant/menu/categories', 'POST', {
    name: 'Indian Special Thali ' + Date.now().toString().slice(-3),
    display_order: 1
  });

  console.log('\n=====================================================');
  console.log(`📊 FINAL UNIT TEST RESULT: ${passCount}/${testCount} DATA INSERTIONS PASSED!`);
  console.log('=====================================================');

  server.close();
  process.exit(0);
});
