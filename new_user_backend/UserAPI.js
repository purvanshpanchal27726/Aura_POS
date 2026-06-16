const express = require('express');
const crypto = require('crypto');
const db = require('./db');

const router = express.Router();

const algorithm = 'aes-256-cbc';
const secret = process.env.ENCRYPTION_KEY || 'mySuperSecretKeyForPOSSystem1234';
const key = crypto.createHash('sha256').update(secret).digest();

/**
 * Encrypts a plain text password using AES-256-CBC.
 * Returns formatted string: 'iv_hex:ciphertext_hex'.
 */
const encryptPassword = (password) => {
  if (!password) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypts a formatted cipher password string using AES-256-CBC.
 */
const decryptPassword = (encryptedText) => {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    return encryptedText;
  }
};

/**
 * POST /api/users
 * Registers a new user.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body.UserModel || req.body;
    
    const {
      username,
      password,
      first_name,
      middle_name,
      last_name,
      address_1,
      address_2,
      address_3,
      city,
      country,
      phone_1,
      phone_2,
      email_1,
      email_2,
      role_id,
      created_by
    } = data;

    if (!username || !password || !first_name || !last_name || !address_1 || !city || !country || !phone_1 || !email_1) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please ensure username, password, first_name, last_name, address_1, city, country, phone_1, email_1 are provided.' 
      });
    }

    // Check if this is the first user (PostgreSQL COUNT returns string, must parseInt)
    const [countResult] = await db.query('SELECT COUNT(*) AS count FROM users');
    const isFirstUser = parseInt(countResult[0].count) === 0;
    const finalRoleId = isFirstUser ? 1 : (role_id ? parseInt(role_id) : 3);

    const encryptedPassword = encryptPassword(password);

    const query = `
      INSERT INTO users (
        username, password, first_name, middle_name, last_name, 
        address_1, address_2, address_3, city, country, 
        phone_1, phone_2, email_1, email_2, role_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      username,
      encryptedPassword,
      first_name,
      middle_name || null,
      last_name,
      address_1,
      address_2 || null,
      address_3 || null,
      city,
      country,
      phone_1,
      phone_2 || null,
      email_1,
      email_2 || null,
      finalRoleId,
      created_by || 'System'
    ];

    const [result] = await db.execute(query, values);
    
    res.status(201).json({
      message: 'User created successfully',
      user_id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users
 * Fetches all registered users, returning passwords in decrypted form.
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT u.*, r.name AS role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.role_id 
      ORDER BY u.user_id ASC
    `;
    const [rows] = await db.query(query);
    const decryptedRows = rows.map(row => {
      if (row.password) {
        row.password = decryptPassword(row.password);
      }
      return row;
    });
    res.json(decryptedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/users/:id
 * Updates details for a specific user.
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const data = req.body.UserModel || req.body;
    
    const {
      username,
      password,
      first_name,
      middle_name,
      last_name,
      address_1,
      address_2,
      address_3,
      city,
      country,
      phone_1,
      phone_2,
      email_1,
      email_2
    } = data;

    const [rows] = await db.execute('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingUser = rows[0];
    const finalUsername = username !== undefined ? username : existingUser.username;
    
    let finalPassword = existingUser.password;
    if (password) {
      finalPassword = encryptPassword(password);
    }

    const finalFirstName = first_name !== undefined ? first_name : existingUser.first_name;
    const finalMiddleName = middle_name !== undefined ? middle_name : existingUser.middle_name;
    const finalLastName = last_name !== undefined ? last_name : existingUser.last_name;
    const finalAddress1 = address_1 !== undefined ? address_1 : existingUser.address_1;
    const finalAddress2 = address_2 !== undefined ? address_2 : existingUser.address_2;
    const finalAddress3 = address_3 !== undefined ? address_3 : existingUser.address_3;
    const finalCity = city !== undefined ? city : existingUser.city;
    const finalCountry = country !== undefined ? country : existingUser.country;
    const finalPhone1 = phone_1 !== undefined ? phone_1 : existingUser.phone_1;
    const finalPhone2 = phone_2 !== undefined ? phone_2 : existingUser.phone_2;
    const finalEmail1 = email_1 !== undefined ? email_1 : existingUser.email_1;
    const finalEmail2 = email_2 !== undefined ? email_2 : existingUser.email_2;

    const role_id = data.role_id !== undefined ? data.role_id : existingUser.role_id;

    const query = `
      UPDATE users SET 
        username = ?, 
        password = ?, 
        first_name = ?, 
        middle_name = ?, 
        last_name = ?, 
        address_1 = ?, 
        address_2 = ?, 
        address_3 = ?, 
        city = ?, 
        country = ?, 
        phone_1 = ?, 
        phone_2 = ?, 
        email_1 = ?, 
        email_2 = ?,
        role_id = ?
      WHERE user_id = ?
    `;

    await db.execute(query, [
      finalUsername,
      finalPassword,
      finalFirstName,
      finalMiddleName,
      finalLastName,
      finalAddress1,
      finalAddress2,
      finalAddress3,
      finalCity,
      finalCountry,
      finalPhone1,
      finalPhone2,
      finalEmail1,
      finalEmail2,
      role_id ? parseInt(role_id) : null,
      userId
    ]);

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/users/login
 * Validates a user's credentials.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const query = `
      SELECT u.*, r.name AS role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.role_id 
      WHERE u.username = ?
    `;
    const [rows] = await db.execute(query, [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    if (user.username !== username) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const decrypted = decryptPassword(user.password);
    if (decrypted !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Strip password before returning
    delete user.password;
    res.json({
      message: 'Login successful',
      user: {
        ...user,
        id: user.user_id
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/users/:id
 * Deletes a specific user by ID and shifts IDs down.
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const [rows] = await db.execute('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM users WHERE user_id = ?', [userId]);
    await db.execute('UPDATE users SET user_id = user_id - 1 WHERE user_id > ?', [userId]);
    await db.execute('ALTER TABLE users AUTO_INCREMENT = 1');
    await db.query('COMMIT');
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

