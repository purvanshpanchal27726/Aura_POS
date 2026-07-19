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

// Get all purchase orders
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = `
      SELECT po.*, CONCAT(v.first_name, ' ', v.last_name) AS vendor_name, v.company AS vendor_company
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
      WHERE 
    `;
    let params = [];
    if (clientId) {
      query += 'po.client_id = ?';
      params.push(clientId);
    } else {
      query += 'po.client_id IS NULL';
    }
    query += ' ORDER BY po.po_id DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single purchase order details
router.get('/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    let query = `
      SELECT po.*, CONCAT(v.first_name, ' ', v.last_name) AS vendor_name, v.company AS vendor_company
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
      WHERE po.po_id = ? AND 
    `;
    let params = [id];
    if (clientId) {
      query += 'po.client_id = ?';
      params.push(clientId);
    } else {
      query += 'po.client_id IS NULL';
    }

    const [po] = await db.execute(query, params);
    if (po.length === 0) return res.status(404).json({ error: 'Purchase Order not found' });

    const [items] = await db.execute('SELECT * FROM purchase_order_items WHERE po_id = ?', [id]);

    res.json({
      ...po[0],
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Purchase Order
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      await connection.rollback();
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { vendor_id, items, total, created_by } = req.body;
    if (!vendor_id || !items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Vendor ID and order line items are required' });
    }

    // Insert purchase order master
    const [poResult] = await connection.execute(
      `INSERT INTO purchase_orders (client_id, vendor_id, status, total, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [clientId, vendor_id, 'draft', total || 0.00, created_by || 'System']
    );

    const poId = poResult.insertId;

    // Insert line items
    for (const item of items) {
      await connection.execute(
        'INSERT INTO purchase_order_items (po_id, item_name, quantity, price) VALUES (?, ?, ?, ?)',
        [poId, item.item_name, item.quantity, item.price]
      );
    }

    await connection.commit();
    res.status(201).json({ po_id: poId, message: 'Purchase Order created successfully' });
  } catch (err) {
    await connection.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Update Purchase Order Status
router.put('/:id/status', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { status } = req.body;

    let query = 'SELECT * FROM purchase_orders WHERE po_id = ? AND ';
    let params = [id];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Purchase Order not found' });

    await db.execute('UPDATE purchase_orders SET status = ? WHERE po_id = ?', [status, id]);
    res.json({ message: 'Purchase Order status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post Goods Received Note (GRN) and auto-increment inventory stock levels
router.post('/:id/grn', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      await connection.rollback();
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { id } = req.params;
    const { received_by, notes, items } = req.body;

    let query = 'SELECT * FROM purchase_orders WHERE po_id = ? AND ';
    let params = [id];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [po] = await connection.execute(query, params);
    if (po.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // 1. Create Goods Received Note (GRN) master record
    const [grnResult] = await connection.execute(
      'INSERT INTO grn (client_id, po_id, received_by, notes) VALUES (?, ?, ?, ?)',
      [clientId, id, received_by || null, notes || '']
    );

    const grnId = grnResult.insertId;

    // 2. Insert GRN items & increment inventory stock levels
    for (const item of items) {
      const qOrdered = parseFloat(item.quantity_ordered || 0);
      const qReceived = parseFloat(item.quantity_received || 0);

      await connection.execute(
        `INSERT INTO grn_items (grn_id, item_name, quantity_ordered, quantity_received) 
         VALUES (?, ?, ?, ?)`,
        [grnId, item.item_name, qOrdered, qReceived]
      );

      if (qReceived > 0) {
        // Find if this item name exists in client inventory
        let invQuery = 'SELECT * FROM inventory WHERE LOWER(item_name) = LOWER(?) AND ';
        let invParams = [item.item_name.trim()];
        if (clientId) {
          invQuery += 'client_id = ?';
          invParams.push(clientId);
        } else {
          invQuery += 'client_id IS NULL';
        }

        const [invRows] = await connection.execute(invQuery, invParams);

        let invId;
        if (invRows.length === 0) {
          // Auto-register new item in inventory database table
          const [newInv] = await connection.execute(
            `INSERT INTO inventory (client_id, item_name, current_stock, unit) 
             VALUES (?, ?, ?, ?)`,
            [clientId, item.item_name.trim(), qReceived, 'pcs']
          );
          invId = newInv.insertId;
        } else {
          invId = invRows[0].inventory_id;
          // Increment existing stock level
          const newStock = parseFloat(invRows[0].current_stock || 0) + qReceived;
          let updateInvQuery = 'UPDATE inventory SET current_stock = ? WHERE inventory_id = ? AND ';
          let updateInvParams = [newStock, invId];
          if (clientId) {
            updateInvQuery += 'client_id = ?';
            updateInvParams.push(clientId);
          } else {
            updateInvQuery += 'client_id IS NULL';
          }
          await connection.execute(updateInvQuery, updateInvParams);
        }

        // Write Stock Movement Log
        await connection.execute(
          `INSERT INTO stock_movements (client_id, inventory_id, type, quantity, reference, notes) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [clientId, invId, 'IN', qReceived, `GRN-#${grnId} / PO-#${id}`, 'Vendor purchase order received']
        );
      }
    }

    // 3. Mark PO status as received
    await connection.execute('UPDATE purchase_orders SET status = ? WHERE po_id = ?', ['received', id]);

    await connection.commit();
    res.status(201).json({ grn_id: grnId, message: 'GRN completed and stock levels updated successfully!' });
  } catch (err) {
    await connection.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
