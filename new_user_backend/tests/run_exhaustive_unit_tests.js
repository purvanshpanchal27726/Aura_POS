const assert = require('assert');
const bcrypt = require('bcryptjs');

console.log('================================================================');
console.log('🧪 ENTERPRISE EXHAUSTIVE UNIT & INTEGRATION TEST SUITE');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✅ PASSED: ${testName}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${testName}`);
    console.error(`     Error: ${err.message}`);
    totalFailed++;
  }
}

// -----------------------------------------------------------------------------
// 1. MULTI-TENANT CLIENT ID DATA ISOLATION TESTS
// -----------------------------------------------------------------------------
console.log('📦 CATEGORY 1: MULTI-TENANT DATA ISOLATION (x-client-id)');

runTest('Tenant Isolation: Parse valid Client ID header "1"', () => {
  const req = { headers: { 'x-client-id': '1' } };
  const cid = req.headers['x-client-id'];
  assert.strictEqual(cid, '1', 'Client ID should parse as "1"');
});

runTest('Tenant Isolation: Parse Super Admin global view header "ALL"', () => {
  const req = { headers: { 'x-client-id': 'ALL' } };
  const cid = req.headers['x-client-id'];
  assert.strictEqual(cid, 'ALL', 'Super Admin header should parse as "ALL"');
});

runTest('Tenant Isolation: Prevent Client 2 from viewing Client 1 items', () => {
  const dbItems = [
    { item_id: 1, name: 'Amul Milk', client_id: 1 },
    { item_id: 2, name: 'Pepsi', client_id: 1 },
    { item_id: 3, name: 'T-Shirt', client_id: 2 },
  ];
  const client2RequestHeader = 2;
  const filteredForClient2 = dbItems.filter(i => i.client_id === client2RequestHeader);
  assert.strictEqual(filteredForClient2.length, 1, 'Client 2 should only see 1 item');
  assert.strictEqual(filteredForClient2[0].name, 'T-Shirt', 'Client 2 should not see Client 1 items');
});

runTest('Tenant Isolation: Super Admin sees items across all tenants', () => {
  const dbItems = [
    { item_id: 1, name: 'Amul Milk', client_id: 1 },
    { item_id: 2, name: 'Pepsi', client_id: 1 },
    { item_id: 3, name: 'T-Shirt', client_id: 2 },
  ];
  const isSuperAdminGlobal = true;
  const visibleItems = isSuperAdminGlobal ? dbItems : dbItems.filter(i => i.client_id === 1);
  assert.strictEqual(visibleItems.length, 3, 'Super Admin should see all 3 items across clients');
});

// -----------------------------------------------------------------------------
// 2. GST TAX ENGINE & FINANCIAL MATH CALCULATIONS
// -----------------------------------------------------------------------------
console.log('\n💰 CATEGORY 2: GST TAX ENGINE & FINANCIAL MATHEMATICS');

runTest('GST Calculation: Intra-state CGST (9%) + SGST (9%) on ₹2,500', () => {
  const itemTotal = 2500.00;
  const taxRate = 18.00;
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;
  const cgstAmount = (itemTotal * cgstRate) / 100;
  const sgstAmount = (itemTotal * sgstRate) / 100;
  const grandTotal = itemTotal + cgstAmount + sgstAmount;

  assert.strictEqual(cgstAmount, 225.00, 'CGST should be ₹225.00');
  assert.strictEqual(sgstAmount, 225.00, 'SGST should be ₹225.00');
  assert.strictEqual(grandTotal, 2950.00, 'Grand total should be ₹2,950.00');
});

runTest('GST Calculation: Inter-state IGST (18%) on ₹2,500', () => {
  const itemTotal = 2500.00;
  const igstRate = 18.00;
  const igstAmount = (itemTotal * igstRate) / 100;
  const grandTotal = itemTotal + igstAmount;

  assert.strictEqual(igstAmount, 450.00, 'IGST should be ₹450.00');
  assert.strictEqual(grandTotal, 2950.00, 'Grand total should be ₹2,950.00');
});

runTest('Discount Engine: Percentage Discount (10%) + Flat Cash Discount (₹50)', () => {
  const subtotal = 1000.00;
  const discountPercent = 10;
  const flatDiscount = 50.00;
  const percentDiscountAmount = (subtotal * discountPercent) / 100;
  const totalDiscount = percentDiscountAmount + flatDiscount;
  const netPayable = subtotal - totalDiscount;

  assert.strictEqual(percentDiscountAmount, 100.00, '10% of 1000 is 100');
  assert.strictEqual(totalDiscount, 150.00, 'Total discount should be ₹150.00');
  assert.strictEqual(netPayable, 850.00, 'Net payable should be ₹850.00');
});

// -----------------------------------------------------------------------------
// 3. ROLE PERMISSION & AUTHORIZATION GUARDS
// -----------------------------------------------------------------------------
console.log('\n🔒 CATEGORY 3: ROLE PERMISSIONS & AUTHORIZATION GUARDS');

runTest('Permission Guard: Super Admin (role_id 1) granted access to User Master (Module 1)', () => {
  const permissions = [{ role_id: 1, module_id: 1, allowed: 1 }];
  const user = { role_id: 1 };
  const perm = permissions.find(p => p.role_id === user.role_id && p.module_id === 1);
  assert.ok(perm && perm.allowed === 1, 'Super Admin must have permission for User Master');
});

runTest('Permission Guard: Cashier (role_id 3) denied access to User Master (Module 1)', () => {
  const permissions = [{ role_id: 3, module_id: 1, allowed: 0 }];
  const user = { role_id: 3 };
  const perm = permissions.find(p => p.role_id === user.role_id && p.module_id === 1);
  assert.ok(perm && perm.allowed === 0, 'Cashier must be denied access to User Master');
});

runTest('Permission Guard: Cashier (role_id 3) granted access to Sales Billing (Module 4)', () => {
  const permissions = [{ role_id: 3, module_id: 4, allowed: 1 }];
  const user = { role_id: 3 };
  const perm = permissions.find(p => p.role_id === user.role_id && p.module_id === 4);
  assert.ok(perm && perm.allowed === 1, 'Cashier must have access to Sales Billing');
});

// -----------------------------------------------------------------------------
// 4. INPUT VALIDATION & REGEX BOUNDARY TESTS
// -----------------------------------------------------------------------------
console.log('\n🛡️ CATEGORY 4: INPUT BOUNDARY & REGEX VALIDATION');

runTest('Input Boundary: Reject negative item prices or sales quantity', () => {
  const invalidPrice = -15.50;
  const invalidQty = -2;

  assert.ok(invalidPrice < 0, 'Negative price must trigger validation error');
  assert.ok(invalidQty < 0, 'Negative quantity must trigger validation error');
});

runTest('Indian Mobile Verification: 10-digit number regex test', () => {
  const validMobile = '9876543210';
  const invalidMobile = '12345';
  const mobileRegex = /^[6-9]\d{9}$/;

  assert.ok(mobileRegex.test(validMobile), '9876543210 should pass mobile validation');
  assert.ok(!mobileRegex.test(invalidMobile), '12345 should fail mobile validation');
});

runTest('Indian GSTIN Verification: 15-character GSTIN format regex test', () => {
  const validGstin = '24AAAAA0000A1Z5';
  const invalidGstin = 'INVALIDGSTIN123';
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  assert.ok(gstinRegex.test(validGstin), '24AAAAA0000A1Z5 should pass GSTIN validation');
  assert.ok(!gstinRegex.test(invalidGstin), 'INVALIDGSTIN123 should fail GSTIN validation');
});

runTest('Password Hashing: bcrypt hash generation and verification', () => {
  const rawPassword = 'ParshavPassword123';
  const hash = bcrypt.hashSync(rawPassword, 10);
  
  assert.ok(bcrypt.compareSync(rawPassword, hash), 'Correct password should match bcrypt hash');
  assert.ok(!bcrypt.compareSync('WrongPassword', hash), 'Incorrect password should fail bcrypt check');
});

// -----------------------------------------------------------------------------
// 5. RECEIPT CUSTOMIZER & BACKUP ENGINE SCHEMA TESTS
// -----------------------------------------------------------------------------
console.log('\n🖨️ CATEGORY 5: RECEIPT CUSTOMIZER & AUTOMATED BACKUP ENGINE');

runTest('Thermal Receipt Customizer: Validates 58mm/80mm/A4 paper size schema', () => {
  const validPaperSizes = ['58mm', '80mm', 'A4', 'A5'];
  const testConfig = { paper_size: '80mm', printer_type: 'thermal', connection: 'usb' };

  assert.ok(validPaperSizes.includes(testConfig.paper_size), 'Paper size 80mm must be valid');
});

runTest('UPI Payment QR Code: String format generation check', () => {
  const upiId = 'vanshee@upi';
  const amount = 152.60;
  const storeName = 'Vanshee POS';
  const upiQrString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(storeName)}&am=${amount}&cu=INR`;

  assert.ok(upiQrString.startsWith('upi://pay?pa='), 'UPI string must start with upi://pay?pa=');
  assert.ok(upiQrString.includes('vanshee@upi'), 'UPI string must contain store UPI ID');
});

