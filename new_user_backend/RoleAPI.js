const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * POST /api/roles
 * Registers a new role.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.RoleModel || req.body;
    const { name } = data;
    const active = data.active !== undefined ? data.active : (data.acitve !== undefined ? data.acitve : 1);
    const created_by = data.created_by || data.createdBy || 'System';

    if (!name) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please ensure name is provided.' 
      });
    }

    const query = `
      INSERT INTO roles (name, active, created_by)
      VALUES (?, ?, ?)
    `;

    const values = [
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
 * Fetches all registered roles.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM roles ORDER BY role_id ASC');
    // Map response to also include id alias for client flexibility
    const mappedRows = rows.map(r => ({
      ...r,
      id: r.role_id,
      acitve: r.active // support both spellings in return JSON
    }));
    res.json(mappedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/roles/:id
 * Updates details for a specific role.
 */
router.put('/:id', async (req, res) => {
  try {
    const roleId = req.params.id;
    const data = req.body.RoleModel || req.body;
    const { name } = data;
    const active = data.active !== undefined ? data.active : data.acitve;

    const [rows] = await db.execute('SELECT * FROM roles WHERE role_id = ?', [roleId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const existingRole = rows[0];
    const finalName = name !== undefined ? name : existingRole.name;
    const finalActive = active !== undefined ? (active ? 1 : 0) : existingRole.active;

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
 * Deletes a specific role by ID and shifts subsequent IDs down.
 */
router.delete('/:id', async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);

    const [rows] = await db.execute('SELECT * FROM roles WHERE role_id = ?', [roleId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM roles WHERE role_id = ?', [roleId]);
    await db.execute('UPDATE roles SET role_id = role_id - 1 WHERE role_id > ?', [roleId]);
    await db.execute('ALTER TABLE roles AUTO_INCREMENT = 1');
    await db.query('COMMIT');
    
    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
