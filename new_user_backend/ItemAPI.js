const express = require('express');
const db = require('./db');
const { resolveImageForStorage, decorateItem, deleteStoredImage } = require('./imageStore');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (!cid || cid === 'null' || cid === 'undefined') return null;
  return parseInt(cid);
}

/**
 * POST /api/items
 * Registers a new inventory item.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.ItemModel || req.body || {};
    const clientId = getClientId(req);
    
    if (!clientId) {
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
    const visible = data.visible !== undefined ? data.visible : 1;
    const base_quantity = data.base_quantity !== undefined ? data.base_quantity : (data.baseQuantity !== undefined ? data.baseQuantity : 1.00);
    const weight_measurement = data.weight_measurement !== undefined ? data.weight_measurement : (data.weightMeasurement !== undefined ? data.weightMeasurement : 'none');

    if (!name || sales_price === null || purchase_price === null) {
      return res.status(400).json({
        error: 'Missing required fields. Please ensure name, sales_price, and purchase_price are provided.'
      });
    }

    // Duplicate Check
    const nameCheck = name.trim().toLowerCase();
    const codeCheck = code && code.trim().length > 0 ? code.trim() : null;

    let duplicateCheckQuery = 'SELECT * FROM items WHERE (LOWER(name) = ?';
    let duplicateCheckValues = [nameCheck];
    if (codeCheck) {
      duplicateCheckQuery += ' OR code = ?';
      duplicateCheckValues.push(codeCheck);
    }
    duplicateCheckQuery += ') AND client_id = ?';
    duplicateCheckValues.push(clientId);

    const [existing] = await db.execute(duplicateCheckQuery, duplicateCheckValues);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This item is already added.' });
    }

    const query = `
      INSERT INTO items (
        client_id, name, short_name, long_name, description, code, image,
        sales_price, purchase_price, editable_price, visible, 
        tax_id, category_id, unit_id, base_quantity, weight_measurement,
        active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      clientId,
      name,
      short_name,
      long_name,
      description,
      code || null,
      image,
      sales_price,
      purchase_price,
      editable_price ? 1 : 0,
      visible ? 1 : 0,
      tax_id,
      category_id,
      unit_id,
      base_quantity,
      weight_measurement,
      active ? 1 : 0,
      created_by
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
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const query = `
      SELECT 
        i.*,
        c.name AS category_name,
        u.name AS unit_name,
        t.name AS tax_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN units u ON i.unit_id = u.unit_id
      LEFT JOIN taxes t ON i.tax_id = t.tax_id
      WHERE i.client_id = ?
      ORDER BY i.item_id ASC
    `;

    const [rows] = await db.query(query, [clientId]);

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
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const query = `
      SELECT 
        i.*,
        c.name AS category_name,
        u.name AS unit_name,
        t.name AS tax_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN units u ON i.unit_id = u.unit_id
      LEFT JOIN taxes t ON i.tax_id = t.tax_id
      WHERE i.item_id = ? AND i.client_id = ?
    `;

    const [rows] = await db.execute(query, [itemId, clientId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const r = rows[0];
    res.json({
      ...decorateItem(r, req),
      id: r.item_id,
      acitve: r.active,
      desciption: r.description
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/items/:id
 * Updates details for a specific item.
 */
