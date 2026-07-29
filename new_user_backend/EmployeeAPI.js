const express = require('express');
const router = express.Router();
const db = require('./db');
const bcrypt = require('bcryptjs');

// Helper to get client_id from headers or query params
const getClientId = (req) => {
  let cid = req.headers['x-client-id'] || req.query.client_id;
  if (cid === undefined || cid === null || cid === 'null' || cid === 'undefined') {
    if (req.user && req.user.client_id !== undefined && req.user.client_id !== null) {
      cid = req.user.client_id;
    }
  }
  if (cid === undefined || cid === null || cid === 'null' || cid === 'undefined') return null;
  const parsed = parseInt(cid);
  return isNaN(parsed) ? null : parsed;
};

// Helper to check if active user is a Super-Admin
const checkSuperAdmin = (req) => {
  return !req.user || req.user.role_id === 1 || req.user.client_id === 0 || req.user.client_id === null || req.user.client_id === undefined;
};

// 👥 1. GET ALL EMPLOYEES
router.get('/', async (req, res) => {
  const clientId = getClientId(req);
  const isSuperAdmin = checkSuperAdmin(req);
  if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

  try {
    let query = `
      SELECT e.*, u.first_name, u.last_name, u.email_1 AS email, u.phone_1 AS phone, u.role_id, r.name AS role_name
      FROM employees e
      INNER JOIN users u ON e.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE e.active = 1 AND 
    `;
    let params = [];
    if (clientId !== null && clientId !== undefined) {
      query += 'e.client_id = ?';
      params.push(clientId);
    } else {
      query += 'e.client_id IS NULL';
    }
    query += ' ORDER BY u.first_name, u.last_name';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 👥 2. ADD EMPLOYEE
router.post('/', async (req, res) => {
  const clientId = getClientId(req);
  const isSuperAdmin = checkSuperAdmin(req);
  if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

  const {
    first_name,
    last_name,
    email,
    phone,
    password,
    role_id,
    designation,
    department,
    salary,
    join_date
  } = req.body;

  if (!first_name || !last_name || !phone) {
    return res.status(400).json({ error: 'First name, last name, and phone number are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check for duplicate phone number
    let queryExisting = 'SELECT user_id FROM users WHERE phone_1 = ? AND ';
    let paramsExisting = [phone];
    if (clientId !== null && clientId !== undefined) {
      queryExisting += 'client_id = ?';
      paramsExisting.push(clientId);
    } else {
      queryExisting += 'client_id IS NULL';
    }
    const [existing] = await conn.execute(queryExisting, paramsExisting);
    if (existing.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Employee with this phone number already exists.' });
    }

    // Check for duplicate name
    let nameCheckQuery = 'SELECT user_id FROM users WHERE LOWER(first_name) = ? AND LOWER(last_name) = ? AND ';
    let nameCheckParams = [first_name.trim().toLowerCase(), last_name.trim().toLowerCase()];
    if (clientId !== null && clientId !== undefined) {
      nameCheckQuery += 'client_id = ?';
      nameCheckParams.push(clientId);
    } else {
      nameCheckQuery += 'client_id IS NULL';
    }
    const [nameRows] = await conn.execute(nameCheckQuery, nameCheckParams);
    if (nameRows.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Employee with this name already exists.' });
    }

    // Create user entry
    let userId;
    {
      const plainPassword = password || designation?.toLowerCase() || '123456';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const generatedUsername = `${first_name.toLowerCase()}_${phone.slice(-4)}`;

      let userQuery = `
        INSERT INTO users (
          client_id, username, password, first_name, last_name, 
          address_1, city, country, phone_1, email_1, role_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      let userParams = [
        clientId,
        generatedUsername,
        hashedPassword,
        first_name,
        last_name,
        'Not Specified',
        'Not Specified',
        'India',
        phone,
        email || `${generatedUsername}@example.com`,
        role_id || null
      ];
      const [userRes] = await conn.execute(userQuery, userParams);
      userId = userRes.insertId;
    }

    // Check if already registered as employee
    let queryExistingEmp = 'SELECT employee_id FROM employees WHERE user_id = ? AND ';
    let paramsExistingEmp = [userId];
    if (clientId !== null && clientId !== undefined) {
      queryExistingEmp += 'client_id = ?';
      paramsExistingEmp.push(clientId);
    } else {
      queryExistingEmp += 'client_id IS NULL';
    }

    const [existingEmp] = await conn.execute(queryExistingEmp, paramsExistingEmp);

    let empId;
    if (existingEmp.length > 0) {
      // Re-activate existing employee
      empId = existingEmp[0].employee_id;
      let updateQuery = `
        UPDATE employees 
        SET designation = ?, department = ?, salary = ?, join_date = ?, active = 1
        WHERE employee_id = ? AND 
      `;
      let updateParams = [designation || null, department || null, salary || 0.0, join_date || null, empId];
      if (clientId !== null && clientId !== undefined) {
        updateQuery += 'client_id = ?';
        updateParams.push(clientId);
      } else {
        updateQuery += 'client_id IS NULL';
      }
      await conn.execute(updateQuery, updateParams);
    } else {
      // Insert employee details
      let insertQuery = `
        INSERT INTO employees (client_id, user_id, designation, department, salary, join_date, active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `;
      let insertParams = [clientId, userId, designation || null, department || null, salary || 0.0, join_date || null];
      const [empRes] = await conn.execute(insertQuery, insertParams);
      empId = empRes.insertId;
    }

    await conn.commit();
    return res.status(201).json({ employee_id: empId, message: 'Employee registered successfully!' });
  } catch (err) {
    if (conn && conn.rollback) await conn.rollback().catch(() => {});
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (conn && conn.release) {
      try { conn.release(); } catch (e) {}
    }
  }
});

// 👥 3. UPDATE EMPLOYEE
router.put('/:id', async (req, res) => {
  const clientId = getClientId(req);
  const isSuperAdmin = checkSuperAdmin(req);
  if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });
  const empId = parseInt(req.params.id);

  const {
    first_name,
    last_name,
    email,
    phone,
    role_id,
    designation,
    department,
    salary,
    join_date
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let queryEmp = 'SELECT user_id FROM employees WHERE employee_id = ? AND ';
    let paramsEmp = [empId];
    if (clientId !== null && clientId !== undefined) {
      queryEmp += 'client_id = ?';
      paramsEmp.push(clientId);
    } else {
      queryEmp += 'client_id IS NULL';
    }

    const [empRows] = await conn.execute(queryEmp, paramsEmp);
    if (empRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Employee not found' });
    }
    const userId = empRows[0].user_id;

    // Update user general details
    let userUpdateQuery = `
      UPDATE users 
      SET first_name = ?, last_name = ?, email_1 = ?, phone_1 = ?, role_id = ?
      WHERE user_id = ? AND 
    `;
    let userUpdateParams = [first_name, last_name, email || null, phone, role_id || null, userId];
    if (clientId !== null && clientId !== undefined) {
      userUpdateQuery += 'client_id = ?';
      userUpdateParams.push(clientId);
    } else {
      userUpdateQuery += 'client_id IS NULL';
    }
    await conn.execute(userUpdateQuery, userUpdateParams);

    // Update employee designations
    let empUpdateQuery = `
      UPDATE employees
      SET designation = ?, department = ?, salary = ?, join_date = ?
      WHERE employee_id = ? AND 
    `;
    let empUpdateParams = [designation || null, department || null, salary || 0.0, join_date || null, empId];
    if (clientId !== null && clientId !== undefined) {
      empUpdateQuery += 'client_id = ?';
      empUpdateParams.push(clientId);
    } else {
      empUpdateQuery += 'client_id IS NULL';
    }
    await conn.execute(empUpdateQuery, empUpdateParams);

    await conn.commit();
    res.json({ message: 'Employee details updated successfully' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 👥 4. DELETE / DEACTIVATE EMPLOYEE
router.delete('/:id', async (req, res) => {
  const clientId = getClientId(req);
  const isSuperAdmin = checkSuperAdmin(req);
  if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });
  const empId = parseInt(req.params.id);

  try {
    let query = 'UPDATE employees SET active = 0 WHERE employee_id = ? AND ';
    let params = [empId];
    if (clientId !== null && clientId !== undefined) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    await db.execute(query, params);
    res.json({ message: 'Employee deactivated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 📅 5. GET ATTENDANCE LOGS
router.get('/attendance', async (req, res) => {
  const clientId = getClientId(req);
  const isSuperAdmin = checkSuperAdmin(req);
  if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });
  
  const date = req.query.date || new Date().toISOString().substring(0, 10);

  try {
    let query = `
      SELECT e.employee_id, e.designation, e.department,
             u.first_name, u.last_name,
             a.id AS attendance_id, a.date, a.check_in, a.check_out, 
             COALESCE(a.status, 'absent') AS status
      FROM employees e
      INNER JOIN users u ON e.user_id = u.user_id
      LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.date = ? AND ${clientId ? 'a.client_id = ?' : 'a.client_id IS NULL'}
      WHERE e.active = 1 AND ${clientId ? 'e.client_id = ?' : 'e.client_id IS NULL'}
      ORDER BY u.first_name, u.last_name
    `;
    let params = [date];
    if (clientId !== null && clientId !== undefined) {
      params.push(clientId, clientId);
    }

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 📅 6. MARK DIRECT ATTENDANCE STATUS
router.post('/attendance/status', async (req, res) => {
  const clientId = getClientId(req);
  const isSuperAdmin = checkSuperAdmin(req);
  if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

  const { employee_id, date, status } = req.body;
  if (!employee_id || !date || !status) {
    return res.status(400).json({ error: 'Employee ID, date, and status are required' });
  }

  try {
    let selectQuery = 'SELECT id FROM attendance WHERE employee_id = ? AND date = ? AND ';
    let selectParams = [employee_id, date];
    if (clientId !== null && clientId !== undefined) {
      selectQuery += 'client_id = ?';
      selectParams.push(clientId);
    } else {
      selectQuery += 'client_id IS NULL';
    }

    const [existing] = await db.execute(selectQuery, selectParams);

    if (existing.length > 0) {
      await db.execute(
        'UPDATE attendance SET status = ? WHERE id = ?',
        [status, existing[0].id]
      );
    } else {
      await db.execute(
        'INSERT INTO attendance (client_id, employee_id, date, status) VALUES (?, ?, ?, ?)',
        [clientId, employee_id, date, status]
      );
    }

    res.json({ message: 'Attendance status logged successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 📅 7. CHECK-IN LOG
router.post('/attendance/check-in', async (req, res) => {
  const clientId = getClientId(req);
  const isSuperAdmin = checkSuperAdmin(req);
  if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

  const { employee_id, date, time } = req.body;
  const targetDate = date || new Date().toISOString().substring(0, 10);
  const targetTime = time || new Date().toLocaleTimeString('en-US', { hour12: false });

  try {
    let selectQuery = 'SELECT id FROM attendance WHERE employee_id = ? AND date = ? AND ';
    let selectParams = [employee_id, targetDate];
    if (clientId !== null && clientId !== undefined) {
      selectQuery += 'client_id = ?';
      selectParams.push(clientId);
    } else {
      selectQuery += 'client_id IS NULL';
    }

    const [existing] = await db.execute(selectQuery, selectParams);

    if (existing.length > 0) {
      await db.execute(
        "UPDATE attendance SET check_in = ?, status = 'present' WHERE id = ?",
        [targetTime, existing[0].id]
      );
    } else {
      await db.execute(
        "INSERT INTO attendance (client_id, employee_id, date, check_in, status) VALUES (?, ?, ?, ?, 'present')",
        [clientId, employee_id, targetDate, targetTime]
      );
    }

    res.json({ message: 'Checked-in successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 📅 8. CHECK-OUT LOG
router.post('/attendance/check-out', async (req, res) => {
  const clientId = getClientId(req);
  const isSuperAdmin = checkSuperAdmin(req);
  if (clientId === null && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

  const { employee_id, date, time } = req.body;
  const targetDate = date || new Date().toISOString().substring(0, 10);
  const targetTime = time || new Date().toLocaleTimeString('en-US', { hour12: false });

  try {
    let selectQuery = 'SELECT id FROM attendance WHERE employee_id = ? AND date = ? AND ';
    let selectParams = [employee_id, targetDate];
    if (clientId !== null && clientId !== undefined) {
      selectQuery += 'client_id = ?';
      selectParams.push(clientId);
    } else {
      selectQuery += 'client_id IS NULL';
    }

    const [existing] = await db.execute(selectQuery, selectParams);

    if (existing.length > 0) {
      await db.execute(
        "UPDATE attendance SET check_out = ?, status = 'present' WHERE id = ?",
        [targetTime, existing[0].id]
      );
      res.json({ message: 'Checked-out successfully!' });
    } else {
      res.status(404).json({ error: 'No check-in record found for today' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
