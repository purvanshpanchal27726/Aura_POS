const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * GET /api/clients
 * Fetches all clients.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM clients ORDER BY client_id ASC');
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
 * Creates a new client and initializes default settings.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.ClientModel || req.body;
    const { name, email, phone, address, gst_no, logo_url } = data;
    const active = data.active !== undefined ? data.active : 1;

    if (!name) {
      return res.status(400).json({ error: 'Missing client name.' });
    }

    const query = `
      INSERT INTO clients (name, email, phone, address, gst_no, logo_url, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [name, email || null, phone || null, address || null, gst_no || null, logo_url || null, active ? 1 : 0];

    const [result] = await db.execute(query, values);
    const clientId = result.insertId;

    // Initialize default printer settings for this new client
    await db.execute(`
      INSERT INTO printer_settings (client_id, printer_name, printer_type, paper_size, connection, ip_address, port, auto_print, copies)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [clientId, 'Default Printer', 'thermal', 'medium', 'usb', null, 9100, 0, 1]);

    res.status(201).json({
      message: 'Client created successfully',
      client_id: clientId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const [rows] = await db.execute('SELECT * FROM clients WHERE client_id = ?', [clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const existing = rows[0];
    const query = `
      UPDATE clients 
      SET name = ?, email = ?, phone = ?, address = ?, gst_no = ?, logo_url = ?, active = ?
      WHERE client_id = ?
    `;
    const values = [
      name !== undefined ? name : existing.name,
      email !== undefined ? email : existing.email,
      phone !== undefined ? phone : existing.phone,
      address !== undefined ? address : existing.address,
      gst_no !== undefined ? gst_no : existing.gst_no,
      logo_url !== undefined ? logo_url : existing.logo_url,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      clientId
    ];

    await db.execute(query, values);
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
    await db.execute('UPDATE clients SET active = 0 WHERE client_id = ?', [clientId]);
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
    const [rows] = await db.execute(`
      SELECT cm.group_id, mg.name 
      FROM client_modules cm
      JOIN module_groups mg ON cm.group_id = mg.group_id
      WHERE cm.client_id = ? AND cm.enabled = 1
    `, [clientId]);
    res.json(rows);
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
