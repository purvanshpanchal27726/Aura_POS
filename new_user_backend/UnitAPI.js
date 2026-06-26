const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * POST /api/units
 * Registers a new unit.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.UnitModel || req.body;
    
    const { name } = data;
    
    // Resolve flexible parameters for active state and created_by
    const active = data.active !== undefined ? data.active : (data.acitve !== undefined ? data.acitve : 1);
    const created_by = data.created_by || data.createdBy || 'System';

    if (!name) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please ensure name is provided.' 
      });
    }

    // Check if unit already exists
    const [existing] = await db.execute('SELECT * FROM units WHERE LOWER(name) = ?', [name.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This unit is already added.' });
    }

    const query = `
      INSERT INTO units (name, active, created_by)
      VALUES (?, ?, ?)
    `;

    const values = [
      name,
      active ? 1 : 0,
      created_by
    ];

    const [result] = await db.execute(query, values);
    
    res.status(201).json({
      message: 'Unit created successfully',
      unit_id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/units
 * Fetches all registered units.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM units ORDER BY unit_id ASC');
    // Map response to also include id alias for client flexibility
    const mappedRows = rows.map(r => ({
      ...r,
      id: r.unit_id,
      acitve: r.active // support both spellings in return JSON
    }));
    res.json(mappedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/units/:id
 * Fetches a single unit by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const unitId = req.params.id;
    const [rows] = await db.execute('SELECT * FROM units WHERE unit_id = ?', [unitId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    const r = rows[0];
    res.json({ ...r, id: r.unit_id, acitve: r.active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/units/:id
 * Updates details for a specific unit.
 */
router.put('/:id', async (req, res) => {
  try {
    const unitId = req.params.id;
    const data = req.body.UnitModel || req.body;
    
    const { name } = data;
    const active = data.active !== undefined ? data.active : data.acitve;

    const [rows] = await db.execute('SELECT * FROM units WHERE unit_id = ?', [unitId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const existingUnit = rows[0];
    const finalName = name !== undefined ? name : existingUnit.name;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingUnit.active;

    // Check if unit already exists (excluding the current one)
    if (name !== undefined) {
      const [existing] = await db.execute('SELECT * FROM units WHERE LOWER(name) = ? AND unit_id != ?', [finalName.trim().toLowerCase(), unitId]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'This unit is already added.' });
      }
    }

    const query = `
      UPDATE units SET name = ?, active = ?
      WHERE unit_id = ?
    `;

    await db.execute(query, [
      finalName,
      finalActive,
      unitId
    ]);

    res.json({ message: 'Unit updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/units/:id
 * Deletes a specific unit by ID and shifts subsequent IDs down.
 */
router.delete('/:id', async (req, res) => {
  try {
    const unitId = parseInt(req.params.id);

    const [rows] = await db.execute('SELECT * FROM units WHERE unit_id = ?', [unitId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM units WHERE unit_id = ?', [unitId]);
    await db.execute('UPDATE units SET unit_id = unit_id - 1 WHERE unit_id > ?', [unitId]);
    await db.execute('ALTER TABLE units AUTO_INCREMENT = 1');
    await db.query('COMMIT');
    
    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

