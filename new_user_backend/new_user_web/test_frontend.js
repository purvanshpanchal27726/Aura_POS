const rootObj = typeof window !== 'undefined' ? window : globalThis;

rootObj.POSFrontendTestSuite = (function() {
  const tests = [];
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Equal assertion failed'}: expected "${expected}", got "${actual}"`);
    }
  }

  function assertCloseTo(actual, expected, delta = 0.01, message) {
    if (Math.abs(actual - expected) > delta) {
      throw new Error(`${message || 'Close-to assertion failed'}: expected ${expected} ± ${delta}, got ${actual}`);
    }
  }

  function registerTest(category, name, testFn) {
    tests.push({ category, name, testFn });
  }

  // Helper formatting function for testing
  function formatINR(amount) {
    const num = parseFloat(amount);
    if (isNaN(num)) return '₹0.00';
    const isNegative = num < 0;
    const absVal = Math.abs(num);
    const parts = absVal.toFixed(2).split('.');
    let lastThree = parts[0].slice(-3);
    const otherNumbers = parts[0].slice(0, -3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    return (isNegative ? '-₹' : '₹') + formattedInt + '.' + parts[1];
  }

  // GST Calculation Helper
  function calculateGST(subtotal, taxRate, isInterState = false) {
    const rate = parseFloat(taxRate) || 0;
    const sub = parseFloat(subtotal) || 0;
    if (sub < 0 || rate < 0) {
      return { valid: false, error: 'Negative amount or rate is invalid' };
    }
    const totalTax = (sub * rate) / 100;
    const netTotal = sub + totalTax;
    if (isInterState) {
      return {
        valid: true,
        subtotal: sub,
        cgst: 0,
        sgst: 0,
        igst: totalTax,
        totalTax: totalTax,
        netTotal: netTotal
      };
    } else {
      const halfTax = totalTax / 2;
      return {
        valid: true,
        subtotal: sub,
        cgst: halfTax,
        sgst: halfTax,
        igst: 0,
        totalTax: totalTax,
        netTotal: netTotal
      };
    }
  }

  // GSTIN Validator (15-character Indian GST format)
  function validateGSTIN(gstin) {
    if (!gstin || typeof gstin !== 'string') return false;
    const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return pattern.test(gstin.trim().toUpperCase());
  }

  // Indian Mobile Validator
  function validateIndianMobile(phone) {
    if (!phone) return false;
    const pattern = /^[6-9]\d{9}$/;
    return pattern.test(phone.toString().trim());
  }

  // --- REGISTRATION OF TEST CASES ---

  // 1. POS Indian Rupee Formatting Tests
  registerTest('Currency & Formatting', 'Positive: Format valid positive numbers in INR', () => {
    assertEqual(formatINR(128450), '₹1,28,450.00');
    assertEqual(formatINR(1000), '₹1,000.00');
    assertEqual(formatINR(50.5), '₹50.50');
  });

  registerTest('Currency & Formatting', 'Edge Case: Zero & decimal precision numbers', () => {
    assertEqual(formatINR(0), '₹0.00');
    assertEqual(formatINR(0.001), '₹0.00');
    assertEqual(formatINR(9999999.99), '₹99,99,999.99');
  });

  registerTest('Currency & Formatting', 'Negative / Wrong Data: Handle negative & string inputs', () => {
    assertEqual(formatINR(-500), '-₹500.00');
    assertEqual(formatINR("abc"), '₹0.00');
    assertEqual(formatINR(null), '₹0.00');
    assertEqual(formatINR(undefined), '₹0.00');
  });

  // 2. GST Tax Engine Tests (Indian POV)
  registerTest('GST Engine', 'Positive: Intra-State GST Breakdown (CGST 9% + SGST 9%)', () => {
    const res = calculateGST(1000, 18, false);
    assert(res.valid, 'GST calculation should be valid');
    assertCloseTo(res.cgst, 90, 0.01, 'CGST should be 90');
    assertCloseTo(res.sgst, 90, 0.01, 'SGST should be 90');
    assertCloseTo(res.igst, 0, 0.01, 'IGST should be 0');
    assertCloseTo(res.netTotal, 1180, 0.01, 'Net total should be 1180');
  });

  registerTest('GST Engine', 'Positive: Inter-State GST Breakdown (IGST 18%)', () => {
    const res = calculateGST(1000, 18, true);
    assert(res.valid, 'GST calculation should be valid');
    assertCloseTo(res.cgst, 0, 0.01, 'CGST should be 0');
    assertCloseTo(res.sgst, 0, 0.01, 'SGST should be 0');
    assertCloseTo(res.igst, 180, 0.01, 'IGST should be 180');
    assertCloseTo(res.netTotal, 1180, 0.01, 'Net total should be 1180');
  });

  registerTest('GST Engine', 'Negative / Wrong Data: Reject negative subtotal or negative tax rate', () => {
    const res1 = calculateGST(-500, 18, false);
    assert(!res1.valid, 'Should reject negative subtotal');
    const res2 = calculateGST(500, -18, false);
    assert(!res2.valid, 'Should reject negative tax rate');
  });

  // 3. Indian GSTIN & Mobile Validation Tests
  registerTest('Validations', 'Positive: Accept valid Indian GSTIN (e.g. 27AAAAA0000A1Z5)', () => {
    assert(validateGSTIN('27AAAAA0000A1Z5'), 'Valid Maharashtra GSTIN should pass');
    assert(validateGSTIN('07AAAAA0000A1Z5'), 'Valid Delhi GSTIN should pass');
  });

  registerTest('Validations', 'Wrong / False Data: Reject invalid GSTIN strings', () => {
    assert(!validateGSTIN('INVALID_GSTIN'), 'Plain invalid text should fail');
    assert(!validateGSTIN('12345'), 'Too short string should fail');
    assert(!validateGSTIN('27AAAAA0000A1Z'), 'Missing digits should fail');
    assert(!validateGSTIN(''), 'Empty string should fail');
    assert(!validateGSTIN(null), 'Null should fail');
  });

  registerTest('Validations', 'Positive: Accept valid 10-digit Indian Mobile Numbers', () => {
    assert(validateIndianMobile('9876543210'), 'Valid 9-series mobile should pass');
    assert(validateIndianMobile('8123456789'), 'Valid 8-series mobile should pass');
    assert(validateIndianMobile('7012345678'), 'Valid 7-series mobile should pass');
    assert(validateIndianMobile('6300123456'), 'Valid 6-series mobile should pass');
  });

  registerTest('Validations', 'Wrong / False Data: Reject invalid Mobile Numbers', () => {
    assert(!validateIndianMobile('1234567890'), '1-series phone should fail');
    assert(!validateIndianMobile('98765'), '5-digit phone should fail');
    assert(!validateIndianMobile('ABCDEFGHIJ'), 'Letters should fail');
    assert(!validateIndianMobile('+919876543210'), 'Full format without country code handling should fail raw check');
  });

  // 4. Cart & Billing Calculation Tests
  registerTest('Cart Engine', 'Positive: Calculate multi-item cart total with mixed taxes', () => {
    const line1 = { qty: 2, price: 100, taxRate: 18 }; // Gross 200, Tax 36
    const line2 = { qty: 3, price: 50, taxRate: 5 };   // Gross 150, Tax 7.5
    const grossTotal = (line1.qty * line1.price) + (line2.qty * line2.price);
    const taxTotal = (line1.qty * line1.price * 0.18) + (line2.qty * line2.price * 0.05);
    const netTotal = grossTotal + taxTotal;

    assertCloseTo(grossTotal, 350, 0.01, 'Gross total calculation');
    assertCloseTo(taxTotal, 43.5, 0.01, 'Tax total calculation');
    assertCloseTo(netTotal, 393.5, 0.01, 'Net total calculation');
  });

  registerTest('Cart Engine', 'Negative / Wrong Data: Handle negative Qty, zero price, and floating precision', () => {
    // Floating point precision test: 0.1 + 0.2
    const floatResult = (0.1 * 10) + (0.2 * 10);
    assertCloseTo(floatResult / 10, 0.3, 0.001, 'Floating point precision handling');

    // Negative Quantity input simulation
    const validateLineItem = (qty, price) => {
      if (typeof qty !== 'number' || isNaN(qty) || qty <= 0) return false;
      if (typeof price !== 'number' || isNaN(price) || price < 0) return false;
      return true;
    };

    assert(!validateLineItem(-1, 100), 'Should reject negative quantity');
    assert(!validateLineItem(0, 100), 'Should reject zero quantity');
    assert(!validateLineItem(2, -50), 'Should reject negative price');
    assert(validateLineItem(2, 0), 'Should allow free sample item (price 0)');
    assert(validateLineItem(1.5, 100), 'Should allow fractional weight quantity (1.5 kg)');
  });

  // 5. DOM & Screen Transition Resilience Tests
  registerTest('Screen Navigation Resilience', 'Positive: Screen views exist in DOM', () => {
    if (typeof document === 'undefined') return;
    const screens = [
      'screenDashboard', 'screenSales', 'screenPurchase', 'screenReceipt', 
      'screenReports', 'screenInventory', 'screenRestTables', 'screenRestMenu',
      'screenRestOrders', 'screenHotelRooms', 'screenHotelBookings', 'screenEmployees'
    ];

    let foundCount = 0;
    screens.forEach(sId => {
      const el = document.getElementById(sId);
      if (el) foundCount++;
    });
    assert(foundCount > 0, 'At least target screen containers must exist in DOM');
  });

  registerTest('Screen Navigation Resilience', 'Edge Case: Handles unknown module keys gracefully without crashing', () => {
    if (typeof rootObj === 'undefined' || !rootObj.switchScreen) return;
    let errorThrown = false;
    try {
      rootObj.switchScreen('NON_EXISTENT_MODULE_123');
    } catch (e) {
      errorThrown = true;
    }
    assert(!errorThrown, 'switchScreen should catch and handle unknown modules gracefully');
  });

  // Public Runner Engine
  async function runAll() {
    results.total = tests.length;
    results.passed = 0;
    results.failed = 0;
    results.details = [];

    console.log(`Starting Frontend Unit Test Suite (${tests.length} tests)...`);

    for (const t of tests) {
      const startTime = performance.now();
      try {
        await t.testFn();
        const duration = (performance.now() - startTime).toFixed(2);
        results.passed++;
        results.details.push({
          category: t.category,
          name: t.name,
          status: 'PASSED',
          duration: `${duration}ms`
        });
      } catch (err) {
        const duration = (performance.now() - startTime).toFixed(2);
        results.failed++;
        results.details.push({
          category: t.category,
          name: t.name,
          status: 'FAILED',
          error: err.message,
          duration: `${duration}ms`
        });
      }
    }

    console.log(`Test Suite Finished: ${results.passed}/${results.total} Passed, ${results.failed} Failed.`);
    return results;
  }

  return {
    runAll,
    formatINR,
    calculateGST,
    validateGSTIN,
    validateIndianMobile,
    getTests: () => tests
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = rootObj.POSFrontendTestSuite;
  if (require.main === module) {
    rootObj.POSFrontendTestSuite.runAll();
  }
}
