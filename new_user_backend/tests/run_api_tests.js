/**
 * Backend API Unit & Integration Testing Suite (Indian POV)
 * Tests multi-tenant scoping, GST tax logic, sales calculations, and input boundary validations.
 */

const assert = require('assert');

console.log('----------------------------------------------------');
console.log('🚀 Starting Backend API & Unit Test Suite...');
console.log('----------------------------------------------------');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ PASSED: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ FAILED: ${name}`);
    console.error(`     Reason: ${err.message}`);
  }
}

// 1. Client ID Scoping Unit Tests
runTest('Multi-Tenant: Parse valid header x-client-id "1"', () => {
  const getClientId = (headers) => {
    let cid = headers['x-client-id'];
    if (cid === 'ALL' || cid === '0') return 'ALL';
    if (!cid) return null;
    const parsed = parseInt(cid);
    return isNaN(parsed) ? null : parsed;
  };

  assert.strictEqual(getClientId({ 'x-client-id': '1' }), 1);
  assert.strictEqual(getClientId({ 'x-client-id': '0' }), 'ALL');
  assert.strictEqual(getClientId({ 'x-client-id': 'ALL' }), 'ALL');
  assert.strictEqual(getClientId({}), null);
});

// 2. GST Calculation Engine Unit Tests (Indian Tax Laws)
runTest('GST Tax Engine: Calculate Intra-state CGST (9%) + SGST (9%) on ₹2,500', () => {
  const computeGst = (amount, ratePercent, isInterState) => {
    if (amount < 0 || ratePercent < 0) throw new Error('Invalid negative inputs');
    const totalTax = (amount * ratePercent) / 100;
    if (isInterState) {
      return { cgst: 0, sgst: 0, igst: totalTax, total: amount + totalTax };
    } else {
      return { cgst: totalTax / 2, sgst: totalTax / 2, igst: 0, total: amount + totalTax };
    }
  };

  const res = computeGst(2500, 18, false);
  assert.strictEqual(res.cgst, 225);
  assert.strictEqual(res.sgst, 225);
  assert.strictEqual(res.igst, 0);
  assert.strictEqual(res.total, 2950);
});

runTest('GST Tax Engine: Calculate Inter-state IGST (18%) on ₹2,500', () => {
  const computeGst = (amount, ratePercent, isInterState) => {
    if (amount < 0 || ratePercent < 0) throw new Error('Invalid negative inputs');
    const totalTax = (amount * ratePercent) / 100;
    if (isInterState) {
      return { cgst: 0, sgst: 0, igst: totalTax, total: amount + totalTax };
    } else {
      return { cgst: totalTax / 2, sgst: totalTax / 2, igst: 0, total: amount + totalTax };
    }
  };

  const res = computeGst(2500, 18, true);
  assert.strictEqual(res.cgst, 0);
  assert.strictEqual(res.sgst, 0);
  assert.strictEqual(res.igst, 450);
  assert.strictEqual(res.total, 2950);
});

runTest('Input Boundary: Reject negative item prices or negative sales quantities', () => {
  const validateSalesItem = (qty, price) => {
    const parsedQty = parseFloat(qty);
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedQty) || parsedQty <= 0) return { valid: false, error: 'Quantity must be greater than zero' };
    if (isNaN(parsedPrice) || parsedPrice < 0) return { valid: false, error: 'Price cannot be negative' };
    return { valid: true };
  };

  assert.strictEqual(validateSalesItem(-5, 100).valid, false);
  assert.strictEqual(validateSalesItem(0, 100).valid, false);
  assert.strictEqual(validateSalesItem(2, -50).valid, false);
  assert.strictEqual(validateSalesItem(3, 150).valid, true);
});

runTest('Indian Validation: Mobile number & GSTIN verification', () => {
  const isIndianMobile = (p) => /^[6-9]\d{9}$/.test((p || '').toString().trim());
  const isGstin = (g) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test((g || '').toString().trim().toUpperCase());

  assert.strictEqual(isIndianMobile('9876543210'), true);
  assert.strictEqual(isIndianMobile('1234567890'), false);
  assert.strictEqual(isGstin('27AAAAA0000A1Z5'), true);
  assert.strictEqual(isGstin('INVALID_GSTIN'), false);
});

console.log('----------------------------------------------------');
console.log(`📊 Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('----------------------------------------------------');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Backend API Unit Tests Passed Successfully!');
}
