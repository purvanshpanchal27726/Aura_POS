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
 * POST /api/customers
 * Registers a new customer.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.CustomerModel || req.body;
    const clientId = getClientId(req);
    
    if (!clientId) {
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

    // Check duplicate mobile number
    const phoneCheck = phone_1.trim();
    const [existing] = await db.execute('SELECT * FROM customers WHERE phone_1 = ? AND client_id = ?', [phoneCheck, clientId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Customer with this mobile number already exists.' });
    }

    const query = `
      INSERT INTO customers (
        client_id, first_name, last_name, address_1, address_2, city, country, 
        phone_1, phone_2, email, created_by
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
      message: 'Customer created successfully',
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
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }
    const [rows] = await db.query('SELECT * FROM customers WHERE client_id = ? ORDER BY customer_id ASC', [clientId]);
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
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }
    const [rows] = await db.execute('SELECT * FROM customers WHERE customer_id = ? AND client_id = ?', [customerId, clientId]);
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
    if (!clientId) {
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

    const [rows] = await db.execute('SELECT * FROM customers WHERE customer_id = ? AND client_id = ?', [customerId, clientId]);
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

    // Check duplicate mobile number
    if (finalPhone1) {
      const [existing] = await db.execute('SELECT * FROM customers WHERE phone_1 = ? AND customer_id != ? AND client_id = ?', [finalPhone1.trim(), customerId, clientId]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Customer with this mobile number already exists.' });
      }
    }

    const query = `
      UPDATE customers SET 
        first_name = ?, 
        last_name = ?, 
        address_1 = ?, 
        address_2 = ?, 
        city = ?, 
        country = ?, 
        phone_1 = ?, 
        phone_2 = ?, 
        email = ?
      WHERE customer_id = ? AND client_id = ?
    `;

    await db.execute(query, [
      finalFirstName,
      finalLastName,
      finalAddress1,
      finalAddress2,
      finalCity,
      finalCountry,
      finalPhone1,
      finalPhone2,
      finalEmail,
      customerId,
      clientId
    ]);

    res.json({ message: 'Customer updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/customers/:id
 * Deletes a specific customer by ID and shifts subsequent IDs down.
 */
router.delete('/:id', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const [rows] = await db.execute('SELECT * FROM customers WHERE customer_id = ? AND client_id = ?', [customerId, clientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM customers WHERE customer_id = ? AND client_id = ?', [customerId, clientId]);
    await db.execute('UPDATE customers SET customer_id = customer_id - 1 WHERE customer_id > ? AND client_id = ?', [customerId, clientId]);
    await db.execute('ALTER TABLE customers AUTO_INCREMENT = 1');
    await db.query('COMMIT');
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

