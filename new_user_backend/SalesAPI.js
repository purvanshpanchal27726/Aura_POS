const express = require('express');
const db = require('./db');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  let cid = req.headers['x-client-id'] || req.query.client_id;
  if (cid === undefined || cid === null || cid === 'null' || cid === 'undefined') {
    if (req.user && req.user.client_id !== undefined && req.user.client_id !== null) {
      cid = req.user.client_id;
    }
  }
  if (cid === undefined || cid === null || cid === 'null' || cid === 'undefined') return null;
  const parsed = parseInt(cid);
  return isNaN(parsed) ? null : parsed;
}

// Helper to check if active user is a Super-Admin
function checkSuperAdmin(req) {
  return !req.user || req.user.role_id === 1 || req.user.client_id === 0 || req.user.client_id === null || req.user.client_id === undefined;
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

    if (!sales_bill_no || !gross || !total || !items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Missing required fields for invoice creation.' });
    }

    const masterQuery = `
      INSERT INTO sales_master (
        client_id, customer_id, sales_date, sales_bill_no, gross, tax, total, created_by, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const masterValues = [
      clientId,
      customer_id || null,
      sales_date || new Date(),
      sales_bill_no,
      parseFloat(gross),
      parseFloat(tax || 0.00),
      parseFloat(total),
      created_by || 'System',
      payment_method || 'Cash'
    ];

    const [masterResult] = await connection.execute(masterQuery, masterValues);
    const newSalesId = masterResult.insertId;

    const detailQuery = `
      INSERT INTO sales_details (
        sales_id, item_id, rate, quantity, item_amount
      ) VALUES (?, ?, ?, ?, ?)
    `;

    for (const it of items) {
      const qty = parseFloat(it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : 1));
      const amt = parseFloat(it.item_amount !== undefined ? it.item_amount : (it.total !== undefined ? it.total : 0));
      const detailValues = [
        newSalesId,
        parseInt(it.item_id),
        parseFloat(it.rate || 0),
        qty,
        amt
      ];
      await connection.execute(detailQuery, detailValues);
    }

    await connection.commit();
    res.status(201).json({
      message: 'Invoice created successfully',
      sales_id: newSalesId
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
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
    if (clientId !== null && clientId !== undefined) {
      query += 'sm.client_id = $1';
      params.push(clientId);
    } else {
      query += 'sm.client_id IS NULL';
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
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name
      FROM sales_master sm
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      WHERE sm.sales_id = $1 AND 
    `;
    let masterParams = [salesId];
    if (clientId !== null && clientId !== undefined) {
      masterQuery += 'sm.client_id = $2';
      masterParams.push(clientId);
    } else {
      masterQuery += 'sm.client_id IS NULL';
    }

    const [masters] = await db.execute(masterQuery, masterParams);
    if (masters.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const [details] = await db.execute(`
      SELECT sd.*, i.name AS item_name, i.code AS item_code
      FROM sales_details sd
      JOIN items i ON sd.item_id = i.item_id
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
    if (clientId !== null && clientId !== undefined) {
      queryExist += 'client_id = $2';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    let deleteQuery = 'DELETE FROM sales_master WHERE sales_id = $1 AND ';
    let deleteParams = [salesId];
    if (clientId !== null && clientId !== undefined) {
      deleteQuery += 'client_id = $2';
      deleteParams.push(clientId);
    } else {
      deleteQuery += 'client_id IS NULL';
    }

    await db.execute(deleteQuery, deleteParams);
    
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
