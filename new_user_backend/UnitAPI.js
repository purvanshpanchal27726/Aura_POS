const express = require('express');
const db = require('./db');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (!cid || cid === 'null' || cid === 'undefined') return null;
  return parseInt(cid);
}

/**
 * POST /api/units
 * Registers a new unit.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.UnitModel || req.body;
    const clientId = getClientId(req);
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

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
    const [existing] = await db.execute('SELECT * FROM units WHERE LOWER(name) = ? AND client_id = ?', [name.trim().toLowerCase(), clientId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This unit is already added.' });
    }

    const query = `
      INSERT INTO units (client_id, name, active, created_by)
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
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }
    const [rows] = await db.query('SELECT * FROM units WHERE client_id = ? ORDER BY unit_id ASC', [clientId]);
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
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }
    const [rows] = await db.execute('SELECT * FROM units WHERE unit_id = ? AND client_id = ?', [unitId, clientId]);
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
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body.UnitModel || req.body;
    
    const { name } = data;
    const active = data.active !== undefined ? data.active : data.acitve;

    const [rows] = await db.execute('SELECT * FROM units WHERE unit_id = ? AND client_id = ?', [unitId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const existingUnit = rows[0];
    const finalName = name !== undefined ? name : existingUnit.name;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingUnit.active;

    // Check if unit already exists (excluding the current one)
    if (name !== undefined) {
      const [existing] = await db.execute('SELECT * FROM units WHERE LOWER(name) = ? AND unit_id != ? AND client_id = ?', [finalName.trim().toLowerCase(), unitId, clientId]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'This unit is already added.' });
      }
    }

    const query = `
      UPDATE units SET name = ?, active = ?
      WHERE unit_id = ? AND client_id = ?
    `;

    await db.execute(query, [
      finalName,
      finalActive,
      unitId,
      clientId
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
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const [rows] = await db.execute('SELECT * FROM units WHERE unit_id = ? AND client_id = ?', [unitId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    await db.execute('DELETE FROM units WHERE unit_id = ? AND client_id = ?', [unitId, clientId]);
    
    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

