const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * POST /api/taxes
 * Registers a new tax.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.TaxModel || req.body;
    
    const { name, percentage } = data;
    const finalPercentage = percentage !== undefined ? parseFloat(percentage) : 0.00;
    
    // Resolve flexible parameters for active state and created_by
    const active = data.active !== undefined ? data.active : (data.acitve !== undefined ? data.acitve : 1);
    const created_by = data.created_by || data.createdBy || 'System';

    if (!name) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please ensure name is provided.' 
      });
    }

    const query = `
      INSERT INTO taxes (name, percentage, active, created_by)
      VALUES (?, ?, ?, ?)
    `;

    const values = [
      name,
      finalPercentage,
      active ? 1 : 0,
      created_by
    ];

    const [result] = await db.execute(query, values);
    
    res.status(201).json({
      message: 'Tax created successfully',
      tax_id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/taxes
 * Fetches all registered taxes.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM taxes ORDER BY tax_id ASC');
    // Map response to also include id alias for client flexibility
    const mappedRows = rows.map(r => ({
      ...r,
      id: r.tax_id,
      acitve: r.active // support both spellings in return JSON
    }));
    res.json(mappedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/taxes/:id
 * Fetches a single tax by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const taxId = req.params.id;
    const [rows] = await db.execute('SELECT * FROM taxes WHERE tax_id = ?', [taxId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tax not found' });
    }
    const r = rows[0];
    res.json({ ...r, id: r.tax_id, acitve: r.active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/taxes/:id
 * Updates details for a specific tax.
 */
router.put('/:id', async (req, res) => {
  try {
    const taxId = req.params.id;
    const data = req.body.TaxModel || req.body;
    
    const { name, percentage } = data;
    const active = data.active !== undefined ? data.active : data.acitve;

    const [rows] = await db.execute('SELECT * FROM taxes WHERE tax_id = ?', [taxId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tax not found' });
    }

    const existingTax = rows[0];
    const finalName = name !== undefined ? name : existingTax.name;
    const finalPercentage = percentage !== undefined ? parseFloat(percentage) : existingTax.percentage;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingTax.active;

    const query = `
      UPDATE taxes SET name = ?, percentage = ?, active = ?
      WHERE tax_id = ?
    `;

    await db.execute(query, [
      finalName,
      finalPercentage,
      finalActive,
      taxId
    ]);

    res.json({ message: 'Tax updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/taxes/:id
 * Deletes a specific tax by ID and shifts subsequent IDs down.
 */
router.delete('/:id', async (req, res) => {
  try {
    const taxId = parseInt(req.params.id);

    const [rows] = await db.execute('SELECT * FROM taxes WHERE tax_id = ?', [taxId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tax not found' });
    }

    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM taxes WHERE tax_id = ?', [taxId]);
    await db.execute('UPDATE taxes SET tax_id = tax_id - 1 WHERE tax_id > ?', [taxId]);
    await db.execute('ALTER TABLE taxes AUTO_INCREMENT = 1');
    await db.query('COMMIT');
    
    res.json({ message: 'Tax deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
