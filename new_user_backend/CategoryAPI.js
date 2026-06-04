const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * POST /api/categories
 * Registers a new category.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.CategoryModel || req.body;

    const { name } = data;

    // Resolve flexible parameters for active state and created_by
    const active = data.active !== undefined ? data.active : (data.acitve !== undefined ? data.acitve : 1);
    const created_by = data.created_by || data.createdBy || 'System';

    if (!name) {
      return res.status(400).json({
        error: 'Missing required fields. Please ensure name is provided.'
      });
    }

    const query = `
      INSERT INTO categories (name, active, created_by)
      VALUES (?, ?, ?)
    `;

    const values = [
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
    const [rows] = await db.query('SELECT * FROM categories ORDER BY category_id ASC');
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
    const [rows] = await db.execute('SELECT * FROM categories WHERE category_id = ?', [categoryId]);
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
    const data = req.body.CategoryModel || req.body;

    const { name } = data;
    const active = data.active !== undefined ? data.active : data.acitve;

    const [rows] = await db.execute('SELECT * FROM categories WHERE category_id = ?', [categoryId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const existingCategory = rows[0];
    const finalName = name !== undefined ? name : existingCategory.name;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingCategory.active;

    const query = `
      UPDATE categories SET name = ?, active = ?
      WHERE category_id = ?
    `;

    await db.execute(query, [finalName, finalActive, categoryId]);

    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/categories/:id
 * Deletes a specific category by ID and shifts subsequent IDs down.
 */
router.delete('/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);

    const [rows] = await db.execute('SELECT * FROM categories WHERE category_id = ?', [categoryId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM categories WHERE category_id = ?', [categoryId]);
    await db.execute('UPDATE categories SET category_id = category_id - 1 WHERE category_id > ?', [categoryId]);
    await db.execute('ALTER TABLE categories AUTO_INCREMENT = 1');
    await db.query('COMMIT');

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

