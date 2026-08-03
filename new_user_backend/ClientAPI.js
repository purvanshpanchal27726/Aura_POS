const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * GET /api/clients/current
 * Fetches store profile for current tenant client.
 */
router.get('/current', async (req, res) => {
  try {
    const clientId = (req.user && req.user.client_id) ? req.user.client_id : 1;
    const [rows] = await db.query('SELECT * FROM clients WHERE client_id = $1', [clientId]);
    if (rows.length === 0) {
      return res.json({ name: 'Vanshee POS Enterprise', email: 'admin@vanshee.com', phone: '9876543210', gst_no: '24AAACV1234F1Z5' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/clients/current
 * Updates store profile for current tenant client.
 */
router.put('/current', async (req, res) => {
  try {
    const clientId = (req.user && req.user.client_id) ? req.user.client_id : 1;
    const { name, phone, email, gst_no, address } = req.body;
    await db.execute(
      'UPDATE clients SET name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email), gst_no = COALESCE($4, gst_no), address = COALESCE($5, address) WHERE client_id = $6',
      [name, phone, email, gst_no, address, clientId]
    );
    res.json({ message: 'Store profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/clients
 * Fetches all clients.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, 
             COALESCE(STRING_AGG(u.username, ', '), 'N/A') AS admin_username 
      FROM clients c 
      LEFT JOIN users u ON (u.client_id = c.client_id AND u.role_id = 2) 
      GROUP BY c.client_id, c.name, c.email, c.phone, c.address, c.gst_no, c.created_at, c.updated_at 
      ORDER BY c.client_id ASC
    `);
    const mappedRows = rows.map(r => ({
      ...r,
      id: r.client_id
    }));
    res.json(mappedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/clients
 * Creates a new client, initializes default settings, and registers their admin user.
 */
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const data = req.body.ClientModel || req.body || {};
    const { name, email, phone, address, gst_no, logo_url, admin_username, admin_password } = data;
    const active = data.active !== undefined ? data.active : 1;

    if (!name) {
      await connection.rollback();
      return res.status(400).json({ error: 'Missing company name.' });
    }

    // 1. Company Name Duplicate Check
    const nameCheck = name.trim().toLowerCase();
    const [existingCompany] = await connection.execute('SELECT * FROM clients WHERE LOWER(name) = $1', [nameCheck]);
    if (existingCompany.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Company with this name already exists.' });
    }

    // 2. Admin Username Duplicate Check
    if (!admin_username || !admin_password) {
      await connection.rollback();
      return res.status(400).json({ error: 'Admin Username and Password are required.' });
    }

    const usernameCheck = admin_username.trim().toLowerCase();
    const [existingUser] = await connection.execute('SELECT * FROM users WHERE LOWER(username) = $1', [usernameCheck]);
    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Admin username is already taken. Please choose another one.' });
    }

    // 3. Create Client Company
    const query = `
      INSERT INTO clients (name, email, phone, address, gst_no, logo_url, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const values = [name, email || null, phone || null, address || null, gst_no || null, logo_url || null, active ? 1 : 0];

    const [result] = await connection.execute(query, values);
    const clientId = result.insertId;

    // 4. Initialize default printer settings for this new client
    await connection.execute(`
      INSERT INTO printer_settings (client_id, printer_name, printer_type, paper_size, connection, ip_address, port, auto_print, copies)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [clientId, 'Default Printer', 'thermal', 'medium', 'usb', null, 9100, 0, 1]);

    // 5. Create Admin User connected to this Client
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(admin_password, 10);
    
    const userQuery = `
      INSERT INTO users (
        username, password, first_name, middle_name, last_name,
        address_1, address_2, address_3, city, country,
        phone_1, phone_2, email_1, email_2, role_id, client_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `;
    const userValues = [
      admin_username.trim(),
      hashedPassword,
      name,           // Use company name as first_name
      null,
      'Admin',
      address || 'Company Address',
      null,
      null,
      'City',
      'India',
      phone || '0000000000',
      null,
      email || 'admin@example.com',
      null,
      2,              // Role ID 2 = Admin (company admin)
      clientId,
      'System'
    ];
    await connection.execute(userQuery, userValues);

    await connection.commit();
    res.status(201).json({
      message: 'Client and admin user created successfully',
      client_id: clientId
    });
  } catch (err) {
    await connection.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/clients/:id
 * Updates details for a specific client.
 */
router.put('/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const data = req.body.ClientModel || req.body;
    const { name, email, phone, address, gst_no, logo_url } = data;
    const active = data.active !== undefined ? data.active : 1;

    const [rows] = await db.execute('SELECT * FROM clients WHERE client_id = $1', [clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const existing = rows[0];

    // Company Name Duplicate Check on Update
    if (name !== undefined) {
      const nameCheck = name.trim().toLowerCase();
      const [existingDup] = await db.execute('SELECT * FROM clients WHERE LOWER(name) = $1 AND client_id != $2', [nameCheck, clientId]);
      if (existingDup.length > 0) {
        return res.status(400).json({ error: 'Company with this name already exists.' });
      }
    }

    const query = `
      UPDATE clients 
      SET name = ?, email = ?, phone = ?, address = ?, gst_no = ?, logo_url = ?, active = ?
      WHERE client_id = ?
    `;
    const values2 = [
      name !== undefined ? name : existing.name,
      email !== undefined ? email : existing.email,
      phone !== undefined ? phone : existing.phone,
      address !== undefined ? address : existing.address,
      gst_no !== undefined ? gst_no : existing.gst_no,
      logo_url !== undefined ? logo_url : existing.logo_url,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      clientId
    ];

    await db.execute(`
      UPDATE clients 
      SET name = $1, email = $2, phone = $3, address = $4, gst_no = $5, logo_url = $6, active = $7
      WHERE client_id = $8
    `, values2);
    res.json({ message: 'Client updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/clients/:id
 * Deactivates or removes a client.
 */
router.delete('/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    await db.execute('UPDATE clients SET active = 0 WHERE client_id = $1', [clientId]);
    res.json({ message: 'Client deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/clients/:id/modules
 * Gets which module groups are enabled for a client.
 */
router.get('/:id/modules', async (req, res) => {
  try {
    const clientId = req.params.id;
    const [rows2] = await db.execute(`
      SELECT cm.group_id, mg.name 
      FROM client_modules cm
      JOIN module_groups mg ON cm.group_id = mg.group_id
      WHERE cm.client_id = $1 AND cm.enabled = 1
    `, [clientId]);
    res.json(rows2);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/clients/:id/modules
 * Updates module group mappings for a client.
 */
router.put('/:id/modules', async (req, res) => {
  try {
    const clientId = req.params.id;
    const { groupIds } = req.body; // Array of integers: e.g. [1, 2]

    if (!Array.isArray(groupIds)) {
      return res.status(400).json({ error: 'groupIds must be an array.' });
    }

    // Begin updates inside a transaction block or sequence
    await db.execute('DELETE FROM client_modules WHERE client_id = ?', [clientId]);

    for (const groupId of groupIds) {
      await db.execute(`
        INSERT INTO client_modules (client_id, group_id, enabled)
        VALUES (?, ?, 1)
        ON CONFLICT (client_id, group_id) DO UPDATE SET enabled = 1
      `, [clientId, groupId]);
    }

    res.json({ message: 'Client modules updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
