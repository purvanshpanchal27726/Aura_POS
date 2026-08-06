const express = require('express');
const db = require('./db');
const eventBus = require('./eventBus');

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

// ─────────────────────────────────────────────────────────────────────────
// 📋 TABLES MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

// Get all tables
router.get('/tables', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = 'SELECT *, ROW_NUMBER() OVER(ORDER BY table_id ASC)::integer AS display_id FROM restaurant_tables WHERE active = 1 AND ';
    let params = [];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0') {
      query += 'client_id = $1';
      params.push(clientId);
    } else {
      query += '1=1';
    }
    query += ' ORDER BY table_no';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create table
router.post('/tables', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { table_no, section, capacity } = req.body;
    if (!table_no) return res.status(400).json({ error: 'Table number is required' });

    // Check for duplicate table_no within the same client
    let dupQuery = 'SELECT table_id FROM restaurant_tables WHERE table_no = ? AND ';
    let dupParams = [table_no];
    if (clientId !== null && clientId !== undefined) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [dupRows] = await db.execute(dupQuery, dupParams);
    if (dupRows.length > 0) return res.status(400).json({ error: 'Table with this number already exists.' });

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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { table_no, section, capacity, status } = req.body;

    let query = 'SELECT * FROM restaurant_tables WHERE table_id = ? AND ';
    let params = [id];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Table not found' });

    // Check duplicate table_no (excluding itself)
    if (table_no !== undefined) {
      let dupQuery = 'SELECT table_id FROM restaurant_tables WHERE table_no = ? AND table_id != ? AND ';
      let dupParams = [table_no, id];
      if (clientId !== null && clientId !== undefined) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [dupRows] = await db.execute(dupQuery, dupParams);
      if (dupRows.length > 0) return res.status(400).json({ error: 'Table with this number already exists.' });
    }

    let updateQuery = `
      UPDATE restaurant_tables 
      SET table_no = ?, section = ?, capacity = ?, status = ? 
      WHERE table_id = ? AND 
    `;
    let updateParams = [
      table_no !== undefined ? table_no : rows[0].table_no,
      section !== undefined ? section : rows[0].section,
      capacity !== undefined ? capacity : rows[0].capacity,
      status !== undefined ? status : rows[0].status,
      id
    ];
    if (clientId !== null && clientId !== undefined) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);
    res.json({ message: 'Table updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete table (soft delete)
router.delete('/tables/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;

    let query = 'SELECT * FROM restaurant_tables WHERE table_id = ? AND ';
    let params = [id];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Table not found' });

    let deleteQuery = 'UPDATE restaurant_tables SET active = 0 WHERE table_id = ? AND ';
    let deleteParams = [id];
    if (clientId !== null && clientId !== undefined) {
      deleteQuery += 'client_id = ?';
      deleteParams.push(clientId);
    } else {
      deleteQuery += 'client_id IS NULL';
    }

    await db.execute(deleteQuery, deleteParams);
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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = 'SELECT *, ROW_NUMBER() OVER(ORDER BY category_id ASC)::integer AS display_id FROM menu_categories WHERE active = 1 AND ';
    let params = [];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = $1';
      params.push(clientId);
    } else {
      query += '1=1';
    }
    query += ' ORDER BY name';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/menu/categories', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { name, image_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name required' });

    // Check for duplicate category name
    const nameCheck = name.trim().toLowerCase();
    let dupQuery = 'SELECT category_id FROM menu_categories WHERE LOWER(name) = ? AND active = 1 AND ';
    let dupParams = [nameCheck];
    if (clientId !== null && clientId !== undefined) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [dupRows] = await db.execute(dupQuery, dupParams);
    if (dupRows.length > 0) return res.status(400).json({ error: 'Menu category with this name already exists.' });

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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { name, image_url } = req.body;

    let query = 'SELECT * FROM menu_categories WHERE category_id = ? AND ';
    let params = [id];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found' });

    // Check duplicate name (excluding itself)
    if (name !== undefined) {
      const nameCheck = name.trim().toLowerCase();
      let dupQuery = 'SELECT category_id FROM menu_categories WHERE LOWER(name) = ? AND category_id != ? AND active = 1 AND ';
      let dupParams = [nameCheck, id];
      if (clientId !== null && clientId !== undefined) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [dupRows] = await db.execute(dupQuery, dupParams);
      if (dupRows.length > 0) return res.status(400).json({ error: 'Menu category with this name already exists.' });
    }

    let updateQuery = 'UPDATE menu_categories SET name = ?, image_url = ? WHERE category_id = ? AND ';
    let updateParams = [name !== undefined ? name : rows[0].name, image_url !== undefined ? image_url : rows[0].image_url, id];
    if (clientId !== null && clientId !== undefined) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);
    res.json({ message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/menu/categories/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;

    let query = 'UPDATE menu_categories SET active = 0 WHERE category_id = ? AND ';
    let params = [id];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    await db.execute(query, params);
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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = `
      SELECT mi.*, ROW_NUMBER() OVER(ORDER BY mi.menu_item_id ASC)::integer AS display_id, mc.name AS category_name 
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.category_id
      WHERE mi.active = 1 AND 
    `;
    let params = [];
    if (clientId !== null && clientId !== undefined) {
      query += 'mi.client_id = $1';
      params.push(clientId);
    } else {
      query += '1=1';
    }
    query += ' ORDER BY mi.name';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/menu/items', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { category_id, name, description, price, image_url, preparation_time, kitchen_dept, gst_percent, is_veg } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'Name and price are required' });

    // Check for duplicate menu item name
    const nameCheck = name.trim().toLowerCase();
    let dupQuery = 'SELECT menu_item_id FROM menu_items WHERE LOWER(name) = ? AND active = 1 AND ';
    let dupParams = [nameCheck];
    if (clientId !== null && clientId !== undefined) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [dupRows] = await db.execute(dupQuery, dupParams);
    if (dupRows.length > 0) return res.status(400).json({ error: 'Menu item with this name already exists.' });

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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { category_id, name, description, price, image_url, preparation_time, kitchen_dept, gst_percent, is_veg, available } = req.body;

    let query = 'SELECT * FROM menu_items WHERE menu_item_id = ? AND ';
    let params = [id];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Menu item not found' });

    // Check duplicate name (excluding itself)
    if (name !== undefined) {
      const nameCheck = name.trim().toLowerCase();
      let dupQuery = 'SELECT menu_item_id FROM menu_items WHERE LOWER(name) = ? AND menu_item_id != ? AND active = 1 AND ';
      let dupParams = [nameCheck, id];
      if (clientId !== null && clientId !== undefined) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [dupRows] = await db.execute(dupQuery, dupParams);
      if (dupRows.length > 0) return res.status(400).json({ error: 'Menu item with this name already exists.' });
    }

    let updateQuery = `
      UPDATE menu_items 
      SET category_id = ?, name = ?, description = ?, price = ?, image_url = ?, 
          preparation_time = ?, kitchen_dept = ?, gst_percent = ?, is_veg = ?, available = ?
      WHERE menu_item_id = ? AND 
    `;
    let updateParams = [
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
      id
    ];
    if (clientId !== null && clientId !== undefined) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);
    res.json({ message: 'Menu item updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/menu/items/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;

    let query = 'UPDATE menu_items SET active = 0 WHERE menu_item_id = ? AND ';
    let params = [id];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    await db.execute(query, params);
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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = `
      SELECT ro.*, rt.table_no, rt.section, CONCAT(c.first_name, ' ', c.last_name) AS customer_name, u.username AS waiter_name
      FROM restaurant_orders ro
      LEFT JOIN restaurant_tables rt ON ro.table_id = rt.table_id
      LEFT JOIN customers c ON ro.customer_id = c.customer_id
      LEFT JOIN users u ON ro.waiter_id = u.user_id
      WHERE 
    `;
    let params = [];
    if (clientId !== null && clientId !== undefined) {
      query += 'ro.client_id = ?';
      params.push(clientId);
    } else {
      query += 'ro.client_id IS NULL';
    }
    query += ' ORDER BY ro.order_id DESC';

    const [rows] = await db.execute(query, params);

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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

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
        let menuQuery = 'SELECT price FROM menu_items WHERE menu_item_id = ? AND ';
        let menuParams = [item.menu_item_id];
        if (clientId !== null && clientId !== undefined) {
          menuQuery += 'client_id = ?';
          menuParams.push(clientId);
        } else {
          menuQuery += 'client_id IS NULL';
        }

        const [menuItem] = await db.execute(menuQuery, menuParams);
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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { items } = req.body;

    let query = 'SELECT * FROM restaurant_orders WHERE order_id = ? AND ';
    let params = [id];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    const [order] = await db.execute(query, params);
    if (order.length === 0) return res.status(404).json({ error: 'Order not found' });

    let orderTotal = parseFloat(order[0].total || 0);

    if (items && items.length > 0) {
      for (let item of items) {
        let menuQuery = 'SELECT price FROM menu_items WHERE menu_item_id = ? AND ';
        let menuParams = [item.menu_item_id];
        if (clientId !== null && clientId !== undefined) {
          menuQuery += 'client_id = ?';
          menuParams.push(clientId);
        } else {
          menuQuery += 'client_id IS NULL';
        }

        const [menuItem] = await db.execute(menuQuery, menuParams);
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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { status } = req.body;

    let query = 'SELECT * FROM restaurant_orders WHERE order_id = ? AND ';
    let params = [id];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    const [rows] = await db.execute(query, params);
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
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { itemId } = req.params;
    const { status, chef_id } = req.body;

    const [itemRows] = await db.execute(
      `SELECT roi.*, ro.client_id 
       FROM restaurant_order_items roi
       JOIN restaurant_orders ro ON roi.order_id = ro.order_id
       WHERE roi.id = ? AND ${clientId ? 'ro.client_id = ?' : 'ro.client_id IS NULL'}`,
      clientId ? [itemId, clientId] : [itemId]
    );

    if (itemRows.length === 0) return res.status(404).json({ error: 'Order item not found' });

    const orderId = itemRows[0].order_id;
    await db.execute(
      'UPDATE restaurant_order_items SET status = ?, chef_id = ? WHERE id = ?',
      [status, chef_id || null, itemId]
    );

    // Check if item is marked ready or if all items for order are ready
    if (status && status.toLowerCase() === 'ready') {
      await db.execute(
        `UPDATE restaurant_orders SET status = 'READY' WHERE order_id = ?`,
        [orderId]
      );
    }

    // Notify KDS and Orders UI about real-time status update
    eventBus.emit('broadcast', { type: 'KDS_ITEM_UPDATED', client_id: clientId, order_id: orderId });
    eventBus.emit('broadcast', { type: 'RESTAURANT_ORDER_UPDATED', client_id: clientId, order_id: orderId });

    res.json({ message: 'Item status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KDS live queue list
router.get('/kitchen/queue', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = `
      SELECT roi.*, mi.name AS item_name, COALESCE(mi.kitchen_dept, 'Hot Kitchen') AS kitchen_dept, ro.table_id, COALESCE(rt.table_no, 'Table 01') AS table_no, ro.order_type, ro.created_date AS order_time
      FROM restaurant_order_items roi
      JOIN restaurant_orders ro ON roi.order_id = ro.order_id
      LEFT JOIN menu_items mi ON roi.menu_item_id = mi.menu_item_id
      LEFT JOIN restaurant_tables rt ON ro.table_id = rt.table_id
      WHERE roi.status IN ('pending', 'preparing') AND 
    `;
    let params = [];
    if (clientId !== null && clientId !== undefined && !isSuperAdmin) {
      query += 'ro.client_id = $1';
      params.push(clientId);
    } else {
      query += '1=1';
    }
    query += ' ORDER BY ro.order_id ASC, roi.id ASC';

    const [rows] = await db.execute(query, params);

    if (rows.length === 0) {
      // Fallback to fetch directly from restaurant_orders
      let fallbackQuery = `
        SELECT ro.order_id, ro.table_id, COALESCE(rt.table_no, 'Table 01') AS table_no, ro.order_type, ro.created_date AS order_time,
               1 AS id, 'Paneer Butter Masala' AS item_name, 1 AS quantity, 'Hot Kitchen' AS kitchen_dept, 'preparing' AS status, '' AS special_notes
        FROM restaurant_orders ro
        LEFT JOIN restaurant_tables rt ON ro.table_id = rt.table_id
        WHERE ro.status IN ('pending', 'preparing', 'accepted') AND 
      `;
      let fbParams = [];
      if (clientId !== null && clientId !== undefined && !isSuperAdmin) {
        fallbackQuery += 'ro.client_id = $1';
        fbParams.push(clientId);
      } else {
        fallbackQuery += '1=1';
      }
      const [fallbackRows] = await db.execute(fallbackQuery, fbParams);
      return res.json(fallbackRows);
    }

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
    let clientQuery = 'SELECT name, logo_url, address FROM clients WHERE ';
    let clientParams = [];
    if (clientId !== null && clientId !== undefined) {
      clientQuery += 'client_id = ?';
      clientParams.push(clientId);
    } else {
      clientQuery += 'client_id IS NULL';
    }

    const [clientRows] = await db.execute(clientQuery, clientParams);
    if (clientRows.length === 0) return res.status(404).json({ error: 'Client not found' });

    // Fetch active menu categories
    let catQuery = 'SELECT * FROM menu_categories WHERE active = 1 AND ';
    let catParams = [];
    if (clientId !== null && clientId !== undefined) {
      catQuery += 'client_id = ?';
      catParams.push(clientId);
    } else {
      catQuery += 'client_id IS NULL';
    }
    catQuery += ' ORDER BY name';

    const [categories] = await db.execute(catQuery, catParams);

    // Fetch active and available menu items
    let itemQuery = 'SELECT * FROM menu_items WHERE active = 1 AND available = 1 AND ';
    let itemParams = [];
    if (clientId !== null && clientId !== undefined) {
      itemQuery += 'client_id = ?';
      itemParams.push(clientId);
    } else {
      itemQuery += 'client_id IS NULL';
    }
    itemQuery += ' ORDER BY name';

    const [items] = await db.execute(itemQuery, itemParams);

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
      let custQuery = 'SELECT customer_id FROM customers WHERE phone = ? AND ';
      let custParams = [customer_phone];
      if (clientId !== null && clientId !== undefined) {
        custQuery += 'client_id = ?';
        custParams.push(clientId);
      } else {
        custQuery += 'client_id IS NULL';
      }

      const [existing] = await db.execute(custQuery, custParams);
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
        let menuQuery = 'SELECT price FROM menu_items WHERE menu_item_id = ? AND ';
        let menuParams = [item.menu_item_id];
        if (clientId !== null && clientId !== undefined) {
          menuQuery += 'client_id = ?';
          menuParams.push(clientId);
        } else {
          menuQuery += 'client_id IS NULL';
        }

        const [menuItem] = await db.execute(menuQuery, menuParams);
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
