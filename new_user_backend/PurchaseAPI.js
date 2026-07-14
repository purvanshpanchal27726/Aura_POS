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
 * POST /api/purchase
 * Saves a new Purchase Invoice under active tenant client_id.
 */
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const clientId = getClientId(req);
    if (!clientId) {
      await connection.rollback();
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body || {};
    const { vendor_id, purchase_date, purchase_bill_no, gross, tax, total, created_by, items } = data;

    if (!vendor_id || !purchase_date || !purchase_bill_no || !items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Missing required fields for purchase management.' });
    }

    // Insert into purchase_master
    const masterQuery = `
      INSERT INTO purchase_master (
        client_id, vendor_id, purchase_date, purchase_bill_no, gross, tax, total, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [masterResult] = await connection.execute(masterQuery, [
      clientId,
      vendor_id,
      purchase_date,
      purchase_bill_no,
      gross || 0.00,
      tax || 0.00,
      total || 0.00,
      created_by || 'System'
    ]);

    const purchaseId = masterResult.insertId;

    // Insert each detail line item
    const detailQuery = `
      INSERT INTO purchase_details (
        purchase_id, item_id, rate, quantity, item_amount
      ) VALUES (?, ?, ?, ?, ?)
    `;

    for (const item of items) {
      if (!item.item_id || item.rate === undefined || item.quantity === undefined || item.item_amount === undefined) {
        throw new Error('Invalid line item data in transaction.');
      }
      await connection.execute(detailQuery, [
        purchaseId,
        item.item_id,
        item.rate,
        item.quantity,
        item.item_amount
      ]);
    }

    await connection.commit();
    
    // Broadcast purchase event to all active real-time subscribers
    const eventBus = require('./eventBus');
    eventBus.emit('broadcast', {
      event: 'transaction',
      type: 'purchase',
      client_id: clientId,
      billNo: purchase_bill_no,
      total: total || 0,
      operator: created_by || 'System'
    });

    res.status(201).json({ message: 'Purchase invoice saved successfully', purchase_id: purchaseId });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/purchase
 * Fetches all purchase master records for tenant client_id, sorted by purchase_id ascending.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const query = `
      SELECT pm.*, 
             CONCAT(v.first_name, ' ', v.last_name) AS vendor_name,
             v.company AS vendor_company,
             v.phone_1 AS vendor_phone
      FROM purchase_master pm
      LEFT JOIN vendors v ON pm.vendor_id = v.vendor_id
      WHERE pm.client_id = ?
      ORDER BY pm.purchase_id ASC
    `;

    const [rows] = await db.execute(query, [clientId]);
    res.json(rows.map(r => ({ ...r, id: r.purchase_id })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/purchase/details/all
 * Fetches all purchase detail lines with date, vendor, company, user, category, and item name for tenant client_id.
 */
router.get('/details/all', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const query = `
      SELECT pd.*, pm.purchase_date, pm.purchase_bill_no, pm.vendor_id, pm.created_by,
             CONCAT(v.first_name, ' ', v.last_name) AS vendor_name, v.company AS vendor_company,
             i.name AS item_name, i.category_id, cat.name AS category_name
      FROM purchase_details pd
      JOIN purchase_master pm ON pd.purchase_id = pm.purchase_id
      LEFT JOIN vendors v ON pm.vendor_id = v.vendor_id
      LEFT JOIN items i ON pd.item_id = i.item_id
      LEFT JOIN categories cat ON i.category_id = cat.category_id
      WHERE pm.client_id = ?
      ORDER BY pm.purchase_id DESC, pd.purchase_detail_id ASC
    `;
    const [rows] = await db.execute(query, [clientId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/purchase/:id
 * Fetches a single purchase invoice details.
 */
router.get('/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const purchaseId = req.params.id;

    const masterQuery = `
      SELECT pm.*, 
             CONCAT(v.first_name, ' ', v.last_name) AS vendor_name,
             v.company AS vendor_company,
             v.phone_1 AS vendor_phone,
             v.address_1 AS vendor_address,
             v.city AS vendor_city
      FROM purchase_master pm
      LEFT JOIN vendors v ON pm.vendor_id = v.vendor_id
      WHERE pm.purchase_id = ? AND pm.client_id = ?
    `;

    const [masterRows] = await db.execute(masterQuery, [purchaseId, clientId]);
    if (masterRows.length === 0) {
      return res.status(404).json({ error: 'Purchase invoice not found' });
    }

    const detailsQuery = `
      SELECT pd.*, i.name AS item_name, i.code AS item_code
      FROM purchase_details pd
      LEFT JOIN items i ON pd.item_id = i.item_id
      WHERE pd.purchase_id = ?
    `;

    const [detailRows] = await db.execute(detailsQuery, [purchaseId]);

    res.json({
      ...masterRows[0],
      id: masterRows[0].purchase_id,
      items: detailRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/purchase/:id
 * Deletes a purchase invoice (cascades to details) for tenant client_id.
 */
router.delete('/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const purchaseId = parseInt(req.params.id);
    const [rows] = await db.execute('SELECT * FROM purchase_master WHERE purchase_id = ? AND client_id = ?', [purchaseId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Purchase invoice not found' });
    }

    await db.execute('DELETE FROM purchase_master WHERE purchase_id = ? AND client_id = ?', [purchaseId, clientId]);
    
    res.json({ message: 'Purchase invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
