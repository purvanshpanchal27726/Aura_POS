const express = require('express');
const db = require('./db');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (!cid || cid === 'null' || cid === 'undefined') return null;
  return parseInt(cid);
}

// Helper to check if active user is a Super-Admin
function checkSuperAdmin(req) {
  return !req.user || req.user.client_id === null || req.user.client_id === undefined;
}

/**
 * POST /api/vendors
 * Creates a new vendor.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.VendorModel || req.body || {};
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { first_name, last_name, company, address_1, address_2, city, country, phone_1, phone_2, email, created_by } = data;

    if (!first_name || !last_name || !address_1 || !city || !country || !phone_1) {
      return res.status(400).json({ error: 'Missing required fields for Vendor creation.' });
    }

    // Duplicate check
    const phoneCheck = phone_1.trim();
    let dupQuery = 'SELECT * FROM vendors WHERE phone_1 = ? AND ';
    let dupParams = [phoneCheck];
    if (clientId) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [existing] = await db.execute(dupQuery, dupParams);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Vendor with this phone number already exists.' });
    }

    const query = `
      INSERT INTO vendors (
        client_id, first_name, last_name, company, address_1, address_2, 
        city, country, phone_1, phone_2, email, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      clientId,
      first_name,
      last_name,
      company || null,
      address_1,
      address_2 || null,
      city,
      country,
      phone_1,
      phone_2 || null,
      email || null,
      created_by || 'System'
    ];

    const [result] = await db.execute(query, values);

    res.status(201).json({
      message: 'Vendor created successfully',
      vendor_id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/vendors
 * Fetches all vendors.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = 'SELECT * FROM vendors WHERE ';
    let params = [];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    query += ' ORDER BY vendor_id ASC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/vendors/:id
 * Fetches a single vendor.
 */
router.get('/:id', async (req, res) => {
  try {
    const vendorId = req.params.id;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = 'SELECT * FROM vendors WHERE vendor_id = ? AND ';
    let params = [vendorId];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/vendors/:id
 * Updates details for a specific vendor.
 */
router.put('/:id', async (req, res) => {
  try {
    const vendorId = req.params.id;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body.VendorModel || req.body || {};

    const { first_name, last_name, company, address_1, address_2, city, country, phone_1, phone_2, email } = data;

    let queryExist = 'SELECT * FROM vendors WHERE vendor_id = ? AND ';
    let paramsExist = [vendorId];
    if (clientId) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const existingVendor = rows[0];

    const finalFirstName = first_name !== undefined ? first_name : existingVendor.first_name;
    const finalLastName = last_name !== undefined ? last_name : existingVendor.last_name;
    const finalCompany = company !== undefined ? company : existingVendor.company;
    const finalAddress1 = address_1 !== undefined ? address_1 : existingVendor.address_1;
    const finalAddress2 = address_2 !== undefined ? address_2 : existingVendor.address_2;
    const finalCity = city !== undefined ? city : existingVendor.city;
    const finalCountry = country !== undefined ? country : existingVendor.country;
    const finalPhone1 = phone_1 !== undefined ? phone_1 : existingVendor.phone_1;
    const finalPhone2 = phone_2 !== undefined ? phone_2 : existingVendor.phone_2;
    const finalEmail = email !== undefined ? email : existingVendor.email;

    // Duplicate check
    if (phone_1 !== undefined) {
      const phoneCheck = phone_1.trim();
      let dupQuery = 'SELECT * FROM vendors WHERE phone_1 = ? AND vendor_id != ? AND ';
      let dupParams = [phoneCheck, vendorId];
      if (clientId) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [existingDup] = await db.execute(dupQuery, dupParams);
      if (existingDup.length > 0) {
        return res.status(400).json({ error: 'Vendor with this phone number already exists.' });
      }
    }

    let updateQuery = `
      UPDATE vendors SET 
        first_name = ?, last_name = ?, company = ?, address_1 = ?, address_2 = ?, 
        city = ?, country = ?, phone_1 = ?, phone_2 = ?, email = ?
      WHERE vendor_id = ? AND 
    `;
    let updateParams = [
      finalFirstName, finalLastName, finalCompany, finalAddress1, finalAddress2,
      finalCity, finalCountry, finalPhone1, finalPhone2, finalEmail,
      vendorId
    ];
    if (clientId) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);

    res.json({ message: 'Vendor updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/vendors/:id
 * Deletes a specific vendor.
 */
router.delete('/:id', async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let queryExist = 'SELECT * FROM vendors WHERE vendor_id = ? AND ';
    let paramsExist = [vendorId];
    if (clientId) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    let deleteQuery = 'DELETE FROM vendors WHERE vendor_id = ? AND ';
    let deleteParams = [vendorId];
    if (clientId) {
      deleteQuery += 'client_id = ?';
      deleteParams.push(clientId);
    } else {
      deleteQuery += 'client_id IS NULL';
    }

    await db.execute(deleteQuery, deleteParams);
    
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
