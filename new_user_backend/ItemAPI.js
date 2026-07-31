const express = require('express');
const db = require('./db');
const { resolveImageForStorage, decorateItem, deleteStoredImage } = require('./imageStore');

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
 * POST /api/items
 * Registers a new inventory item.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.ItemModel || req.body || {};
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { name, code } = data;
    
    // Resolve flexible parameters for spelling variations and camelCase/snake_case
    const description = data.description !== undefined ? data.description : (data.desciption !== undefined ? data.desciption : null);
    const sales_price = data.sales_price !== undefined ? data.sales_price : (data.salesPrice !== undefined ? data.salesPrice : null);
    const purchase_price = data.purchase_price !== undefined ? data.purchase_price : (data.purchasePrice !== undefined ? data.purchasePrice : null);
    
    const parseId = (val) => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 0 || val === '0') return null;
      return parseInt(val);
    };

    const tax_id = parseId(data.tax_id !== undefined ? data.tax_id : data.taxId);
    const category_id = parseId(data.category_id !== undefined ? data.category_id : data.categoryId);
    const unit_id = parseId(data.unit_id !== undefined ? data.unit_id : data.unitId);
    
    const active = data.active !== undefined ? data.active : (data.acitve !== undefined ? data.acitve : 1);
    const created_by = data.created_by || data.createdBy || 'System';

    // Advanced fields
    const short_name = data.short_name !== undefined ? data.short_name : (data.shortName !== undefined ? data.shortName : null);
    const long_name = data.long_name !== undefined ? data.long_name : (data.longName !== undefined ? data.longName : null);
    const image = await resolveImageForStorage(data.image !== undefined ? data.image : null, null, req);
    const editable_price = data.editable_price !== undefined ? data.editable_price : (data.editablePrice !== undefined ? data.editablePrice : 0);
    const pos_item = data.pos_item !== undefined ? data.pos_item : (data.posItem !== undefined ? data.posItem : 0);
    const show_in_restaurant = data.show_in_restaurant !== undefined ? data.show_in_restaurant : (data.showInRestaurant !== undefined ? data.showInRestaurant : 0);
    const is_hotel_service = data.is_hotel_service !== undefined ? data.is_hotel_service : (data.isHotelService !== undefined ? data.isHotelService : 0);

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required and cannot be blank.' });
    }
    const parsedSalesPrice = parseFloat(sales_price);
    const parsedPurchasePrice = parseFloat(purchase_price);
    if (isNaN(parsedSalesPrice) || parsedSalesPrice < 0) {
      return res.status(400).json({ error: 'Retail sales price must be a valid non-negative number.' });
    }
    if (purchase_price !== null && purchase_price !== undefined && (isNaN(parsedPurchasePrice) || parsedPurchasePrice < 0)) {
      return res.status(400).json({ error: 'Purchase price must be a valid non-negative number.' });
    }

    // Duplicate Check
    const nameCheck = name.trim().toLowerCase();
    let dupQuery = 'SELECT * FROM items WHERE LOWER(name) = ? AND ';
    let dupParams = [nameCheck];
    if (clientId !== null && clientId !== undefined) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [existing] = await db.execute(dupQuery, dupParams);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This item is already added.' });
    }

    let finalCode = code && String(code).trim() !== '' ? String(code).trim() : null;
    if (!finalCode) {
      const [countRes] = await db.execute('SELECT COUNT(*) AS count FROM items');
      const nextNum = parseInt(countRes[0].count) + 1;
      finalCode = `ITM-${String(nextNum).padStart(3, '0')}`;
    }

    const query = `
      INSERT INTO items (
        client_id, name, code, description, category_id, unit_id, tax_id, 
        sales_price, purchase_price, active, created_by,
        short_name, long_name, image, editable_price, pos_item, show_in_restaurant, is_hotel_service
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      clientId,
      name,
      finalCode,
      description,
      category_id,
      unit_id,
      tax_id,
      sales_price,
      purchase_price,
      active ? 1 : 0,
      created_by,
      short_name,
      long_name,
      image,
      editable_price ? 1 : 0,
      pos_item ? 1 : 0,
      show_in_restaurant ? 1 : 0,
      is_hotel_service ? 1 : 0
    ];

    const [result] = await db.execute(query, values);

    res.status(201).json({
      message: 'Item created successfully',
      item_id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/items
 * Fetches all items with joined category, unit, and tax names.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = `
      SELECT 
        i.*,
        ROW_NUMBER() OVER(ORDER BY i.item_id ASC)::integer AS display_id,
        c.name AS category_name,
        u.name AS unit_name,
        t.name AS tax_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN units u ON i.unit_id = u.unit_id
      LEFT JOIN taxes t ON i.tax_id = t.tax_id
      WHERE 
    `;
    let params = [];
    if (clientId !== null && clientId !== undefined) {
      query += 'i.client_id = $1';
      params.push(clientId);
    } else {
      if (isSuperAdmin) {
        query += '1=1';
      } else {
        query += '1=1';
      }
    }
    query += ' ORDER BY i.item_id ASC';

    const [rows] = await db.execute(query, params);

    const mappedRows = rows.map(r => ({
      ...decorateItem(r, req),
      id: r.item_id,
      acitve: r.active,
      desciption: r.description
    }));

    res.json(mappedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/items/:id
 * Fetches a single item by ID with references.
 */
router.get('/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = `
      SELECT 
        i.*,
        c.name AS category_name,
        u.name AS unit_name,
        t.name AS tax_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN units u ON i.unit_id = u.unit_id
      LEFT JOIN taxes t ON i.tax_id = t.tax_id
      WHERE i.item_id = ? AND 
    `;
    let params = [itemId];
    if (clientId !== null && clientId !== undefined) {
      query += 'i.client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({
      ...decorateItem(rows[0], req),
      id: rows[0].item_id,
      acitve: rows[0].active,
      desciption: rows[0].description
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/items/:id
 * Updates details for a specific inventory item.
 */
router.put('/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body.ItemModel || req.body || {};

    const { name, code } = data;
    const description = data.description !== undefined ? data.description : (data.desciption !== undefined ? data.desciption : undefined);
    const sales_price = data.sales_price !== undefined ? data.sales_price : (data.salesPrice !== undefined ? data.salesPrice : undefined);
    const purchase_price = data.purchase_price !== undefined ? data.purchase_price : (data.purchasePrice !== undefined ? data.purchasePrice : undefined);

    const parseId = (val) => {
      if (val === undefined) return undefined;
      if (val === null || val === '' || val === 'null' || val === 0 || val === '0') return null;
      return parseInt(val);
    };

    const tax_id = parseId(data.tax_id !== undefined ? data.tax_id : data.taxId);
    const category_id = parseId(data.category_id !== undefined ? data.category_id : data.categoryId);
    const unit_id = parseId(data.unit_id !== undefined ? data.unit_id : data.unitId);
    
    const active = data.active !== undefined ? data.active : data.acitve;
    
    // Advanced fields
    const short_name = data.short_name !== undefined ? data.short_name : (data.shortName !== undefined ? data.shortName : undefined);
    const long_name = data.long_name !== undefined ? data.long_name : (data.longName !== undefined ? data.longName : undefined);
    const editable_price = data.editable_price !== undefined ? data.editable_price : (data.editablePrice !== undefined ? data.editablePrice : undefined);
    const pos_item = data.pos_item !== undefined ? data.pos_item : (data.posItem !== undefined ? data.posItem : undefined);
    const show_in_restaurant = data.show_in_restaurant !== undefined ? data.show_in_restaurant : (data.showInRestaurant !== undefined ? data.showInRestaurant : undefined);
    const is_hotel_service = data.is_hotel_service !== undefined ? data.is_hotel_service : (data.isHotelService !== undefined ? data.isHotelService : undefined);

    let queryExist = 'SELECT * FROM items WHERE item_id = ? AND ';
    let paramsExist = [itemId];
    if (clientId !== null && clientId !== undefined) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const existingItem = rows[0];

    const finalName = name !== undefined ? name : existingItem.name;
    const finalCode = code !== undefined ? code : existingItem.code;
    const finalDescription = description !== undefined ? description : existingItem.description;
    const finalCategory = category_id !== undefined ? category_id : existingItem.category_id;
    const finalUnit = unit_id !== undefined ? unit_id : existingItem.unit_id;
    const finalTax = tax_id !== undefined ? tax_id : existingItem.tax_id;
    const finalSalesPrice = sales_price !== undefined ? sales_price : existingItem.sales_price;
    const finalPurchasePrice = purchase_price !== undefined ? purchase_price : existingItem.purchase_price;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingItem.active;

    const finalShortName = short_name !== undefined ? short_name : existingItem.short_name;
    const finalLongName = long_name !== undefined ? long_name : existingItem.long_name;
    const finalEditablePrice = editable_price !== undefined ? (editable_price ? 1 : 0) : existingItem.editable_price;
    const finalPosItem = pos_item !== undefined ? (pos_item ? 1 : 0) : existingItem.pos_item;
    const finalShowInRestaurant = show_in_restaurant !== undefined ? (show_in_restaurant ? 1 : 0) : existingItem.show_in_restaurant;
    const finalIsHotelService = is_hotel_service !== undefined ? (is_hotel_service ? 1 : 0) : existingItem.is_hotel_service;

    // Handle image update securely
    const finalImage = await resolveImageForStorage(data.image, existingItem.image, req);

    // Duplicate Check
    if (name !== undefined) {
      const nameCheck = name.trim().toLowerCase();
      let dupQuery = 'SELECT * FROM items WHERE LOWER(name) = ? AND item_id != ? AND ';
      let dupParams = [nameCheck, itemId];
      if (clientId !== null && clientId !== undefined) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [existingDup] = await db.execute(dupQuery, dupParams);
      if (existingDup.length > 0) {
        return res.status(400).json({ error: 'This item is already added.' });
      }
    }

    let updateQuery = `
      UPDATE items SET 
        name = ?, code = ?, description = ?, category_id = ?, unit_id = ?, tax_id = ?, 
        sales_price = ?, purchase_price = ?, active = ?,
        short_name = ?, long_name = ?, image = ?, editable_price = ?, pos_item = ?, 
        show_in_restaurant = ?, is_hotel_service = ?
      WHERE item_id = ? AND 
    `;
    let updateParams = [
      finalName, finalCode, finalDescription, finalCategory, finalUnit, finalTax,
      finalSalesPrice, finalPurchasePrice, finalActive,
      finalShortName, finalLongName, finalImage, finalEditablePrice, finalPosItem,
      finalShowInRestaurant, finalIsHotelService,
      itemId
    ];
    if (clientId !== null && clientId !== undefined) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);

    res.json({ message: 'Item updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/items/:id
 * Deletes a specific item.
 */
router.delete('/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let queryExist = 'SELECT * FROM items WHERE item_id = ? AND ';
    let paramsExist = [itemId];
    if (clientId !== null && clientId !== undefined) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const imageToDelete = rows[0].image;

    let deleteQuery = 'DELETE FROM items WHERE item_id = ? AND ';
    let deleteParams = [itemId];
    if (clientId !== null && clientId !== undefined) {
      deleteQuery += 'client_id = ?';
      deleteParams.push(clientId);
    } else {
      deleteQuery += 'client_id IS NULL';
    }

    await db.execute(deleteQuery, deleteParams);
    deleteStoredImage(imageToDelete);

    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
