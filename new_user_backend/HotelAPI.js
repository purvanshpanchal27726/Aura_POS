const express = require('express');
const db = require('./db');
const eventBus = require('./eventBus');

const router = express.Router();

// Helper to get client_id from headers or query params
function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (!cid || cid === 'null' || cid === 'undefined') return null;
  return parseInt(cid);
}

// Helper to check if active user is a Super-Admin
function checkSuperAdmin(req) {
  return !req.user || req.user.role_id === 1 || req.user.client_id === null || req.user.client_id === undefined;
}

// ─────────────────────────────────────────────────────────────────────────
// 🛏️ HOTEL ROOMS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

// Get all rooms
router.get('/rooms', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = 'SELECT room_id, client_id, room_no, type AS room_type, price_per_night, status, floor, amenities, active, ROW_NUMBER() OVER(ORDER BY room_id ASC)::integer AS display_id FROM hotel_rooms WHERE active = 1 AND ';
    let params = [];
    if (clientId) {
      query += 'client_id = $1';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    query += ' ORDER BY room_no';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create room
router.post('/rooms', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { room_no, room_type, price_per_night } = req.body;
    if (!room_no || !room_type || price_per_night === undefined) {
      return res.status(400).json({ error: 'Room number, type, and price per night are required' });
    }

    // Check for duplicate room_no
    let dupQuery = 'SELECT room_id FROM hotel_rooms WHERE room_no = ? AND ';
    let dupParams = [room_no];
    if (clientId) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [dupRows] = await db.execute(dupQuery, dupParams);
    if (dupRows.length > 0) return res.status(400).json({ error: 'Room with this number already exists.' });

    const [result] = await db.execute(
      'INSERT INTO hotel_rooms (client_id, room_no, type, price_per_night, status) VALUES (?, ?, ?, ?, ?)',
      [clientId, room_no, room_type, price_per_night, 'available']
    );

    res.status(201).json({ room_id: result.insertId, message: 'Room created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update room
router.put('/rooms/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { room_no, room_type, price_per_night, status } = req.body;

    let query = 'SELECT * FROM hotel_rooms WHERE room_id = ? AND ';
    let params = [id];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });

    // Check duplicate room_no (excluding itself)
    if (room_no !== undefined) {
      let dupQuery = 'SELECT room_id FROM hotel_rooms WHERE room_no = ? AND room_id != ? AND ';
      let dupParams = [room_no, id];
      if (clientId) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [dupRows] = await db.execute(dupQuery, dupParams);
      if (dupRows.length > 0) return res.status(400).json({ error: 'Room with this number already exists.' });
    }

    let updateQuery = `
      UPDATE hotel_rooms 
      SET room_no = ?, type = ?, price_per_night = ?, status = ? 
      WHERE room_id = ? AND 
    `;
    let updateParams = [
      room_no !== undefined ? room_no : rows[0].room_no,
      room_type !== undefined ? room_type : rows[0].type,
      price_per_night !== undefined ? price_per_night : rows[0].price_per_night,
      status !== undefined ? status : rows[0].status,
      id
    ];
    if (clientId) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);
    res.json({ message: 'Room updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete room (soft delete)
router.delete('/rooms/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    
    let query = 'UPDATE hotel_rooms SET active = 0 WHERE room_id = ? AND ';
    let params = [id];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    await db.execute(query, params);
    res.json({ message: 'Room de-registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 👤 HOTEL GUESTS
// ─────────────────────────────────────────────────────────────────────────

// Get all guests
router.get('/guests', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = `
      SELECT guest_id, client_id, CONCAT(first_name, ' ', last_name) AS name, 
             first_name, last_name, phone, email, id_type AS id_proof_type, 
             id_number AS id_proof_no, address, loyalty_points,
             ROW_NUMBER() OVER(ORDER BY guest_id ASC)::integer AS display_id
      FROM hotel_guests WHERE 
    `;
    let params = [];
    if (clientId) {
      query += 'client_id = $1';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }
    query += ' ORDER BY first_name, last_name';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create guest
router.post('/guests', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { name, phone, email, id_proof_type, id_proof_no } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    // Check for duplicate phone number
    let dupQuery = 'SELECT guest_id FROM hotel_guests WHERE phone = ? AND ';
    let dupParams = [phone];
    if (clientId) {
      dupQuery += 'client_id = ?';
      dupParams.push(clientId);
    } else {
      dupQuery += 'client_id IS NULL';
    }
    const [dupRows] = await db.execute(dupQuery, dupParams);
    if (dupRows.length > 0) return res.status(400).json({ error: 'Guest with this phone number already exists.' });

    const nameParts = (name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Guest';
    const lastName = nameParts.slice(1).join(' ') || '';

    const [result] = await db.execute(
      `INSERT INTO hotel_guests (client_id, first_name, last_name, phone, email, id_type, id_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clientId, firstName, lastName, phone, email || null, id_proof_type || 'Aadhaar', id_proof_no || '']
    );

    res.status(201).json({ guest_id: result.insertId, message: 'Guest registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update guest
router.put('/guests/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { name, phone, email, id_proof_type, id_proof_no } = req.body;

    let query = 'SELECT * FROM hotel_guests WHERE guest_id = ? AND ';
    let params = [id];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [rows] = await db.execute(query, params);
    if (rows.length === 0) return res.status(404).json({ error: 'Guest not found' });

    // Check duplicate phone (excluding itself)
    if (phone !== undefined) {
      let dupQuery = 'SELECT guest_id FROM hotel_guests WHERE phone = ? AND guest_id != ? AND ';
      let dupParams = [phone, id];
      if (clientId) {
        dupQuery += 'client_id = ?';
        dupParams.push(clientId);
      } else {
        dupQuery += 'client_id IS NULL';
      }
      const [dupRows] = await db.execute(dupQuery, dupParams);
      if (dupRows.length > 0) return res.status(400).json({ error: 'Guest with this phone number already exists.' });
    }

    let firstName = rows[0].first_name;
    let lastName = rows[0].last_name;
    if (name !== undefined) {
      const nameParts = (name || '').trim().split(/\s+/);
      firstName = nameParts[0] || 'Guest';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    let updateQuery = `
      UPDATE hotel_guests 
      SET first_name = ?, last_name = ?, phone = ?, email = ?, id_type = ?, id_number = ? 
      WHERE guest_id = ? AND 
    `;
    let updateParams = [
      firstName,
      lastName,
      phone !== undefined ? phone : rows[0].phone,
      email !== undefined ? email : rows[0].email,
      id_proof_type !== undefined ? id_proof_type : rows[0].id_type,
      id_proof_no !== undefined ? id_proof_no : rows[0].id_number,
      id
    ];
    if (clientId) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);
    res.json({ message: 'Guest updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 📅 HOTEL BOOKINGS & RESERVATIONS
// ─────────────────────────────────────────────────────────────────────────

// Get all bookings
router.get('/bookings', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    let query = `
      SELECT hb.booking_id, hb.client_id, hb.room_id, hb.guest_id, 
             hb.check_in AS check_in_date, hb.check_out AS check_out_date, 
             hb.nights, hb.total_amount, hb.advance_paid, hb.status, hb.receptionist_id, hb.notes, hb.created_date,
             hr.room_no, hr.type AS room_type, 
             CONCAT(hg.first_name, ' ', hg.last_name) AS guest_name, hg.phone AS guest_phone
      FROM hotel_bookings hb
      JOIN hotel_rooms hr ON hb.room_id = hr.room_id
      JOIN hotel_guests hg ON hb.guest_id = hg.guest_id
      WHERE 
    `;
    let params = [];
    if (clientId) {
      query += 'hb.client_id = ?';
      params.push(clientId);
    } else {
      query += 'hb.client_id IS NULL';
    }
    query += ' ORDER BY hb.booking_id DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Booking / Check-in
router.post('/bookings', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { room_id, guest_id, check_in_date, check_out_date, status, total_amount, notes } = req.body;
    if (!room_id || !guest_id) return res.status(400).json({ error: 'Room and Guest IDs are required' });

    // Insert booking record
    const [result] = await db.execute(
      `INSERT INTO hotel_bookings 
       (client_id, room_id, guest_id, check_in, check_out, status, total_amount, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        room_id,
        guest_id,
        check_in_date || new Date(),
        check_out_date || null,
        status || 'checked-in',
        total_amount || 0,
        notes || ''
      ]
    );

    // Update Room status to occupied
    await db.execute('UPDATE hotel_rooms SET status = ? WHERE room_id = ?', ['occupied', room_id]);

    eventBus.emit('broadcast', { type: 'NEW_HOTEL_BOOKING', client_id: clientId, booking_id: result.insertId });

    res.status(201).json({ booking_id: result.insertId, message: 'Room booked successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Booking Status / Check-out checkout
router.put('/bookings/:id/status', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { status, total_amount } = req.body; // checked-out, cancelled

    let query = 'SELECT * FROM hotel_bookings WHERE booking_id = ? AND ';
    let params = [id];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [booking] = await db.execute(query, params);
    if (booking.length === 0) return res.status(404).json({ error: 'Booking not found' });

    let updateQuery = 'UPDATE hotel_bookings SET status = ?, total_amount = ? WHERE booking_id = ? AND ';
    let updateParams = [status, total_amount !== undefined ? total_amount : booking[0].total_amount, id];
    if (clientId) {
      updateQuery += 'client_id = ?';
      updateParams.push(clientId);
    } else {
      updateQuery += 'client_id IS NULL';
    }

    await db.execute(updateQuery, updateParams);

    // Release the room back to available status
    if (status === 'checked-out' || status === 'cancelled') {
      await db.execute('UPDATE hotel_rooms SET status = ? WHERE room_id = ?', ['available', booking[0].room_id]);
    }

    eventBus.emit('broadcast', { type: 'HOTEL_STATUS_CHANGED', client_id: clientId, booking_id: id, status });

    res.json({ message: 'Booking status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 🛎️ ROOM SERVICES BILLING
// ─────────────────────────────────────────────────────────────────────────

// Get services for a booking
router.get('/bookings/:id/services', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT hrs.* 
       FROM room_services hrs
       JOIN hotel_bookings hb ON hrs.booking_id = hb.booking_id
       WHERE hrs.booking_id = ? AND ${clientId ? 'hb.client_id = ?' : 'hb.client_id IS NULL'}`,
      clientId ? [id, clientId] : [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Order Room Service
router.post('/bookings/:id/services', async (req, res) => {
  try {
    const clientId = getClientId(req);
    const isSuperAdmin = checkSuperAdmin(req);
    if (!clientId && !isSuperAdmin) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { item_name, quantity, price } = req.body;
    if (!item_name || !quantity || !price) return res.status(400).json({ error: 'Item details are required' });

    let query = 'SELECT * FROM hotel_bookings WHERE booking_id = ? AND ';
    let params = [id];
    if (clientId) {
      query += 'client_id = ?';
      params.push(clientId);
    } else {
      query += 'client_id IS NULL';
    }

    const [booking] = await db.execute(query, params);
    if (booking.length === 0) return res.status(404).json({ error: 'Booking context not found' });

    const [result] = await db.execute(
      'INSERT INTO room_services (booking_id, client_id, item_name, quantity, price, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, clientId, item_name, quantity, price, 'ordered']
    );

    res.status(201).json({ service_id: result.insertId, message: 'Room service ordered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
