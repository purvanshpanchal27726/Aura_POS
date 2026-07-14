const express = require('express');
const router = express.Router();
const db = require('./db');

// Helper to get client_id from headers or query params
const getClientId = (req) => {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  return cid ? parseInt(cid) : null;
};

// 👥 1. GET ALL EMPLOYEES
router.get('/', async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: 'Client ID required' });

  try {
    const [rows] = await db.execute(`
      SELECT e.*, u.first_name, u.last_name, u.email, u.phone, u.role_id, r.role_name
      FROM employees e
      INNER JOIN users u ON e.user_id = u.user_id
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE e.client_id = ? AND e.active = 1
      ORDER BY u.first_name, u.last_name
    `, [clientId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 👥 2. ADD EMPLOYEE
router.post('/', async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: 'Client ID required' });

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

    // Check if user already exists
    let userId;
    const [existing] = await conn.execute(
      'SELECT user_id FROM users WHERE phone = ? AND client_id = ?',
      [phone, clientId]
    );

    if (existing.length > 0) {
      userId = existing[0].user_id;
    } else {
      // Create user entry
      const plainPassword = password || designation?.toLowerCase() || '123456';
      const [userRes] = await conn.execute(`
        INSERT INTO users (client_id, first_name, last_name, email, phone, password, role_id, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `, [clientId, first_name, last_name, email || null, phone, plainPassword, role_id || null]);
      userId = userRes.insertId;
    }

    // Check if already registered as employee
    const [existingEmp] = await conn.execute(
      'SELECT employee_id FROM employees WHERE user_id = ? AND client_id = ?',
      [userId, clientId]
    );

    let empId;
    if (existingEmp.length > 0) {
      // Re-activate existing employee
      empId = existingEmp[0].employee_id;
      await conn.execute(`
        UPDATE employees 
        SET designation = ?, department = ?, salary = ?, join_date = ?, active = 1
        WHERE employee_id = ?
      `, [designation || null, department || null, salary || 0.0, join_date || null, empId]);
    } else {
      // Insert employee details
      const [empRes] = await conn.execute(`
        INSERT INTO employees (client_id, user_id, designation, department, salary, join_date, active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `, [clientId, userId, designation || null, department || null, salary || 0.0, join_date || null]);
      empId = empRes.insertId;
    }

    await conn.commit();
    res.status(201).json({ employee_id: empId, message: 'Employee registered successfully!' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 👥 3. UPDATE EMPLOYEE
router.put('/:id', async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: 'Client ID required' });
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

    const [empRows] = await conn.execute(
      'SELECT user_id FROM employees WHERE employee_id = ? AND client_id = ?',
      [empId, clientId]
    );
    if (empRows.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Employee not found' });
    }
    const userId = empRows[0].user_id;

    // Update user general details
    await conn.execute(`
      UPDATE users 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, role_id = ?
      WHERE user_id = ? AND client_id = ?
    `, [first_name, last_name, email || null, phone, role_id || null, userId, clientId]);

    // Update employee designations
    await conn.execute(`
      UPDATE employees
      SET designation = ?, department = ?, salary = ?, join_date = ?
      WHERE employee_id = ? AND client_id = ?
    `, [designation || null, department || null, salary || 0.0, join_date || null, empId, clientId]);

    await conn.commit();
    res.json({ message: 'Employee details updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 👥 4. DELETE / DEACTIVATE EMPLOYEE
router.delete('/:id', async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: 'Client ID required' });
  const empId = parseInt(req.params.id);

  try {
    await db.execute('UPDATE employees SET active = 0 WHERE employee_id = ? AND client_id = ?', [empId, clientId]);
    res.json({ message: 'Employee deactivated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// 📅 5. GET ATTENDANCE LOGS
router.get('/attendance', async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: 'Client ID required' });
  
  const date = req.query.date || new Date().toISOString().substring(0, 10);

  try {
    // Return list of all employees and their check-in/out logs for that date
    const [rows] = await db.execute(`
      SELECT e.employee_id, e.designation, e.department,
             u.first_name, u.last_name,
             a.id AS attendance_id, a.date, a.check_in, a.check_out, 
             COALESCE(a.status, 'absent') AS status
      FROM employees e
      INNER JOIN users u ON e.user_id = u.user_id
      LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.date = ? AND a.client_id = ?
      WHERE e.client_id = ? AND e.active = 1
      ORDER BY u.first_name, u.last_name
    `, [date, clientId, clientId]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 📅 6. MARK DIRECT ATTENDANCE STATUS
router.post('/attendance/status', async (req, res) => {
  const clientId = getClientId(req);
  if (!clientId) return res.status(400).json({ error: 'Client ID required' });

  const { employee_id, date, status } = req.body;
  if (!employee_id || !date || !status) {
    return res.status(400).json({ error: 'Employee ID, date, and status are required' });
  }

  try {
    // Check if record exists
    const [existing] = await db.execute(
      'SELECT id FROM attendance WHERE employee_id = ? AND date = ? AND client_id = ?',
      [employee_id, date, clientId]
    );

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
  if (!clientId) return res.status(400).json({ error: 'Client ID required' });

  const { employee_id, date, time } = req.body;
  const targetDate = date || new Date().toISOString().substring(0, 10);
  const targetTime = time || new Date().toLocaleTimeString('en-US', { hour12: false });

  try {
    const [existing] = await db.execute(
      'SELECT id FROM attendance WHERE employee_id = ? AND date = ? AND client_id = ?',
      [employee_id, targetDate, clientId]
    );

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
  if (!clientId) return res.status(400).json({ error: 'Client ID required' });

  const { employee_id, date, time } = req.body;
  const targetDate = date || new Date().toISOString().substring(0, 10);
  const targetTime = time || new Date().toLocaleTimeString('en-US', { hour12: false });

  try {
    const [existing] = await db.execute(
      'SELECT id FROM attendance WHERE employee_id = ? AND date = ? AND client_id = ?',
      [employee_id, targetDate, clientId]
    );

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
