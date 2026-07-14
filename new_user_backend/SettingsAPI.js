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
 * GET /api/settings/printer
 * Retrieves printer settings for the active client.
 */
router.get('/printer', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required in request headers (x-client-id).' });
    }

    const [rows] = await db.execute('SELECT * FROM printer_settings WHERE client_id = ?', [clientId]);
    if (rows.length === 0) {
      // Return default values if not configured yet
      return res.json({
        client_id: clientId,
        printer_name: 'Default Printer',
        printer_type: 'thermal',
        paper_size: 'medium',
        connection: 'usb',
        ip_address: null,
        port: 9100,
        auto_print: 0,
        copies: 1
      });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/settings/printer
 * Updates printer settings for the active client.
 */
router.put('/printer', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required in request headers (x-client-id).' });
    }

    const data = req.body;
    const { printer_name, printer_type, paper_size, connection, ip_address, port, auto_print, copies } = data;

    // Check if printer settings row exists
    const [existing] = await db.execute('SELECT * FROM printer_settings WHERE client_id = ?', [clientId]);

    if (existing.length === 0) {
      const query = `
        INSERT INTO printer_settings (client_id, printer_name, printer_type, paper_size, connection, ip_address, port, auto_print, copies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await db.execute(query, [
        clientId,
        printer_name || 'Default Printer',
        printer_type || 'thermal',
        paper_size || 'medium',
        connection || 'usb',
        ip_address || null,
        port ? parseInt(port) : 9100,
        auto_print ? 1 : 0,
        copies ? parseInt(copies) : 1
      ]);
    } else {
      const query = `
        UPDATE printer_settings 
        SET printer_name = ?, printer_type = ?, paper_size = ?, connection = ?, ip_address = ?, port = ?, auto_print = ?, copies = ?
        WHERE client_id = ?
      `;
      await db.execute(query, [
        printer_name !== undefined ? printer_name : existing[0].printer_name,
        printer_type !== undefined ? printer_type : existing[0].printer_type,
        paper_size !== undefined ? paper_size : existing[0].paper_size,
        connection !== undefined ? connection : existing[0].connection,
        ip_address !== undefined ? ip_address : existing[0].ip_address,
        port !== undefined ? parseInt(port) : existing[0].port,
        auto_print !== undefined ? (auto_print ? 1 : 0) : existing[0].auto_print,
        copies !== undefined ? parseInt(copies) : existing[0].copies,
        clientId
      ]);
    }

    res.json({ message: 'Printer settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
