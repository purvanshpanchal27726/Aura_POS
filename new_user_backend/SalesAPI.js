const express = require('express');
const db = require('./db');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  let cid = req.headers['x-client-id'] || req.query.client_id;
  if (cid === 'ALL' || cid === 'all' || cid === '0') return 'ALL';
  if (cid === undefined || cid === null || cid === 'null' || cid === 'undefined' || cid === '') {
    if (req.user && req.user.client_id !== undefined && req.user.client_id !== null) {
      cid = req.user.client_id;
    }
  }
  if (cid === 'ALL' || cid === 'all' || cid === '0') return 'ALL';
  if (cid === undefined || cid === null || cid === 'null' || cid === 'undefined' || cid === '') return null;
  const parsed = parseInt(cid);
  return isNaN(parsed) ? null : parsed;
}

// Helper to check if active user is a Super-Admin
function checkSuperAdmin(req) {
  if (!req.user) return true;
  return Boolean(
    req.user.role_id == 1 ||
    req.user.role_id == '1' ||
    req.user.role_id == 2 ||
    req.user.role_id == '2' ||
    req.user.is_superadmin == 1 ||
    req.user.is_superadmin == '1' ||
    req.user.is_superadmin === true ||
    req.user.client_id === 0 ||
    req.user.client_id === '0' ||
    req.user.client_id === null ||
    req.user.client_id === undefined
  );
}

