const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * POST /api/sales
 * Saves a new Sales Invoice.
 */
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const data = req.body || {};
    const { customer_id, sales_date, sales_bill_no, gross, tax, total, created_by, items } = data;

    if (!customer_id || !sales_date || !sales_bill_no || !items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Missing required fields for sales billing.' });
    }

    // Insert into sales_master
    const masterQuery = `
      INSERT INTO sales_master (
        customer_id, sales_date, sales_bill_no, gross, tax, total, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [masterResult] = await connection.execute(masterQuery, [
      customer_id,
      sales_date,
      sales_bill_no,
      gross || 0.00,
      tax || 0.00,
      total || 0.00,
      created_by || 'System'
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
    
    // Broadcast checkout event to all active real-time subscribers
    const eventBus = require('./eventBus');
    eventBus.emit('broadcast', {
      event: 'transaction',
      type: 'sales',
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
    const query = `
      SELECT sm.*, 
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
             c.phone_1 AS customer_phone
      FROM sales_master sm
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      ORDER BY sm.sales_id ASC
    `;

    const [rows] = await db.query(query);
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
    const query = `
      SELECT sd.*, sm.sales_date, sm.sales_bill_no, sm.customer_id, sm.created_by,
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
             i.name AS item_name, i.category_id, cat.name AS category_name
      FROM sales_details sd
      JOIN sales_master sm ON sd.sales_id = sm.sales_id
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      LEFT JOIN items i ON sd.item_id = i.item_id
      LEFT JOIN categories cat ON i.category_id = cat.category_id
      ORDER BY sm.sales_id DESC, sd.sales_detail_id ASC
    `;
    const [rows] = await db.query(query);
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

    const masterQuery = `
      SELECT sm.*, 
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
             c.phone_1 AS customer_phone,
             c.address_1 AS customer_address,
             c.city AS customer_city
      FROM sales_master sm
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      WHERE sm.sales_id = ?
    `;

    const [masterRows] = await db.execute(masterQuery, [salesId]);
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
    const [rows] = await db.execute('SELECT * FROM sales_master WHERE sales_id = ?', [salesId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM sales_master WHERE sales_id = ?', [salesId]);
    await db.execute('UPDATE sales_master SET sales_id = sales_id - 1 WHERE sales_id > ?', [salesId]);
    await db.execute('ALTER TABLE sales_master AUTO_INCREMENT = 1');
    await db.query('COMMIT');
    
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

