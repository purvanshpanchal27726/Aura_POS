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
  return !req.user || req.user.role_id === 1 || req.user.client_id === null || req.user.client_id === undefined;
}

// Get client inventory
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = 'SELECT * FROM inventory WHERE ';
    let params = [];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    query += ' ORDER BY item_name';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create inventory item
router.post('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { item_name, sku, barcode, unit, min_stock, batch_no, expiry_date } = req.body;
    if (!item_name) return res.status(400).json({ error: 'Item name is required' });

    const [result] = await db.execute(
      `INSERT INTO inventory (client_id, item_name, sku, barcode, unit, min_stock, batch_no, expiry_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        item_name,
        sku || '',
        barcode || '',
        unit || 'pcs',
        min_stock || 0,
        batch_no || '',
        expiry_date || null
      ]
    );

    res.status(201).json({ inventory_id: result.insertId, message: 'Inventory item created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update inventory item details
router.put('/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { item_name, sku, barcode, unit, min_stock, batch_no, expiry_date } = req.body;

    let query = 'SELECT * FROM inventory WHERE inventory_id = ? AND ';
    let params = [id];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found in inventory' });

    let updateQuery = `
      UPDATE inventory 
      SET item_name = ?, sku = ?, barcode = ?, unit = ?, min_stock = ?, batch_no = ?, expiry_date = ? 
      WHERE inventory_id = ? AND 
    `;
    let updateParams = [
      item_name !== undefined ? item_name : rows[0].item_name,
      sku !== undefined ? sku : rows[0].sku,
      barcode !== undefined ? barcode : rows[0].barcode,
      unit !== undefined ? unit : rows[0].unit,
      min_stock !== undefined ? min_stock : rows[0].min_stock,
      batch_no !== undefined ? batch_no : rows[0].batch_no,
      expiry_date !== undefined ? expiry_date : rows[0].expiry_date,
      id
    ];
    if (clientId) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);
    res.json({ message: 'Inventory item details updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post stock movement transaction (IN, OUT, ADJUST)
router.post('/movement', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      await connection.rollback();
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { inventory_id, type, quantity, reference, notes, created_by } = req.body;
    if (!inventory_id || !type || quantity === undefined) {
      await connection.rollback();
      return res.status(400).json({ error: 'Inventory ID, movement type, and quantity are required.' });
    }

    // 1. Check if inventory item exists
    let query = 'SELECT * FROM inventory WHERE inventory_id = ? AND ';
    let params = [inventory_id];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [invRows] = await connection.execute(query, params);
    if (invRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Inventory record not found' });
    }

    const currentStock = parseFloat(invRows[0].current_stock || 0);
    const qtyChange = parseFloat(quantity);
    let newStock = currentStock;

    if (type === 'IN') {
      newStock += qtyChange;
    } else if (type === 'OUT') {
      newStock -= qtyChange;
    } else if (type === 'ADJUST') {
      newStock = qtyChange;
    } else {
      await connection.rollback();
      return res.status(400).json({ error: 'Invalid movement type. Must be IN, OUT, or ADJUST.' });
    }

    // 2. Insert Stock Movement record
    await connection.execute(
      `INSERT INTO stock_movements (client_id, inventory_id, type, quantity, reference, notes, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clientId, inventory_id, type, qtyChange, reference || '', notes || '', created_by || 'System']
    );

    // 3. Update current_stock on inventory item
    let updateStockQuery = 'UPDATE inventory SET current_stock = ? WHERE inventory_id = ? AND ';
    let updateStockParams = [newStock, inventory_id];
    if (clientId) {
      updateStockQuery += 'client_id = ?';
      updateStockParams.push(clientId);
    } else {
      updateStockQuery += 'client_id IS NULL';
    }
    await connection.execute(updateStockQuery, updateStockParams);

    await connection.commit();
    res.json({ message: 'Stock movement posted successfully', current_stock: newStock });
  } catch (err) {
    await connection.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Get stock movements history
router.get('/movements', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = `
      SELECT sm.*, inv.item_name, inv.unit
      FROM stock_movements sm
      JOIN inventory inv ON sm.inventory_id = inv.inventory_id
      WHERE 
    `;
    let params = [];
    if (clientId) {
      query += 'sm.client_id = ?';
      params.push(clientId);
    } else {
      query += 'sm.client_id IS NULL';
    }
    query += ' ORDER BY sm.movement_id DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
