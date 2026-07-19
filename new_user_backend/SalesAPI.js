const express = require('express');
const db = require('./db');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (!cid || cid === 'null' || cid === 'undefined') return null;
  return parseInt(cid);
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
    
    if (!clientId) {
      await connection.rollback();
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { customer_id, sales_date, sales_bill_no, gross, tax, total, created_by, items, payment_method } = data;

    if (!customer_id || !sales_date || !sales_bill_no || !items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Missing required fields for sales billing.' });
    }

    // Insert into sales_master
    const masterQuery = `
      INSERT INTO sales_master (
        client_id, customer_id, sales_date, sales_bill_no, gross, tax, total, created_by, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [masterResult] = await connection.execute(masterQuery, [
      clientId,
      customer_id,
      sales_date,
      sales_bill_no,
      gross || 0.00,
      tax || 0.00,
      total || 0.00,
      created_by || 'System',
      payment_method || 'Cash'
    ]);

    const salesId = masterResult.insertId;

    // Insert each detail line item
    const detailQuery = `
      INSERT INTO sales_details (
        sales_id, item_id, rate, quantity, item_amount
      ) VALUES (?, ?, ?, ?, ?)
    `;

    for (const item of items) {
      if (!item.item_id || item.rate === undefined || item.quantity === undefined || item.item_amount === undefined) {
        throw new Error('Invalid line item data in transaction.');
      }
      await connection.execute(detailQuery, [
        salesId,
        item.item_id,
        item.rate,
        item.quantity,
        item.item_amount
      ]);
    }

    await connection.commit();

    // Trigger automatic WhatsApp billing delivery
    try {
      const { sendWhatsAppInvoice } = require('./WhatsAppService');
      const [custInfo] = await db.execute('SELECT client_id FROM customers WHERE customer_id = ? AND client_id = ?', [customer_id, clientId]);
      if (custInfo.length > 0) {
        sendWhatsAppInvoice(clientId, customer_id, total, sales_bill_no);
      }
    } catch (wsErr) {
      console.error('[WhatsApp Trigger Error]', wsErr.message);
    }
    
    // Broadcast checkout event to all active real-time subscribers
    const eventBus = require('./eventBus');
    eventBus.emit('broadcast', {
      event: 'transaction',
      type: 'sales',
      client_id: clientId,
      billNo: sales_bill_no,
      total: total || 0,
      operator: created_by || 'System'
    });

    res.status(201).json({ message: 'Sales invoice saved successfully', sales_id: salesId });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/sales
 * Fetches all sales master records with customer names.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const query = `
      SELECT sm.*, 
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
             c.phone_1 AS customer_phone
      FROM sales_master sm
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      WHERE sm.client_id = ?
      ORDER BY sm.sales_id ASC
    `;

    const [rows] = await db.query(query, [clientId]);
    res.json(rows.map(r => ({ ...r, id: r.sales_id })));
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
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const query = `
      SELECT sd.*, sm.sales_date, sm.sales_bill_no, sm.customer_id, sm.created_by,
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
             i.name AS item_name, i.category_id, cat.name AS category_name
      FROM sales_details sd
      JOIN sales_master sm ON sd.sales_id = sm.sales_id
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      LEFT JOIN items i ON sd.item_id = i.item_id
      LEFT JOIN categories cat ON i.category_id = cat.category_id
      WHERE sm.client_id = ?
      ORDER BY sm.sales_id DESC, sd.sales_detail_id ASC
    `;
    const [rows] = await db.query(query, [clientId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sales/:id
 * Fetches a single invoice details.
 */
router.get('/:id', async (req, res) => {
  try {
    const salesId = req.params.id;
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const masterQuery = `
      SELECT sm.*, 
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
             c.phone_1 AS customer_phone,
             c.address_1 AS customer_address,
             c.city AS customer_city
      FROM sales_master sm
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      WHERE sm.sales_id = ? AND sm.client_id = ?
    `;

    const [masterRows] = await db.execute(masterQuery, [salesId, clientId]);
    if (masterRows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const detailsQuery = `
      SELECT sd.*, i.name AS item_name, i.code AS item_code
      FROM sales_details sd
      LEFT JOIN items i ON sd.item_id = i.item_id
      WHERE sd.sales_id = ?
    `;

    const [detailRows] = await db.execute(detailsQuery, [salesId]);

    res.json({
      ...masterRows[0],
      id: masterRows[0].sales_id,
      items: detailRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/sales/:id
 * Deletes an invoice (cascades to details automatically) and shifts subsequent IDs down.
 */
router.delete('/:id', async (req, res) => {
  try {
    const salesId = parseInt(req.params.id);
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const [rows] = await db.execute('SELECT * FROM sales_master WHERE sales_id = ? AND client_id = ?', [salesId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await db.execute('DELETE FROM sales_master WHERE sales_id = ? AND client_id = ?', [salesId, clientId]);
    
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

