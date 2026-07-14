const express = require('express');
const db = require('./db');
const eventBus = require('./eventBus');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (!cid || cid === 'null' || cid === 'undefined') return null;
  return parseInt(cid);
}

// ─────────────────────────────────────────────────────────────────────────
// 📋 TABLES MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

// Get all tables
router.get('/tables', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const [rows] = await db.execute(
      'SELECT * FROM restaurant_tables WHERE client_id = ? AND active = 1 ORDER BY table_no',
      [clientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create table
router.post('/tables', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { table_no, section, capacity } = req.body;
    if (!table_no) return res.status(400).json({ error: 'Table number is required' });

    // Generate a unique qr_token for the table
    const qr_token = 'QR_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();

    const [result] = await db.execute(
      'INSERT INTO restaurant_tables (client_id, table_no, section, capacity, qr_token) VALUES (?, ?, ?, ?, ?)',
      [clientId, table_no, section || 'Indoor', capacity || 4, qr_token]
    );

    res.status(201).json({ table_id: result.insertId, qr_token, message: 'Table created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update table
router.put('/tables/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { table_no, section, capacity, status } = req.body;

    const [rows] = await db.execute(
      'SELECT * FROM restaurant_tables WHERE table_id = ? AND client_id = ?',
      [id, clientId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Table not found' });

    await db.execute(
      `UPDATE restaurant_tables 
       SET table_no = ?, section = ?, capacity = ?, status = ? 
       WHERE table_id = ? AND client_id = ?`,
      [
        table_no !== undefined ? table_no : rows[0].table_no,
        section !== undefined ? section : rows[0].section,
        capacity !== undefined ? capacity : rows[0].capacity,
        status !== undefined ? status : rows[0].status,
        id,
        clientId
      ]
    );

    res.json({ message: 'Table updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete table (soft delete)
router.delete('/tables/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const [rows] = await db.execute(
      'SELECT * FROM restaurant_tables WHERE table_id = ? AND client_id = ?',
      [id, clientId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Table not found' });

    await db.execute(
      'UPDATE restaurant_tables SET active = 0 WHERE table_id = ? AND client_id = ?',
      [id, clientId]
    );
    res.json({ message: 'Table deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────
// 🍔 MENU CATEGORIES
// ─────────────────────────────────────────────────────────────────────────

router.get('/menu/categories', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const [rows] = await db.execute(
      'SELECT * FROM menu_categories WHERE client_id = ? AND active = 1 ORDER BY name',
      [clientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/menu/categories', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { name, image_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name required' });

    const [result] = await db.execute(
      'INSERT INTO menu_categories (client_id, name, image_url) VALUES (?, ?, ?)',
      [clientId, name, image_url || null]
    );
    res.status(201).json({ category_id: result.insertId, message: 'Menu Category created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/menu/categories/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { name, image_url } = req.body;

    const [rows] = await db.execute('SELECT * FROM menu_categories WHERE category_id = ? AND client_id = ?', [id, clientId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found' });

    await db.execute(
      'UPDATE menu_categories SET name = ?, image_url = ? WHERE category_id = ? AND client_id = ?',
      [name !== undefined ? name : rows[0].name, image_url !== undefined ? image_url : rows[0].image_url, id, clientId]
    );
    res.json({ message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/menu/categories/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    await db.execute('UPDATE menu_categories SET active = 0 WHERE category_id = ? AND client_id = ?', [id, clientId]);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────
// 🍕 MENU ITEMS
// ─────────────────────────────────────────────────────────────────────────

router.get('/menu/items', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const [rows] = await db.execute(
      `SELECT mi.*, mc.name AS category_name 
       FROM menu_items mi
       LEFT JOIN menu_categories mc ON mi.category_id = mc.category_id
       WHERE mi.client_id = ? AND mi.active = 1 
       ORDER BY mi.name`,
      [clientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/menu/items', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { category_id, name, description, price, image_url, preparation_time, kitchen_dept, gst_percent, is_veg } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'Name and price are required' });

    const [result] = await db.execute(
      `INSERT INTO menu_items 
       (client_id, category_id, name, description, price, image_url, preparation_time, kitchen_dept, gst_percent, is_veg) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        category_id || null,
        name,
        description || '',
        price,
        image_url || null,
        preparation_time || 10,
        kitchen_dept || 'Hot Kitchen',
        gst_percent || 5.00,
        is_veg !== undefined ? (is_veg ? 1 : 0) : 1
      ]
    );

    res.status(201).json({ menu_item_id: result.insertId, message: 'Menu Item created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/menu/items/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { category_id, name, description, price, image_url, preparation_time, kitchen_dept, gst_percent, is_veg, available } = req.body;

    const [rows] = await db.execute('SELECT * FROM menu_items WHERE menu_item_id = ? AND client_id = ?', [id, clientId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Menu item not found' });

    await db.execute(
      `UPDATE menu_items 
       SET category_id = ?, name = ?, description = ?, price = ?, image_url = ?, 
           preparation_time = ?, kitchen_dept = ?, gst_percent = ?, is_veg = ?, available = ?
       WHERE menu_item_id = ? AND client_id = ?`,
      [
        category_id !== undefined ? category_id : rows[0].category_id,
        name !== undefined ? name : rows[0].name,
        description !== undefined ? description : rows[0].description,
        price !== undefined ? price : rows[0].price,
        image_url !== undefined ? image_url : rows[0].image_url,
        preparation_time !== undefined ? preparation_time : rows[0].preparation_time,
        kitchen_dept !== undefined ? kitchen_dept : rows[0].kitchen_dept,
        gst_percent !== undefined ? gst_percent : rows[0].gst_percent,
        is_veg !== undefined ? (is_veg ? 1 : 0) : rows[0].is_veg,
        available !== undefined ? (available ? 1 : 0) : rows[0].available,
        id,
        clientId
      ]
    );

    res.json({ message: 'Menu item updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/menu/items/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    await db.execute('UPDATE menu_items SET active = 0 WHERE menu_item_id = ? AND client_id = ?', [id, clientId]);
    res.json({ message: 'Menu item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────
// 🔔 ORDERS & KITCHEN ORDERS (KDS)
// ─────────────────────────────────────────────────────────────────────────

// Get all orders
router.get('/orders', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const [rows] = await db.execute(
      `SELECT ro.*, rt.table_no, rt.section, c.name AS customer_name, u.username AS waiter_name
       FROM restaurant_orders ro
       LEFT JOIN restaurant_tables rt ON ro.table_id = rt.table_id
       LEFT JOIN customers c ON ro.customer_id = c.customer_id
       LEFT JOIN users u ON ro.waiter_id = u.user_id
       WHERE ro.client_id = ?
       ORDER BY ro.order_id DESC`,
      [clientId]
    );

    // Fetch items for each order
    for (let order of rows) {
      const [items] = await db.execute(
        `SELECT roi.*, mi.name AS item_name, mi.price AS menu_price
         FROM restaurant_order_items roi
         JOIN menu_items mi ON roi.menu_item_id = mi.menu_item_id
         WHERE roi.order_id = ?`,
        [order.order_id]
      );
      order.items = items;
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Order (Dine-in / Takeaway / Delivery)
router.post('/orders', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { table_id, customer_id, waiter_id, order_type, items, notes } = req.body;

    // Create main order record
    const [result] = await db.execute(
      `INSERT INTO restaurant_orders (client_id, table_id, customer_id, waiter_id, order_type, status, total, notes) 
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
      [clientId, table_id || null, customer_id || null, waiter_id || null, order_type || 'dine-in', notes || '']
    );

    const orderId = result.insertId;

    // If table is dine-in, set table status to 'occupied'
    if (table_id && order_type === 'dine-in') {
      await db.execute('UPDATE restaurant_tables SET status = ? WHERE table_id = ?', ['occupied', table_id]);
    }

    // Insert order items
    let grandTotal = 0;
    if (items && items.length > 0) {
      for (let item of items) {
        const [menuItem] = await db.execute('SELECT price FROM menu_items WHERE menu_item_id = ?', [item.menu_item_id]);
        if (menuItem.length > 0) {
          const itemPrice = parseFloat(menuItem[0].price);
          const itemQty = parseFloat(item.quantity || 1);
          grandTotal += itemPrice * itemQty;

          await db.execute(
            `INSERT INTO restaurant_order_items (order_id, menu_item_id, quantity, price, status, notes) 
             VALUES (?, ?, ?, ?, 'pending', ?)`,
            [orderId, item.menu_item_id, itemQty, itemPrice, item.notes || '']
          );
        }
      }

      // Update total on order
      await db.execute('UPDATE restaurant_orders SET total = ? WHERE order_id = ?', [grandTotal, orderId]);
    }

    // Broadcast new order to KDS queue
    eventBus.emit('broadcast', { type: 'NEW_ORDER', client_id: clientId, order_id: orderId });

    res.status(201).json({ order_id: orderId, total: grandTotal, message: 'Order placed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add items to existing order (KOT Addition)
router.post('/orders/:id/items', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { items } = req.body;

    const [order] = await db.execute('SELECT * FROM restaurant_orders WHERE order_id = ? AND client_id = ?', [id, clientId]);
    if (order.length === 0) return res.status(404).json({ error: 'Order not found' });

    let orderTotal = parseFloat(order[0].total || 0);

    if (items && items.length > 0) {
      for (let item of items) {
        const [menuItem] = await db.execute('SELECT price FROM menu_items WHERE menu_item_id = ?', [item.menu_item_id]);
        if (menuItem.length > 0) {
          const itemPrice = parseFloat(menuItem[0].price);
          const itemQty = parseFloat(item.quantity || 1);
          orderTotal += itemPrice * itemQty;

          await db.execute(
            `INSERT INTO restaurant_order_items (order_id, menu_item_id, quantity, price, status, notes) 
             VALUES (?, ?, ?, ?, 'pending', ?)`,
            [id, item.menu_item_id, itemQty, itemPrice, item.notes || '']
          );
        }
      }

      // Update total on order
      await db.execute('UPDATE restaurant_orders SET total = ?, status = ? WHERE order_id = ?', [orderTotal, 'accepted', id]);
    }

    // Broadcast order update to KDS queue
    eventBus.emit('broadcast', { type: 'KOT_ADDED', client_id: clientId, order_id: id });

    res.json({ order_id: id, total: orderTotal, message: 'KOT items appended' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order level status
router.put('/orders/:id/status', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { status } = req.body; // pending/accepted/preparing/ready/served/billed/cancelled

    const [rows] = await db.execute('SELECT * FROM restaurant_orders WHERE order_id = ? AND client_id = ?', [id, clientId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    await db.execute('UPDATE restaurant_orders SET status = ? WHERE order_id = ?', [status, id]);

    // If order is completed (served/billed) or cancelled, release the table status
    if (status === 'billed' || status === 'cancelled') {
      if (rows[0].table_id) {
        await db.execute('UPDATE restaurant_tables SET status = ? WHERE table_id = ?', ['available', rows[0].table_id]);
      }
    }

    eventBus.emit('broadcast', { type: 'ORDER_STATUS_CHANGED', client_id: clientId, order_id: id, status });

    res.json({ message: 'Order status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update KOT Item preparation status (KDS Action)
router.put('/orders/items/:itemId/status', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { itemId } = req.params;
    const { status, chef_id } = req.body; // pending/preparing/ready/served

    const [itemRows] = await db.execute(
      `SELECT roi.*, ro.client_id 
       FROM restaurant_order_items roi
       JOIN restaurant_orders ro ON roi.order_id = ro.order_id
       WHERE roi.id = ? AND ro.client_id = ?`,
      [itemId, clientId]
    );

    if (itemRows.length === 0) return res.status(404).json({ error: 'Order item not found' });

    await db.execute(
      'UPDATE restaurant_order_items SET status = ?, chef_id = ? WHERE id = ?',
      [status, chef_id || null, itemId]
    );

    // Notify KDS UI about change
    eventBus.emit('broadcast', { type: 'KDS_ITEM_UPDATED', client_id: clientId, order_id: itemRows[0].order_id });

    res.json({ message: 'Item status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KDS live queue list
router.get('/kitchen/queue', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const [rows] = await db.execute(
      `SELECT roi.*, mi.name AS item_name, mi.kitchen_dept, ro.table_id, rt.table_no, ro.order_type, ro.created_date AS order_time
       FROM restaurant_order_items roi
       JOIN restaurant_orders ro ON roi.order_id = ro.order_id
       JOIN menu_items mi ON roi.menu_item_id = mi.menu_item_id
       LEFT JOIN restaurant_tables rt ON ro.table_id = rt.table_id
       WHERE ro.client_id = ? AND roi.status IN ('pending', 'preparing')
       ORDER BY ro.order_id ASC, roi.id ASC`,
      [clientId]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────
// 📱 PUBLIC QR CODE ORDERING (No Authentication Required)
// ─────────────────────────────────────────────────────────────────────────

// Get menu for a table from QR Token
router.get('/public/menu/:qr_token', async (req, res) => {
  try {
    const { qr_token } = req.params;

    // Resolve client_id and table details from qr_token
    const [tables] = await db.execute('SELECT * FROM restaurant_tables WHERE qr_token = ? AND active = 1', [qr_token]);
    if (tables.length === 0) return res.status(404).json({ error: 'Invalid QR code table' });

    const clientId = tables[0].client_id;

    // Fetch client metadata (Name and logo)
    const [clientRows] = await db.execute('SELECT name, logo_url, address FROM clients WHERE client_id = ?', [clientId]);
    if (clientRows.length === 0) return res.status(404).json({ error: 'Client not found' });

    // Fetch active menu categories
    const [categories] = await db.execute('SELECT * FROM menu_categories WHERE client_id = ? AND active = 1 ORDER BY name', [clientId]);

    // Fetch active and available menu items
    const [items] = await db.execute(
      'SELECT * FROM menu_items WHERE client_id = ? AND active = 1 AND available = 1 ORDER BY name',
      [clientId]
    );

    res.json({
      client: clientRows[0],
      table: {
        table_id: tables[0].table_id,
        table_no: tables[0].table_no,
        section: tables[0].section
      },
      categories,
      menu: items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Place customer self-order from QR
router.post('/public/order/:qr_token', async (req, res) => {
  try {
    const { qr_token } = req.params;
    const { items, customer_name, customer_phone, notes } = req.body;

    const [tables] = await db.execute('SELECT * FROM restaurant_tables WHERE qr_token = ? AND active = 1', [qr_token]);
    if (tables.length === 0) return res.status(404).json({ error: 'Invalid QR code' });

    const clientId = tables[0].client_id;
    const tableId = tables[0].table_id;

    // Check if customer phone is provided and create/resolve customer ID
    let customerId = null;
    if (customer_phone) {
      const [existing] = await db.execute('SELECT customer_id FROM customers WHERE phone = ? AND client_id = ?', [customer_phone, clientId]);
      if (existing.length > 0) {
        customerId = existing[0].customer_id;
      } else {
        const [custInsert] = await db.execute(
          'INSERT INTO customers (client_id, name, phone, created_by) VALUES (?, ?, ?, ?)',
          [clientId, customer_name || 'Dine-in Guest', customer_phone, 'QR Self-Order']
        );
        customerId = custInsert.insertId;
      }
    }

    // Insert order in 'pending' status
    const [result] = await db.execute(
      `INSERT INTO restaurant_orders (client_id, table_id, customer_id, order_type, status, total, notes, created_by) 
       VALUES (?, ?, ?, 'qr', 'pending', 0, ?, 'QR Customer')`,
      [clientId, tableId, customerId, notes || '']
    );

    const orderId = result.insertId;

    // Set table status to occupied
    await db.execute('UPDATE restaurant_tables SET status = ? WHERE table_id = ?', ['occupied', tableId]);

    // Insert items
    let grandTotal = 0;
    if (items && items.length > 0) {
      for (let item of items) {
        const [menuItem] = await db.execute('SELECT price FROM menu_items WHERE menu_item_id = ? AND client_id = ?', [item.menu_item_id, clientId]);
        if (menuItem.length > 0) {
          const itemPrice = parseFloat(menuItem[0].price);
          const itemQty = parseFloat(item.quantity || 1);
          grandTotal += itemPrice * itemQty;

          await db.execute(
            `INSERT INTO restaurant_order_items (order_id, menu_item_id, quantity, price, status, notes) 
             VALUES (?, ?, ?, ?, 'pending', ?)`,
            [orderId, item.menu_item_id, itemQty, itemPrice, item.notes || '']
          );
        }
      }

      // Update total on order
      await db.execute('UPDATE restaurant_orders SET total = ? WHERE order_id = ?', [grandTotal, orderId]);
    }

    // Notify KDS of new QR self-order
    eventBus.emit('broadcast', { type: 'NEW_QR_ORDER', client_id: clientId, order_id: orderId });

    res.status(201).json({ order_id: orderId, total: grandTotal, message: 'QR Self-order placed successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
