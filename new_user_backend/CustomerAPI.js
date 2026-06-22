const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * POST /api/customers
 * Registers a new customer.
 */
router.post('/', async (req, res) => {
  try {
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
      email,
      created_by
    } = data;

    if (!first_name || !last_name || !address_1 || !city || !country || !phone_1 || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please ensure first_name, last_name, address_1, city, country, phone_1, email are provided.' 
      });
    }

    // Check duplicate mobile number
    const phoneCheck = phone_1.trim();
    const [existing] = await db.execute('SELECT * FROM customers WHERE phone_1 = ?', [phoneCheck]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Customer with this mobile number already exists.' });
    }

    const query = `
      INSERT INTO customers (
        first_name, last_name, address_1, address_2, city, country, 
        phone_1, phone_2, email, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      first_name,
      last_name,
      address_1,
      address_2 || null,
      city,
      country,
      phone_1,
      phone_2 || null,
      email,
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
    const [rows] = await db.query('SELECT * FROM customers ORDER BY customer_id ASC');
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
    const [rows] = await db.execute('SELECT * FROM customers WHERE customer_id = ?', [customerId]);
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

    const [rows] = await db.execute('SELECT * FROM customers WHERE customer_id = ?', [customerId]);
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
      const [existing] = await db.execute('SELECT * FROM customers WHERE phone_1 = ? AND customer_id != ?', [finalPhone1.trim(), customerId]);
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
      WHERE customer_id = ?
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
      customerId
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

    const [rows] = await db.execute('SELECT * FROM customers WHERE customer_id = ?', [customerId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM customers WHERE customer_id = ?', [customerId]);
    await db.execute('UPDATE customers SET customer_id = customer_id - 1 WHERE customer_id > ?', [customerId]);
    await db.execute('ALTER TABLE customers AUTO_INCREMENT = 1');
    await db.query('COMMIT');
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

