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
 * POST /api/vendors
 * Creates a new vendor.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.VendorModel || req.body || {};
    const clientId = getClientId(req);
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const { first_name, last_name, company, address_1, address_2, city, country, phone_1, phone_2, email, created_by } = data;

    if (!first_name || !last_name || !address_1 || !city || !country || !phone_1) {
      return res.status(400).json({ error: 'Missing required fields for Vendor creation.' });
    }

    // Check duplicate vendor records (Company, Mobile, Email)
    const companyCheck = company ? company.trim().toLowerCase() : '';
    const phoneCheck = phone_1.trim();
    const emailCheck = email ? email.trim().toLowerCase() : '';

    let queryDup = 'SELECT * FROM vendors WHERE (phone_1 = ?';
    let paramsDup = [phoneCheck];
    if (emailCheck) {
      queryDup += ' OR LOWER(email) = ?';
      paramsDup.push(emailCheck);
    }
    if (companyCheck) {
      queryDup += ' OR LOWER(company) = ?';
      paramsDup.push(companyCheck);
    }
    queryDup += ') AND client_id = ?';
    paramsDup.push(clientId);
    
    const [existing] = await db.execute(queryDup, paramsDup);
    if (existing.length > 0) {
      const dup = existing[0];
      if (companyCheck && dup.company && dup.company.trim().toLowerCase() === companyCheck) {
        return res.status(400).json({ error: 'Vendor with this company name already exists.' });
      }
      if (dup.phone_1 === phoneCheck) {
        return res.status(400).json({ error: 'Vendor with this mobile number already exists.' });
      }
      if (emailCheck && dup.email && dup.email.trim().toLowerCase() === emailCheck) {
        return res.status(400).json({ error: 'Vendor with this email ID already exists.' });
      }
    }

    const query = `
      INSERT INTO vendors (
        client_id, first_name, last_name, company, address_1, address_2, 
        city, country, phone_1, phone_2, email, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
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
    ]);

    res.status(201).json({ message: 'Vendor created successfully', vendor_id: result.insertId });
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
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }
    const [rows] = await db.query('SELECT * FROM vendors WHERE client_id = ? ORDER BY vendor_id ASC', [clientId]);
    res.json(rows.map(r => ({ ...r, id: r.vendor_id })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/vendors/:id
 * Fetches a single vendor by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const vendorId = req.params.id;
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }
    const [rows] = await db.execute('SELECT * FROM vendors WHERE vendor_id = ? AND client_id = ?', [vendorId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json({ ...rows[0], id: rows[0].vendor_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/vendors/:id
 * Updates details of a vendor.
 */
router.put('/:id', async (req, res) => {
  try {
    const vendorId = req.params.id;
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body.VendorModel || req.body || {};
    const { first_name, last_name, company, address_1, address_2, city, country, phone_1, phone_2, email } = data;

    const [rows] = await db.execute('SELECT * FROM vendors WHERE vendor_id = ? AND client_id = ?', [vendorId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const existing = rows[0];
    const f_name = first_name !== undefined ? first_name : existing.first_name;
    const l_name = last_name !== undefined ? last_name : existing.last_name;
    const comp = company !== undefined ? company : existing.company;
    const addr1 = address_1 !== undefined ? address_1 : existing.address_1;
    const addr2 = address_2 !== undefined ? address_2 : existing.address_2;
    const c_city = city !== undefined ? city : existing.city;
    const c_country = country !== undefined ? country : existing.country;
    const p1 = phone_1 !== undefined ? phone_1 : existing.phone_1;
    const p2 = phone_2 !== undefined ? phone_2 : existing.phone_2;
    const mail = email !== undefined ? email : existing.email;

    // Check duplicate vendor records (Company, Mobile, Email)
    const f_company = comp ? comp.trim().toLowerCase() : '';
    const f_phone = p1.trim();
    const f_email = mail ? mail.trim().toLowerCase() : '';

    let queryDup = '(phone_1 = ?';
    let paramsDup = [f_phone];
    if (f_email) {
      queryDup += ' OR LOWER(email) = ?';
      paramsDup.push(f_email);
    }
    if (f_company) {
      queryDup += ' OR LOWER(company) = ?';
      paramsDup.push(f_company);
    }
    queryDup += ') AND vendor_id != ? AND client_id = ?';
    paramsDup.push(vendorId, clientId);

    const [existingDup] = await db.execute(`SELECT * FROM vendors WHERE ${queryDup}`, paramsDup);
    if (existingDup.length > 0) {
      const dup = existingDup[0];
      if (f_company && dup.company && dup.company.trim().toLowerCase() === f_company) {
        return res.status(400).json({ error: 'Vendor with this company name already exists.' });
      }
      if (dup.phone_1 === f_phone) {
        return res.status(400).json({ error: 'Vendor with this mobile number already exists.' });
      }
      if (f_email && dup.email && dup.email.trim().toLowerCase() === f_email) {
        return res.status(400).json({ error: 'Vendor with this email ID already exists.' });
      }
    }

    const query = `
      UPDATE vendors SET 
        first_name = ?, last_name = ?, company = ?, address_1 = ?, address_2 = ?, 
        city = ?, country = ?, phone_1 = ?, phone_2 = ?, email = ?
      WHERE vendor_id = ? AND client_id = ?
    `;

    await db.execute(query, [f_name, l_name, comp, addr1, addr2, c_city, c_country, p1, p2, mail, vendorId, clientId]);
    res.json({ message: 'Vendor updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/vendors/:id
 * Deletes a vendor and shifts subsequent IDs down.
 */
router.delete('/:id', async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const [rows] = await db.execute('SELECT * FROM vendors WHERE vendor_id = ? AND client_id = ?', [vendorId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM vendors WHERE vendor_id = ? AND client_id = ?', [vendorId, clientId]);
    await db.execute('UPDATE vendors SET vendor_id = vendor_id - 1 WHERE vendor_id > ? AND client_id = ?', [vendorId, clientId]);
    await db.execute('ALTER TABLE vendors AUTO_INCREMENT = 1');
    await db.query('COMMIT');
    
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

