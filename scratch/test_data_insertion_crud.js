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

async function runDataInsertionTests() {
  console.log('=====================================================');
  console.log('🚀 RUNNING END-TO-END DATA INSERTION & CRUD UNIT TESTS');
  console.log('=====================================================\n');

  // Step 1: Login
  console.log('1️⃣ Authenticating SuperAdmin (admin / Admin@123)...');
  const loginRes = await makeRequest('/api/users/login', 'POST', { username: 'admin', password: 'Admin@123' });
  if (loginRes.status !== 200 || !loginRes.body.token) {
    console.error('❌ Login failed:', loginRes.body);
    return;
  }
  const token = loginRes.body.token;
  console.log(`✅ Logged in successfully! (client_id: ${loginRes.body.user.client_id})\n`);

  let passCount = 0;
  let testCount = 0;

  const testInsert = async (testName, path, method, payload) => {
    testCount++;
    console.log(`[TEST ${testCount}] ${testName}...`);
    const res = await makeRequest(path, method, payload, token);
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

  // Test 4: Customer Insertion
  await testInsert('Create Customer (Rahul Sharma - Indian POV)', '/api/customers', 'POST', {
    name: 'Rahul Sharma ' + Date.now().toString().slice(-4),
    phone: '9876543210',
    email: 'rahul.sharma@example.com',
    address: 'A-102 Swastik Complex, SG Highway, Ahmedabad',
    gstin: '24AAACG1234A1Z5'
  });

  // Test 5: Vendor Insertion
  await testInsert('Create Vendor (Gujarat Co-op Milk Federation)', '/api/vendors', 'POST', {
    name: 'Amul Dairy Supplier ' + Date.now().toString().slice(-4),
    phone: '9825012345',
    email: 'supply@amuldairy.com',
    address: 'Anand, Gujarat - 388001',
    gstin: '24AAAAA0000A1Z0'
  });

  // Test 6: Item Insertion
  await testInsert('Create Stock Item (Amul Taaza T-Special 500ml)', '/api/items', 'POST', {
    code: 'SKU-' + Date.now().toString().slice(-5),
    name: 'Amul Taaza 500ml ' + Date.now().toString().slice(-4),
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
    last_name: 'Patel ' + Date.now().toString().slice(-3),
    phone: '9712345678',
    email: 'amit.patel@company.com',
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
    name: 'Vikram Mehta ' + Date.now().toString().slice(-3),
    phone: '9909012345',
    email: 'vikram.m@example.com',
    id_proof_type: 'Aadhaar Card',
    id_proof_number: '1234-5678-9012'
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
}

runDataInsertionTests();
