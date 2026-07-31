const http = require('http');

async function testSalesApi() {
  const postData = JSON.stringify({
    customer_id: 9,
    sales_date: '2026-07-31',
    sales_bill_no: 'INV-1001',
    gross: 12.00,
    tax: 0.00,
    total: 12.00,
    created_by: 'admin',
    payment_method: 'Cash',
    items: [
      { item_id: 11, quantity: 1, rate: 12.00, tax_rate: 0, tax_amount: 0, amount: 12.00 }
    ]
  });

  const options = {
    hostname: 'localhost',
    port: 3005,
    path: '/api/sales',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': '0',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', body);
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e);
  });

  req.write(postData);
  req.end();
}

testSalesApi();
