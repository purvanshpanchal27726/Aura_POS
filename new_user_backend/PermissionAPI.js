const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * GET /api/permissions
 * Returns roles, modules, and current permissions mapping.
 */
router.get('/', async (req, res) => {
  try {
    const [roles] = await db.query('SELECT * FROM roles ORDER BY role_id ASC');
    let [modules] = await db.query('SELECT * FROM modules ORDER BY module_id ASC');
    
    // Ensure all 10 core modules exist in database
    const standardModules = [
      { module_id: 1, name: 'User Master' },
      { module_id: 2, name: 'Customer Master' },
      { module_id: 3, name: 'Item & Stock' },
      { module_id: 4, name: 'Category & Tax' },
      { module_id: 5, name: 'Sales Billing (POS)' },
      { module_id: 6, name: 'Purchase Inward' },
      { module_id: 7, name: 'Restaurant POS' },
      { module_id: 8, name: 'Hotel Management' },
      { module_id: 9, name: 'Employee Staff' },
      { module_id: 10, name: 'Reports & Analytics' }
    ];

    if (!modules || modules.length < 10) {
      for (const sm of standardModules) {
        await db.execute(
          'INSERT INTO modules (module_id, name) VALUES ($1, $2) ON CONFLICT (module_id) DO UPDATE SET name = EXCLUDED.name',
          [sm.module_id, sm.name]
        );
      }
      const [refreshed] = await db.query('SELECT * FROM modules ORDER BY module_id ASC');
      modules = refreshed;
    }

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