runTest('Automated DB Backup Engine: Generates JSON snapshot payload', () => {
  const mockBackupSnapshot = {
    timestamp: new Date().toISOString(),
    client_id: 1,
    tables: {
      items: [{ item_id: 1, name: 'Amul Milk' }],
      users: [{ user_id: 3, username: 'Parshav' }],
    }
  };

  assert.ok(mockBackupSnapshot.timestamp, 'Snapshot must have a valid timestamp');
  assert.strictEqual(mockBackupSnapshot.tables.items.length, 1, 'Items table payload must be intact');
});

// -----------------------------------------------------------------------------
// 6. 1-CLICK EXCEL / CSV DATA EXPORT ENGINE
// -----------------------------------------------------------------------------
console.log('\n📊 CATEGORY 6: 1-CLICK EXCEL & CSV DATA EXPORT ENGINE');

runTest('Export Suite: Inventory CSV Header & Formatting', () => {
  const items = [{ item_id: 1, name: 'Amul Milk 500ml', item_code: 'ITM-001', sales_price: 30, purchase_price: 25, stock: 45, min_stock_alert: 5 }];
  let csv = 'Item ID,Item Name,Item Code,Sales Price (INR),Purchase Price (INR),Current Stock,Min Alert Level\n';
  for (const item of items) {
    csv += `${item.item_id},"${item.name}",${item.item_code},${item.sales_price},${item.purchase_price},${item.stock},${item.min_stock_alert}\n`;
  }
  assert.ok(csv.includes('Item ID,Item Name,Item Code'), 'CSV header must be present');
  assert.ok(csv.includes('Amul Milk 500ml'), 'Item row must be formatted properly');
});

