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
 * POST /api/customers
 * Registers a new customer.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.CustomerModel || req.body;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const {
      first_name,
      last_name,
      address_1,
      address_2,
      city,
      country,
      phone_1,
      phone_2,
      email,
      created_by
    } = data;

    if (!first_name || !last_name || !address_1 || !city || !country || !phone_1) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please ensure first_name, last_name, address_1, city, country, phone_1 are provided.' 
      });
    }

    // Check duplicate customer name (first_name + last_name)
    const firstNameCheck = first_name.trim().toLowerCase();
    const lastNameCheck = last_name.trim().toLowerCase();
    let nameQuery = 'SELECT * FROM customers WHERE LOWER(first_name) = ? AND LOWER(last_name) = ? AND ';
    let nameParams = [firstNameCheck, lastNameCheck];
    if (clientId) {
      nameQuery += 'client_id = ?';
      nameParams.push(clientId);
    } else {
      nameQuery += 'client_id IS NULL';
    }
    const [existingName] = await db.execute(nameQuery, nameParams);
    if (existingName.length > 0) {
      return res.status(400).json({ error: 'Customer with this name already exists.' });
    }

    // Check duplicate mobile number
    const phoneCheck = phone_1.trim();
    let dupQuery = 'SELECT * FROM customers WHERE phone_1 = ? AND ';
    let dupParams = [phoneCheck];
    if (clientId) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [existing] = await db.execute(dupQuery, dupParams);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Customer with this mobile number already exists.' });
    }

    const query = `
      INSERT INTO customers (
        client_id, first_name, last_name, address_1, address_2, 
        city, country, phone_1, phone_2, email, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      clientId,
      first_name,
      last_name,
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
      message: 'Customer registered successfully',
      customer_id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/customers
 * Fetches all registered customers.
 */
router.get('/', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }
    
    let query = 'SELECT * FROM customers WHERE ';
    let params = [];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    query += ' ORDER BY customer_id ASC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/customers/:id
 * Fetches a single customer by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let query = 'SELECT * FROM customers WHERE customer_id = ? AND ';
    let params = [customerId];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/customers/:id
 * Updates details for a specific customer.
 */
router.put('/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const data = req.body.CustomerModel || req.body;
    
    const {
      first_name,
      last_name,
      address_1,
      address_2,
      city,
      country,
      phone_1,
      phone_2,
      email
    } = data;

    let queryExist = 'SELECT * FROM customers WHERE customer_id = ? AND ';
    let paramsExist = [customerId];
    if (clientId) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const existingCustomer = rows[0];

    const finalFirstName = first_name !== undefined ? first_name : existingCustomer.first_name;
    const finalLastName = last_name !== undefined ? last_name : existingCustomer.last_name;
    const finalAddress1 = address_1 !== undefined ? address_1 : existingCustomer.address_1;
    const finalAddress2 = address_2 !== undefined ? address_2 : existingCustomer.address_2;
    const finalCity = city !== undefined ? city : existingCustomer.city;
    const finalCountry = country !== undefined ? country : existingCustomer.country;
    const finalPhone1 = phone_1 !== undefined ? phone_1 : existingCustomer.phone_1;
    const finalPhone2 = phone_2 !== undefined ? phone_2 : existingCustomer.phone_2;
    const finalEmail = email !== undefined ? email : existingCustomer.email;

    // Check duplicate customer name (first_name + last_name)
    if (first_name !== undefined || last_name !== undefined) {
      const finalFN = first_name !== undefined ? first_name : existingCustomer.first_name;
      const finalLN = last_name !== undefined ? last_name : existingCustomer.last_name;
      const firstNameCheck = finalFN.trim().toLowerCase();
      const lastNameCheck = finalLN.trim().toLowerCase();
      let dupNameQuery = 'SELECT * FROM customers WHERE LOWER(first_name) = ? AND LOWER(last_name) = ? AND customer_id != ? AND ';
      let dupNameParams = [firstNameCheck, lastNameCheck, customerId];
      if (clientId) {
        dupNameQuery += 'client_id = ?';
        dupNameParams.push(clientId);
      } else {
        dupNameQuery += 'client_id IS NULL';
      }
      const [existingDupName] = await db.execute(dupNameQuery, dupNameParams);
      if (existingDupName.length > 0) {
        return res.status(400).json({ error: 'Customer with this name already exists.' });
      }
    }

    // Check duplicate mobile number
    if (phone_1 !== undefined) {
      const phoneCheck = phone_1.trim();
      let dupQuery = 'SELECT * FROM customers WHERE phone_1 = ? AND customer_id != ? AND ';
      let dupParams = [phoneCheck, customerId];
      if (clientId) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [existingDup] = await db.execute(dupQuery, dupParams);
      if (existingDup.length > 0) {
        return res.status(400).json({ error: 'Customer with this mobile number already exists.' });
      }
    }

    let updateQuery = `
      UPDATE customers SET 
        first_name = ?, last_name = ?, address_1 = ?, address_2 = ?, 
        city = ?, country = ?, phone_1 = ?, phone_2 = ?, email = ?
      WHERE customer_id = ? AND 
    `;
    let updateParams = [
      finalFirstName, finalLastName, finalAddress1, finalAddress2,
      finalCity, finalCountry, finalPhone1, finalPhone2, finalEmail,
      customerId
    ];
    if (clientId) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);

    res.json({ message: 'Customer updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/customers/:id
 * Deletes a specific customer by ID.
 */
router.delete('/:id', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    let queryExist = 'SELECT * FROM customers WHERE customer_id = ? AND ';
    let paramsExist = [customerId];
    if (clientId) {
      queryExist += 'client_id = ?';
      paramsExist.push(clientId);
    } else {
      queryExist += 'client_id IS NULL';
    }

    const [rows] = await db.execute(queryExist, paramsExist);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    let deleteQuery = 'DELETE FROM customers WHERE customer_id = ? AND ';
    let deleteParams = [customerId];
    if (clientId) {
      deleteQuery += 'client_id = ?';
      deleteParams.push(clientId);
    } else {
      deleteQuery += 'client_id IS NULL';
    }

    await db.execute(deleteQuery, deleteParams);
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
