const express = require('express');
const db = require('./db');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (!cid || cid === 'null' || cid === 'undefined') return null;
  return parseInt(cid);
}

// Helper to check if active user is a Super-Admin
function checkSuperAdmin(req) {
  return !req.user || req.user.client_id === null || req.user.client_id === undefined;
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
    
    if (!clientId && !isSuperAdmin) {
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
      INSERT INTO sales_detail (
        sales_id, item_id, rate, qty, tax, total
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (const it of items) {
      const detailValues = [
        newSalesId,
        parseInt(it.item_id),
        parseFloat(it.rate),
        parseFloat(it.qty),
        parseFloat(it.tax || 0.00),
        parseFloat(it.total)
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
    if (!clientId && !isSuperAdmin) {
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
    if (clientId) {
      query += 'sm.client_id = ?';
      params.push(clientId);
    } else {
      query += 'sm.client_id IS NULL';
    }
    query += ' ORDER BY sm.sales_id DESC';

    const [rows] = await db.query(query, params);
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
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let masterQuery = `
      SELECT sm.*, 
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name
      FROM sales_master sm
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      WHERE sm.sales_id = ? AND 
    `;
    let masterParams = [salesId];
    if (clientId) {
      masterQuery += 'sm.client_id = ?';
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
      FROM sales_detail sd
      JOIN items i ON sd.item_id = i.item_id
      WHERE sd.sales_id = ?
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
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let queryExist = 'SELECT * FROM sales_master WHERE sales_id = ? AND ';
    let paramsExist = [salesId];
    if (clientId) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    let deleteQuery = 'DELETE FROM sales_master WHERE sales_id = ? AND ';
    let deleteParams = [salesId];
    if (clientId) {
      deleteQuery += 'client_id = ?';
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
