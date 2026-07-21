const express = require('express');
const db = require('./db');

const router = express.Router();

// Helper to get client_id from headers or query params or user token
function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (cid && cid !== 'null' && cid !== 'undefined') {
    return parseInt(cid);
  }
  return req.user?.client_id || null;
}

function checkSuperAdmin(req) {
  return !req.user || req.user.client_id === null || req.user.client_id === undefined;
}

// Middleware to restrict write operations to Super-Admin (1) and Admin (2)
const checkWriteAccess = (req, res, next) => {
  if (!req.user || (req.user.role_id !== 1 && req.user.role_id !== 2)) {
    return res.status(403).json({ error: 'Access denied: Only admins and super-admins can manage roles.' });
  }
  next();
};

/**
 * POST /api/roles
 * Registers a new role for tenant client.
 */
router.post('/', checkWriteAccess, async (req, res) => {
  try {
    const clientId = getClientId(req);
    const data = req.body.RoleModel || req.body;
    const { name } = data;
    const active = data.active !== undefined ? data.active : (data.acitve !== undefined ? data.acitve : 1);
    const created_by = data.created_by || data.createdBy || 'System';

    if (!name) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please ensure name is provided.' 
      });
    }

    // Duplicate Check scoped to client or system
    const nameCheck = name.trim().toLowerCase();
    let dupQuery = 'SELECT * FROM roles WHERE LOWER(name) = ? AND ';
    let dupParams = [nameCheck];
    if (clientId) {
      dupQuery += '(client_id = ? OR client_id IS NULL)';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }

    const [existing] = await db.execute(dupQuery, dupParams);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Role with this name already exists.' });
    }

    const query = `
      INSERT INTO roles (client_id, name, active, created_by)
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
      message: 'Role created successfully',
      role_id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/roles
 * Fetches all registered roles for tenant client + default system roles.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    let query = 'SELECT *, ROW_NUMBER() OVER(ORDER BY role_id ASC)::integer AS display_id FROM roles WHERE ';
    let params = [];
    if (clientId) {
      query += '(client_id = $1 OR client_id IS NULL)';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    query += ' ORDER BY role_id ASC';

    const [rows] = await db.execute(query, params);
    const mappedRows = rows.map(r => ({
      ...r,
      id: r.role_id,
      acitve: r.active
    }));
    res.json(mappedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/roles/:id
 * Fetches a single role by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const roleId = req.params.id;
    const clientId = getClientId(req);
    let query = 'SELECT * FROM roles WHERE role_id = ? AND ';
    let params = [roleId];
    if (clientId) {
      query += '(client_id = ? OR client_id IS NULL)';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    const r = rows[0];
    res.json({
      ...r,
      id: r.role_id,
      acitve: r.active
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/roles/:id
 * Updates details for a specific role.
 */
router.put('/:id', checkWriteAccess, async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    const clientId = getClientId(req);
    const data = req.body.RoleModel || req.body;
    const { name } = data;
    const active = data.active !== undefined ? data.active : data.acitve;

    if ([1, 2, 3, 4].includes(roleId) && clientId) {
      return res.status(403).json({ error: 'System default roles cannot be edited by client admins.' });
    }

    let queryExist = 'SELECT * FROM roles WHERE role_id = ? AND ';
    let paramsExist = [roleId];
    if (clientId) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const existingRole = rows[0];
    const finalName = name !== undefined ? name : existingRole.name;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingRole.active;

    // Duplicate Check
    if (name !== undefined) {
      const nameCheck = name.trim().toLowerCase();
      let dupQuery = 'SELECT * FROM roles WHERE LOWER(name) = ? AND role_id != ? AND ';
      let dupParams = [nameCheck, roleId];
      if (clientId) {
        dupQuery += '(client_id = ? OR client_id IS NULL)';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [existingDup] = await db.execute(dupQuery, dupParams);
      if (existingDup.length > 0) {
        return res.status(400).json({ error: 'Role with this name already exists.' });
      }
    }

    const query = `
      UPDATE roles SET name = ?, active = ?
      WHERE role_id = ?
    `;

    await db.execute(query, [
      finalName,
      finalActive,
      roleId
    ]);

    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/roles/:id
 * Deletes a specific role by ID.
 */
router.delete('/:id', checkWriteAccess, async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    const clientId = getClientId(req);

    if ([1, 2, 3, 4].includes(roleId)) {
      return res.status(400).json({ error: 'System default roles cannot be deleted.' });
    }

    let queryExist = 'SELECT * FROM roles WHERE role_id = ? AND ';
    let paramsExist = [roleId];
    if (clientId) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    await db.execute('DELETE FROM roles WHERE role_id = ?', [roleId]);
    
    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
