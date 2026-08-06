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
 * POST /api/categories
 * Registers a new category.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.CategoryModel || req.body;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { name } = data;

    // Resolve flexible parameters for active state and created_by
    const active = data.active !== undefined ? data.active : (data.acitve !== undefined ? data.acitve : 1);
    const created_by = data.created_by || data.createdBy || 'System';

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required and cannot be blank.' });
    }

    // Duplicate Check
    const nameCheck = name.trim().toLowerCase();
    let dupQuery = 'SELECT * FROM categories WHERE LOWER(name) = ? AND ';
    let dupParams = [nameCheck];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0') {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [existing] = await db.execute(dupQuery, dupParams);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This category is already added.' });
    }

    const query = `
      INSERT INTO categories (client_id, name, active, created_by)
      VALUES (?, ?, ?, ?)
    `;

    const values = [
      clientId,
      name,
      active ? 1 : 0,
      created_by
    ];

    const [result] = await db.execute(query, values);

    res.status(201).json({
      message: 'Category created successfully',
      category_id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/categories
 * Fetches all registered categories.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = 'SELECT *, ROW_NUMBER() OVER(ORDER BY category_id ASC)::integer AS display_id FROM categories WHERE ';
    let params = [];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0') {
      query += 'client_id = $1';
      params.push(clientId);
    } else {
      query += '1=1';
    }
    query += ' ORDER BY category_id ASC';

    const [rows] = await db.execute(query, params);
    const mappedRows = rows.map(r => ({
      ...r,
      id: r.category_id,
      acitve: r.active
    }));
    res.json(mappedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/categories/:id
 * Fetches a single category by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = 'SELECT * FROM categories WHERE category_id = ? AND ';
    let params = [categoryId];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0') {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const r = rows[0];
    res.json({ ...r, id: r.category_id, acitve: r.active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/categories/:id
 * Updates details for a specific category.
 */
router.put('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body.CategoryModel || req.body;

    const { name } = data;
    const active = data.active !== undefined ? data.active : data.acitve;

    let queryExist = 'SELECT * FROM categories WHERE category_id = ? AND ';
    let paramsExist = [categoryId];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0') {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const existingCategory = rows[0];
    const finalName = name !== undefined ? name : existingCategory.name;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingCategory.active;

    // Duplicate Check
    if (name !== undefined) {
      const nameCheck = name.trim().toLowerCase();
      let dupQuery = 'SELECT * FROM categories WHERE LOWER(name) = ? AND category_id != ? AND ';
      let dupParams = [nameCheck, categoryId];
      if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0') {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [existingDup] = await db.execute(dupQuery, dupParams);
      if (existingDup.length > 0) {
        return res.status(400).json({ error: 'This category is already added.' });
      }
    }

    let updateQuery = 'UPDATE categories SET name = ?, active = ? WHERE category_id = ? AND ';
    let updateParams = [finalName, finalActive, categoryId];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0') {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);

    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/categories/:id
 * Deletes a specific category by ID.
 */
router.delete('/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let queryExist = 'SELECT * FROM categories WHERE category_id = ? AND ';
    let paramsExist = [categoryId];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0') {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    let deleteQuery = 'DELETE FROM categories WHERE category_id = ? AND ';
    let deleteParams = [categoryId];
    if (clientId !== null && clientId !== undefined && clientId !== 'ALL' && clientId !== 'all' && clientId !== '0') {
      deleteQuery += 'client_id = ?';
      deleteParams.push(clientId);
    } else {
      deleteQuery += 'client_id IS NULL';
    }

    await db.execute(deleteQuery, deleteParams);

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
