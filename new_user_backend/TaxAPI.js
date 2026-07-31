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
 * POST /api/taxes
 * Registers a new tax.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.TaxModel || req.body;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { name, percentage } = data;
    const finalPercentage = percentage !== undefined ? parseFloat(percentage) : 0.00;
    
    // Resolve flexible parameters for active state and created_by
    const active = data.active !== undefined ? data.active : (data.acitve !== undefined ? data.acitve : 1);
    const created_by = data.created_by || data.createdBy || 'System';

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Tax name is required and cannot be blank.' });
    }
    if (isNaN(finalPercentage) || finalPercentage < 0 || finalPercentage > 100) {
      return res.status(400).json({ error: 'Tax percentage must be a valid number between 0% and 100%.' });
    }

    // Duplicate Check
    const nameCheck = name.trim().toLowerCase();
    let dupQuery = 'SELECT * FROM taxes WHERE LOWER(name) = ? AND ';
    let dupParams = [nameCheck];
    if (clientId !== null && clientId !== undefined) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [existing] = await db.execute(dupQuery, dupParams);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This tax is already added.' });
    }

    const query = `
      INSERT INTO taxes (client_id, name, percentage, active, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;

    const values = [
      clientId,
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
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = 'SELECT *, ROW_NUMBER() OVER(ORDER BY tax_id ASC)::integer AS display_id FROM taxes WHERE ';
    let params = [];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = $1';
      params.push(clientId);
    } else {
      if (isSuperAdmin) {
        query += '1=1';
      } else {
        query += '1=1';
      }
    }
    query += ' ORDER BY tax_id ASC';

    const [rows] = await db.execute(query, params);
    const mappedRows = rows.map(r => ({
      ...r,
      id: r.tax_id,
      acitve: r.active
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
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = 'SELECT * FROM taxes WHERE tax_id = ? AND ';
    let params = [taxId];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += '1=1';
    }

    const [rows] = await db.execute(query, params);
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
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body.TaxModel || req.body;

    const { name, percentage } = data;
    const active = data.active !== undefined ? data.active : data.acitve;

    let queryExist = 'SELECT * FROM taxes WHERE tax_id = ? AND ';
    let paramsExist = [taxId];
    if (clientId !== null && clientId !== undefined) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tax not found' });
    }

    const existingTax = rows[0];
    const finalName = name !== undefined ? name : existingTax.name;
    const finalPercentage = percentage !== undefined ? parseFloat(percentage) : existingTax.percentage;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingTax.active;

    // Duplicate Check
    if (name !== undefined) {
      const nameCheck = name.trim().toLowerCase();
      let dupQuery = 'SELECT * FROM taxes WHERE LOWER(name) = ? AND tax_id != ? AND ';
      let dupParams = [nameCheck, taxId];
      if (clientId !== null && clientId !== undefined) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [existingDup] = await db.execute(dupQuery, dupParams);
      if (existingDup.length > 0) {
        return res.status(400).json({ error: 'This tax is already added.' });
      }
    }

    let updateQuery = 'UPDATE taxes SET name = ?, percentage = ?, active = ? WHERE tax_id = ? AND ';
    let updateParams = [finalName, finalPercentage, finalActive, taxId];
    if (clientId !== null && clientId !== undefined) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);

    res.json({ message: 'Tax updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/taxes/:id
 * Deletes a specific tax by ID.
 */
router.delete('/:id', async (req, res) => {
  try {
    const taxId = parseInt(req.params.id);
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (clientId === null && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let queryExist = 'SELECT * FROM taxes WHERE tax_id = ? AND ';
    let paramsExist = [taxId];
    if (clientId !== null && clientId !== undefined) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tax not found' });
    }

    let deleteQuery = 'DELETE FROM taxes WHERE tax_id = ? AND ';
    let deleteParams = [taxId];
    if (clientId !== null && clientId !== undefined) {
      deleteQuery += 'client_id = ?';
      deleteParams.push(clientId);
    } else {
      deleteQuery += 'client_id IS NULL';
    }

    await db.execute(deleteQuery, deleteParams);
    
    res.json({ message: 'Tax deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