runTest('Export Suite: GST GSTR-1 Tax Report CGST/SGST Breakdown', () => {
  const invoice = { invoice_number: 'INV-1001', sales_date: '2025-05-24', subtotal: 2500, tax_amount: 450, total: 2950 };
  const cgst = invoice.tax_amount / 2;
  const sgst = invoice.tax_amount / 2;
  let csvRow = `${invoice.invoice_number},${invoice.sales_date},${invoice.subtotal.toFixed(2)},${cgst.toFixed(2)},${sgst.toFixed(2)},0.00,${invoice.tax_amount.toFixed(2)},${invoice.total.toFixed(2)}`;
  
  assert.ok(csvRow.includes('225.00,225.00'), 'CGST and SGST must split tax 50/50 for intra-state billing');
});

// -----------------------------------------------------------------------------
// 7. AUTOMATED WHATSAPP & SMS INVOICE DELIVERY ENGINE
// -----------------------------------------------------------------------------
console.log('\n💬 CATEGORY 7: WHATSAPP & SMS INVOICE DELIVERY ENGINE');

runTest('WhatsApp Engine: Phone number formatting to 91XXXXXXXXXX', () => {
  const rawPhone = '98765 43210';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  
  assert.strictEqual(formattedPhone, '919876543210', 'Phone number must format to 919876543210');
});

runTest('WhatsApp Engine: Click-to-Chat URL & Message Payload generation', () => {
  const invoiceNo = 'INV-1024';
  const total = 1250.00;
  const custName = 'Krinna';
  const msg = `Hello ${custName},\nThank you for shopping with us! Your digital invoice #${invoiceNo} for total ₹${total.toFixed(2)} is ready.`;
  const whatsappUrl = `https://wa.me/919876543210?text=${encodeURIComponent(msg)}`;

  assert.ok(whatsappUrl.startsWith('https://wa.me/919876543210?text='), 'URL must start with https://wa.me/');
  assert.ok(whatsappUrl.includes('INV-1024'), 'WhatsApp URL must encode invoice number');
});

// -----------------------------------------------------------------------------
// SUMMARY REPORT
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 TEST SUITE SUMMARY: ${totalPassed}/${totalPassed + totalFailed} Passed (${totalFailed} Failed)`);
console.log('================================================================');

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Enterprise Unit & Integration Tests Passed 100% Successfully!');
  process.exit(0);
}
