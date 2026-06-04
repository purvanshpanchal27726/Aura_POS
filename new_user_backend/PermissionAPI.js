const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * GET /api/permissions
 * Returns roles, modules, and current permissions mapping.
 */
router.get('/', async (req, res) => {
  try {
    const [roles] = await db.query('SELECT * FROM roles');
    const [modules] = await db.query('SELECT * FROM modules');
    const [permissions] = await db.query('SELECT * FROM role_permissions');

    res.json({
      roles,
      modules,
      permissions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/permissions
 * Updates permissions in bulk.
 * Request body: [ { role_id, module_id, allowed }, ... ]
 */
router.put('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const updates = req.body || [];
    if (!Array.isArray(updates)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Expected an array of permission updates.' });
    }

    const query = `
      INSERT INTO role_permissions (role_id, module_id, allowed) 
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)
    `;

    for (const update of updates) {
      const { role_id, module_id, allowed } = update;
      if (role_id === undefined || module_id === undefined || allowed === undefined) {
        throw new Error('Invalid permission data in bulk update list.');
      }
      await connection.execute(query, [
        parseInt(role_id),
        parseInt(module_id),
        allowed ? 1 : 0
      ]);
    }

    await connection.commit();
    res.json({ message: 'Permissions updated successfully' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
