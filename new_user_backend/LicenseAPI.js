const express = require('express');
const db = require('./db');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (!cid || cid === 'null' || cid === 'undefined') return null;
  return parseInt(cid);
}

// Helper to check if active user is a Super-Admin (role_id 1)
function checkSuperAdmin(req) {
  return req.user && req.user.role_id === 1;
}

/**
 * GET /api/license
 * Returns the current license status and validity details for the active client.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    
    let query = 'SELECT * FROM license_info WHERE ';
    let params = [];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    query += ' ORDER BY license_id DESC LIMIT 1';

    const [rows] = await db.query(query, params);
    
    if (rows.length === 0) {
      // Auto-create a default 1-year trial license if not found
      const defaultLicenseKey = `POS-${clientId ? clientId : 'GLOBAL'}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const today = new Date();
      const expiry = new Date();
      expiry.setFullYear(today.getFullYear() + 1);

      const validFrom = today.toISOString().split('T')[0];
      const validTo = expiry.toISOString().split('T')[0];

      await db.execute(`
        INSERT INTO license_info (client_id, license_key, valid_from, valid_to, amc_start_date, amc_end_date, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Active')
      `, [
        clientId,
        defaultLicenseKey,
        validFrom,
        validTo,
        validFrom,
        validTo
      ]);
      
      let refetchQuery = 'SELECT * FROM license_info WHERE ';
      let refetchParams = [];
      if (clientId) {
        refetchQuery += 'client_id = ?';
        refetchParams.push(clientId);
      } else {
        refetchQuery += 'client_id IS NULL';
      }
      refetchQuery += ' ORDER BY license_id DESC LIMIT 1';

      const [newRows] = await db.query(refetchQuery, refetchParams);
      return res.json(calculateLicenseDays(newRows[0]));
    }
    
    res.json(calculateLicenseDays(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/license/renew
 * Extends the license and AMC validity by 365 days (1 year).
 * Restricted to Super-Admins (role_id 1).
 */
router.post('/renew', async (req, res) => {
  try {
    if (!checkSuperAdmin(req)) {
      return res.status(403).json({ error: 'Access denied: Only Super-Admins can renew licenses.' });
    }

    const clientId = getClientId(req);
    let query = 'SELECT * FROM license_info WHERE ';
    let params = [];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    query += ' ORDER BY license_id DESC LIMIT 1';

    const [rows] = await db.query(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No active license found to renew.' });
    }
    
    const license = rows[0];
    const currentExpiry = new Date(license.valid_to);
    const currentAmcExpiry = new Date(license.amc_end_date);
    
    // Extend by 1 year (365 days)
    currentExpiry.setDate(currentExpiry.getDate() + 365);
    currentAmcExpiry.setDate(currentAmcExpiry.getDate() + 365);
    
    const newValidTo = currentExpiry.toISOString().split('T')[0];
    const newAmcEnd = currentAmcExpiry.toISOString().split('T')[0];
    
    await db.execute(`
      UPDATE license_info 
      SET valid_to = ?, amc_end_date = ?, status = 'Active' 
      WHERE license_id = ?
    `, [newValidTo, newAmcEnd, license.license_id]);
    
    const [updatedRows] = await db.query('SELECT * FROM license_info WHERE license_id = ?', [license.license_id]);
    res.json({
      message: 'License renewed successfully',
      license: calculateLicenseDays(updatedRows[0])
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function calculateLicenseDays(license) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(license.valid_to);
  expiry.setHours(0, 0, 0, 0);
  const amcExpiry = new Date(license.amc_end_date);
  amcExpiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let finalStatus = license.status;
  if (finalStatus === 'Active') {
    if (diffDays <= 0) {
      finalStatus = 'Expired';
    } else if (today > amcExpiry) {
      finalStatus = 'AMC Expired';
    } else if (diffDays <= 30) {
      finalStatus = 'Renewal Due';
    }
  }
  
  return {
    license_id: license.license_id,
    license_key: license.license_key,
    valid_from: license.valid_from,
    valid_to: license.valid_to,
    amc_start_date: license.amc_start_date,
    amc_end_date: license.amc_end_date,
    status: finalStatus,
    remaining_days: diffDays,
    needs_renewal: diffDays <= 30
  };
}

module.exports = router;