router.put('/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body.ItemModel || req.body || {};

    const { name, code } = data;
    const description = data.description !== undefined ? data.description : data.desciption;
    const sales_price = data.sales_price !== undefined ? data.sales_price : data.salesPrice;
    const purchase_price = data.purchase_price !== undefined ? data.purchase_price : data.purchasePrice;
    
    const parseId = (val) => {
      if (val === null || val === '' || val === 'null' || val === 0 || val === '0') return null;
      return parseInt(val);
    };

    const tax_id = data.tax_id !== undefined ? parseId(data.tax_id) : (data.taxId !== undefined ? parseId(data.taxId) : undefined);
    const category_id = data.category_id !== undefined ? parseId(data.category_id) : (data.categoryId !== undefined ? parseId(data.categoryId) : undefined);
    const unit_id = data.unit_id !== undefined ? parseId(data.unit_id) : (data.unitId !== undefined ? parseId(data.unitId) : undefined);
    
    const active = data.active !== undefined ? data.active : data.acitve;

    // Advanced fields
    const short_name = data.short_name !== undefined ? data.short_name : data.shortName;
    const long_name = data.long_name !== undefined ? data.long_name : data.longName;
    const image = data.image !== undefined ? data.image : undefined;
    const editable_price = data.editable_price !== undefined ? data.editable_price : data.editablePrice;
    const visible = data.visible;
    const base_quantity = data.base_quantity !== undefined ? data.base_quantity : data.baseQuantity;
    const weight_measurement = data.weight_measurement !== undefined ? data.weight_measurement : data.weightMeasurement;

    const [rows] = await db.execute('SELECT * FROM items WHERE item_id = ? AND client_id = ?', [itemId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const existing = rows[0];

    const finalName = name !== undefined ? name : existing.name;
    const finalDescription = description !== undefined ? description : existing.description;
    const finalCode = code !== undefined ? code : existing.code;
    const finalSalesPrice = sales_price !== undefined ? sales_price : existing.sales_price;
    const finalPurchasePrice = purchase_price !== undefined ? purchase_price : existing.purchase_price;
    
    const finalTaxId = tax_id !== undefined ? tax_id : existing.tax_id;
    const finalCategoryId = category_id !== undefined ? category_id : existing.category_id;
    const finalUnitId = unit_id !== undefined ? unit_id : existing.unit_id;
    
    const finalActive = active !== undefined ? (active ? 1 : 0) : existing.active;

    // Advanced updates
    const finalShortName = short_name !== undefined ? short_name : existing.short_name;
    const finalLongName = long_name !== undefined ? long_name : existing.long_name;
    const finalImage = await resolveImageForStorage(image, existing.image, req);
    const finalEditablePrice = editable_price !== undefined ? (editable_price ? 1 : 0) : existing.editable_price;
    const finalVisible = visible !== undefined ? (visible ? 1 : 0) : existing.visible;
    const finalBaseQuantity = base_quantity !== undefined ? base_quantity : existing.base_quantity;
    const finalWeightMeasurement = weight_measurement !== undefined ? weight_measurement : existing.weight_measurement;

    // Duplicate Check
    const nameCheck = finalName ? finalName.trim().toLowerCase() : '';
    const codeCheck = finalCode && finalCode.trim().length > 0 ? finalCode.trim() : null;

    let duplicateCheckQuery = 'SELECT * FROM items WHERE (LOWER(name) = ?';
    let duplicateCheckValues = [nameCheck];
    if (codeCheck) {
      duplicateCheckQuery += ' OR code = ?';
      duplicateCheckValues.push(codeCheck);
    }
    duplicateCheckQuery += ') AND item_id != ? AND client_id = ?';
    duplicateCheckValues.push(itemId, clientId);

    const [existingDup] = await db.execute(duplicateCheckQuery, duplicateCheckValues);
    if (existingDup.length > 0) {
      return res.status(400).json({ error: 'This item is already added.' });
    }

    const query = `
      UPDATE items SET 
        name = ?, short_name = ?, long_name = ?, description = ?, code = ?, image = ?,
        sales_price = ?, purchase_price = ?, editable_price = ?, visible = ?, 
        tax_id = ?, category_id = ?, unit_id = ?, base_quantity = ?, weight_measurement = ?,
        active = ?
      WHERE item_id = ? AND client_id = ?
    `;

    await db.execute(query, [
      finalName,
      finalShortName,
      finalLongName,
      finalDescription,
      finalCode,
      finalImage,
      finalSalesPrice,
      finalPurchasePrice,
      finalEditablePrice,
      finalVisible,
      finalTaxId,
      finalCategoryId,
      finalUnitId,
      finalBaseQuantity,
      finalWeightMeasurement,
      finalActive,
      itemId,
      clientId
    ]);

    if (finalImage !== existing.image) {
      deleteStoredImage(existing.image);
    }

    res.json({ message: 'Item updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/items/:id
 * Deletes a specific item and shifts subsequent IDs down.
 */
router.delete('/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const [rows] = await db.execute('SELECT * FROM items WHERE item_id = ? AND client_id = ?', [itemId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const imageToDelete = rows[0].image;

    await db.execute('DELETE FROM items WHERE item_id = ? AND client_id = ?', [itemId, clientId]);
    deleteStoredImage(imageToDelete);

    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