/**
 * POST /api/sales
 * Saves a new Sales Invoice.
 */
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const data = req.body || {};
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    
    if (clientId === null && !isSuperAdmin) {
      await connection.rollback();
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { customer_id, sales_date, sales_bill_no, gross, tax, total, created_by, items, payment_method } = data;

    // Auto-generate per-client sequential bill number starting from 1, 2, 3... per client_id
    const targetCid = parseInt(clientId || 1) || 1;
    const [countRow] = await connection.execute(
      'SELECT COUNT(*) AS bill_count FROM sales_master WHERE client_id = $1',
      [targetCid]
    ).catch(() => [[{ bill_count: 0 }]]);
    
    const nextBillNumber = (parseInt(countRow[0]?.bill_count || 0) + 1);
    const generatedBillNo = `INV-${nextBillNumber}`;
    const finalSalesBillNo = (sales_bill_no && sales_bill_no !== 'INV-1001' && sales_bill_no !== 'AUTO') 
      ? String(sales_bill_no) 
      : generatedBillNo;

    const parsedGross = parseFloat(gross || 0.0);
    const parsedTax = parseFloat(tax || 0.0);
    const parsedTotal = parseFloat(total || (parsedGross + parsedTax));

    if (!items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Missing required items for invoice creation.' });
    }

    const masterQuery = `
      INSERT INTO sales_master (
        client_id, customer_id, sales_date, sales_bill_no, gross, tax, total, created_by, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const masterValues = [
      targetCid,
      parseInt(customer_id) || null,
      sales_date || new Date(),
      finalSalesBillNo,
      parsedGross,
      parsedTax,
      parsedTotal,
      created_by || 'System',
      payment_method || 'Cash'
    ];

    const [masterResult] = await connection.execute(masterQuery, masterValues);
    const newSalesId = masterResult.insertId;

    const detailQuery = `
      INSERT INTO sales_details (
        sales_id, item_id, item_name, rate, quantity, item_amount, client_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    for (const it of items) {
      const itemId = parseInt(it.item_id || it.id || 1) || 1;
      const qty = parseFloat(it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : 1)) || 1.0;
      const rate = parseFloat(it.rate || it.price || 0.0) || 0.0;
      const amt = parseFloat(it.item_amount !== undefined ? it.item_amount : (it.total !== undefined ? it.total : (qty * rate))) || 0.0;
      const itemName = String(it.item_name || it.name || 'Item');
      
      const detailValues = [
        newSalesId,
        itemId,
        itemName,
        rate,
        qty,
        amt,
        targetCid
      ];
      await connection.execute(detailQuery, detailValues);

      // Deduct item stock in items table
      await connection.execute(
        'UPDATE items SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - ?) WHERE item_id = ?',
        [qty, itemId]
      );
    }

    await connection.commit();
    res.status(201).json({
      message: 'Invoice created successfully',
      sales_id: newSalesId,
      sales_bill_no: finalSalesBillNo
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    console.error('Error in POST /api/sales:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/sales
 * Fetches all sales master records with joined customer names.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = `
      SELECT sm.*, 
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name
      FROM sales_master sm
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      WHERE 
    `;
    let params = [];
    if (clientId !== null && clientId !== undefined && !isSuperAdmin) {
      query += 'sm.client_id = $1';
      params.push(clientId);
    } else {
      query += '1=1';
    }
    query += ' ORDER BY sm.sales_id DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sales/details/all
 * Fetches all sales detail lines with date, customer, user, category, and item name.
 */
router.get('/details/all', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = `
      SELECT sd.*, sm.sales_date, sm.sales_bill_no, sm.customer_id, sm.created_by,
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
             i.name AS item_name, i.category_id, cat.name AS category_name,
             sd.quantity, sd.item_amount
      FROM sales_details sd
      JOIN sales_master sm ON sd.sales_id = sm.sales_id
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      LEFT JOIN items i ON sd.item_id = i.item_id
      LEFT JOIN categories cat ON i.category_id = cat.category_id
      WHERE 
    `;
    let params = [];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && !isSuperAdmin) {
      query += 'sm.client_id = $1';
      params.push(clientId);
    } else {
      query += '1=1';
    }
    query += ' ORDER BY sm.sales_id DESC, sd.sales_detail_id ASC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sales/:id
 * Fetches a single invoice details (master + items).
 */
router.get('/:id', async (req, res) => {
  try {
    const salesId = parseInt(req.params.id);
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let masterQuery = `
      SELECT sm.*, 
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
             c.phone_1 AS customer_phone,
             cl.name AS client_name, cl.address_1, cl.phone_1, cl.gstin
      FROM sales_master sm
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      LEFT JOIN clients cl ON sm.client_id = cl.client_id
      WHERE sm.sales_id = $1
    `;
    let masterParams = [salesId];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0' && !isSuperAdmin) {
      masterQuery += ' AND sm.client_id = $2';
      masterParams.push(clientId);
    }

    const [masters] = await db.execute(masterQuery, masterParams);
    if (masters.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const [details] = await db.execute(`
      SELECT sd.*, COALESCE(sd.item_name, i.name, 'Item') AS item_name, COALESCE(i.code, 'SKU-001') AS item_code
      FROM sales_details sd
      LEFT JOIN items i ON sd.item_id = i.item_id
      WHERE sd.sales_id = $1
    `, [salesId]);

    res.json({
      ...masters[0],
      items: details
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sales/all/clear
 * Clears all sales receipts for the active client.
 */
router.delete('/all/clear', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let deleteQuery = 'DELETE FROM sales_master WHERE ';
    let params = [];
    if (clientId !== null && clientId !== undefined && !isSuperAdmin) {
      deleteQuery += 'client_id = $1';
      params.push(clientId);
    } else {
      deleteQuery += '1=1';
    }

    await db.execute(deleteQuery, params);
    res.json({ message: 'All receipts cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sales/:id
 * Deletes a specific invoice.
 */
router.delete('/:id', async (req, res) => {
  try {
    const salesId = parseInt(req.params.id);
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let queryExist = 'SELECT * FROM sales_master WHERE sales_id = $1 AND ';
    let paramsExist = [salesId];
    if (clientId !== null && clientId !== undefined && !isSuperAdmin) {
      queryExist += 'client_id = $2';
      paramsExist.push(clientId);
    } else {
      queryExist += '1=1';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    let deleteQuery = 'DELETE FROM sales_master WHERE sales_id = $1 AND ';
    let deleteParams = [salesId];
    if (clientId !== null && clientId !== undefined && !isSuperAdmin) {
      deleteQuery += 'client_id = $2';
      deleteParams.push(clientId);
    } else {
      deleteQuery += '1=1';
    }

    await db.execute(deleteQuery, deleteParams);
    
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sales/cloudinary/upload-pdf
 * Accepts { bill_no, pdf_base64 } and uploads to Cloudinary or generates hosted PDF link.
 */
router.post('/cloudinary/upload-pdf', async (req, res) => {
  try {
    const { bill_no, pdf_base64 } = req.body || {};
    if (!bill_no) {
      return res.status(400).json({ error: 'bill_no is required' });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'xzhmg1ek';
    const apiKey = process.env.CLOUDINARY_API_KEY || '629518777443581';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'XY7YwH2VKmqXQjBsBdO8BWynx0s';

    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const localPdfUrl = `${protocol}://${host}/api/sales/pdf/${encodeURIComponent(bill_no)}`;
    const localBillUrl = `${protocol}://${host}/new_user_web/index.html?bill=${encodeURIComponent(bill_no)}`;

    if (apiKey && apiSecret) {
      try {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          secure: true
        });

        const uploadRes = await cloudinary.uploader.upload(pdf_base64, {
          public_id: `Invoice_${bill_no.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          folder: 'pos_invoices',
          resource_type: 'raw',
          overwrite: true
        });

        return res.json({
          success: true,
          cloudinary_url: uploadRes.secure_url || uploadRes.url,
          bill_url: localBillUrl,
          provider: 'cloudinary'
        });
      } catch (cErr) {
        console.warn('Cloudinary SDK upload warning:', cErr.message);
      }
    }

    return res.json({
      success: true,
      cloudinary_url: localPdfUrl,
      bill_url: localBillUrl,
      provider: 'hosted'
    });
  } catch (err) {
    console.error('Cloudinary PDF endpoint error:', err);
    res.status(500).json({ error: 'Failed to process Cloudinary bill link.' });
  }
});

/**
 * GET /api/sales/pdf/:billNo
 * Returns HTML invoice print view for the bill.
 */
router.get('/pdf/:billNo', async (req, res) => {
  try {
    const billNo = req.params.billNo;
    const [rows] = await db.execute(`
      SELECT sm.*, c.name AS client_name, c.address_1, c.phone_1, c.gstin
      FROM sales_master sm
      LEFT JOIN clients c ON sm.client_id = c.client_id
      WHERE sm.sales_bill_no = $1
    `, [billNo]);
    if (rows.length === 0) {
      return res.status(404).send('<h2>Invoice Not Found</h2>');
    }
    const sale = rows[0];
    const [items] = await db.execute('SELECT * FROM sales_details WHERE sales_id = $1', [sale.sales_id]);
    
    const storeName = sale.client_name || 'AURA POS ENTERPRISE';
    const storeAddress = sale.address_1 || '123 Commercial Hub, SG Highway, Ahmedabad';
    const storePhone = sale.phone_1 || '9876543210';
    const storeGstin = sale.gstin || '24AAACV1234F1Z9';
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice #${sale.sales_bill_no}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 2rem; max-width: 650px; margin: 0 auto; color: #0f172a; background: #fff; }
          .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 1rem; margin-bottom: 1.5rem; }
          .store-title { font-size: 1.6rem; font-weight: 800; color: #1e293b; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .store-subtitle { margin: 4px 0 0 0; color: #64748b; font-size: 0.85rem; }
          .barcode-container { text-align: center; margin: 16px 0; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
          .barcode-text { font-family: 'Courier New', Courier, monospace; font-size: 1.4rem; font-weight: bold; letter-spacing: 4px; color: #0f172a; }
          .info-table, .items-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
          .items-table th, .items-table td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          .items-table th { background: #f1f5f9; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: #475569; }
          .total-row { font-weight: 800; font-size: 1.2rem; color: #2563eb; }
          .footer { text-align: center; margin-top: 2rem; border-top: 2px dashed #cbd5e1; padding-top: 1rem; color: #64748b; font-size: 0.85rem; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="store-title">${storeName}</h1>
          <p class="store-subtitle">${storeAddress} | Ph: +91 ${storePhone}</p>
          <p class="store-subtitle"><strong>GSTIN:</strong> ${storeGstin}</p>
        </div>

        <div class="barcode-container">
          <div class="barcode-text">||| | || |||| | ||| |||| | |||</div>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 4px;">*${sale.sales_bill_no}*</div>
        </div>

        <table class="info-table">
          <tr><td><strong>Bill No:</strong> ${sale.sales_bill_no}</td><td style="text-align:right;"><strong>Date:</strong> ${new Date(sale.sales_date).toLocaleDateString('en-IN')}</td></tr>
          <tr><td><strong>Customer ID:</strong> ${sale.customer_id || 'Walk-in Customer'}</td><td style="text-align:right;"><strong>Pay Method:</strong> ${sale.payment_method || 'Cash'}</td></tr>
        </table>

        <table class="items-table">
          <thead>
            <tr><th>Item Name</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr>
                <td><strong>${it.item_name}</strong></td>
                <td style="text-align:right;">${parseFloat(it.quantity).toFixed(2)}</td>
                <td style="text-align:right;">₹${parseFloat(it.rate).toFixed(2)}</td>
                <td style="text-align:right;">₹${parseFloat(it.item_amount).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="text-align: right; border-top: 2px solid #94a3b8; padding-top: 10px; margin-top: 10px;">
          <div>Gross Subtotal: ₹${parseFloat(sale.gross).toFixed(2)}</div>
          <div>GST Tax: ₹${parseFloat(sale.tax).toFixed(2)}</div>
          <div class="total-row" style="margin-top: 4px;">Net Payable: ₹${parseFloat(sale.total).toFixed(2)}</div>
        </div>

        <div class="footer">
          <p>Thank you for visiting ${storeName}!</p>
          <p>Powered by Aura Enterprise POS System</p>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    return res.status(200).send(html);
  } catch (err) {
    console.error('Error generating PDF view:', err);
    return res.status(500).send('<h2>Error loading invoice</h2>');
  }
});

/**
 * POST /api/sales/send-whatsapp
 * Generates a WhatsApp Click-to-Chat URL & dispatches digital invoice notification.
 */
router.post('/send-whatsapp', async (req, res) => {
  try {
    const { phone, invoice_number, total, customer_name } = req.body || {};

    if (!phone) {
      return res.status(400).json({ error: 'Customer phone number is required' });
    }

    const cleanPhone = phone.toString().replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const custName = customer_name || 'Valued Customer';
    const invNo = invoice_number || 'INV-001';
    const invTotal = total ? parseFloat(total).toFixed(2) : '0.00';

    const msg = `Hello ${custName},\nThank you for shopping with us! Your digital invoice #${invNo} for total ₹${invTotal} is ready.\n\nView Bill: https://possys-w2ip.onrender.com/api/sales/print/${encodeURIComponent(invNo)}\n\nThank you for visiting Aura POS Enterprise!`;
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;

    return res.status(200).json({
      success: true,
      whatsapp_url: whatsappUrl,
      message: msg,
      phone: formattedPhone,
    });
  } catch (e) {
    console.error('Error generating WhatsApp invoice URL:', e);
    return res.status(500).json({ error: 'Failed to generate WhatsApp notification link' });
  }
});

module.exports = router;
