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
  return !req.user || req.user.client_id === null || req.user.client_id === undefined;
}

/**
 * POST /api/units
 * Registers a new unit.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.UnitModel || req.body;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    
    if (!clientId && !isSuperAdmin) {
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

    // Duplicate Check
    const nameCheck = name.trim().toLowerCase();
    let dupQuery = 'SELECT * FROM units WHERE LOWER(name) = ? AND ';
    let dupParams = [nameCheck];
    if (clientId) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [existing] = await db.execute(dupQuery, dupParams);
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
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = 'SELECT * FROM units WHERE ';
    let params = [];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    query += ' ORDER BY unit_id ASC';

    const [rows] = await db.query(query, params);
    const mappedRows = rows.map(r => ({
      ...r,
      id: r.unit_id,
      acitve: r.active
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
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = 'SELECT * FROM units WHERE unit_id = ? AND ';
    let params = [unitId];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [rows] = await db.execute(query, params);
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
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body.UnitModel || req.body;

    const { name } = data;
    const active = data.active !== undefined ? data.active : data.acitve;

    let queryExist = 'SELECT * FROM units WHERE unit_id = ? AND ';
    let paramsExist = [unitId];
    if (clientId) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const existingUnit = rows[0];
    const finalName = name !== undefined ? name : existingUnit.name;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingUnit.active;

    // Duplicate Check
    if (name !== undefined) {
      const nameCheck = name.trim().toLowerCase();
      let dupQuery = 'SELECT * FROM units WHERE LOWER(name) = ? AND unit_id != ? AND ';
      let dupParams = [nameCheck, unitId];
      if (clientId) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [existingDup] = await db.execute(dupQuery, dupParams);
      if (existingDup.length > 0) {
        return res.status(400).json({ error: 'This unit is already added.' });
      }
    }

    let updateQuery = 'UPDATE units SET name = ?, active = ? WHERE unit_id = ? AND ';
    let updateParams = [finalName, finalActive, unitId];
    if (clientId) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);

    res.json({ message: 'Unit updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/units/:id
 * Deletes a specific unit by ID.
 */
router.delete('/:id', async (req, res) => {
  try {
    const unitId = parseInt(req.params.id);
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let queryExist = 'SELECT * FROM units WHERE unit_id = ? AND ';
    let paramsExist = [unitId];
    if (clientId) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    let deleteQuery = 'DELETE FROM units WHERE unit_id = ? AND ';
    let deleteParams = [unitId];
    if (clientId) {
      deleteQuery += 'client_id = ?';
      deleteParams.push(clientId);
    } else {
      deleteQuery += 'client_id IS NULL';
    }

    await db.execute(deleteQuery, deleteParams);
    
    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
