const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * GET /api/license
 * Returns the current license status and validity details.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM license_info ORDER BY license_id DESC LIMIT 1');
    
    if (rows.length === 0) {
      // Fallback: Seed if not found dynamically
      const defaultLicense = {
        license_key: 'VANSHEE-POS-LICENSE-KEY-2026',
        valid_from: '2026-01-01',
        valid_to: '2026-08-31',
        amc_start_date: '2026-01-01',
        amc_end_date: '2026-08-31',
        status: 'Active'
      };
      
      await db.execute(`
        INSERT INTO license_info (license_key, valid_from, valid_to, amc_start_date, amc_end_date, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        defaultLicense.license_key,
        defaultLicense.valid_from,
        defaultLicense.valid_to,
        defaultLicense.amc_start_date,
        defaultLicense.amc_end_date,
        defaultLicense.status
      ]);
      
      const [newRows] = await db.query('SELECT * FROM license_info ORDER BY license_id DESC LIMIT 1');
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
 */
router.post('/renew', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM license_info ORDER BY license_id DESC LIMIT 1');
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
  
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let finalStatus = 'Active';
  if (diffDays <= 0) {
    finalStatus = 'Expired';
  } else if (diffDays <= 30) {
    finalStatus = 'Renewal Due';
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
