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

// ─────────────────────────────────────────────────────────────────────────
// 🛏️ HOTEL ROOMS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

// Get all rooms
router.get('/rooms', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const [rows] = await db.execute(
      'SELECT * FROM hotel_rooms WHERE client_id = ? AND active = 1 ORDER BY room_no',
      [clientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create room
router.post('/rooms', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { room_no, room_type, price_per_night } = req.body;
    if (!room_no || !room_type || price_per_night === undefined) {
      return res.status(400).json({ error: 'Room number, type, and price per night are required' });
    }

    const [result] = await db.execute(
      'INSERT INTO hotel_rooms (client_id, room_no, room_type, price_per_night, status) VALUES (?, ?, ?, ?, ?)',
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
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { room_no, room_type, price_per_night, status } = req.body;

    const [rows] = await db.execute('SELECT * FROM hotel_rooms WHERE room_id = ? AND client_id = ?', [id, clientId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });

    await db.execute(
      `UPDATE hotel_rooms 
       SET room_no = ?, room_type = ?, price_per_night = ?, status = ? 
       WHERE room_id = ? AND client_id = ?`,
      [
        room_no !== undefined ? room_no : rows[0].room_no,
        room_type !== undefined ? room_type : rows[0].room_type,
        price_per_night !== undefined ? price_per_night : rows[0].price_per_night,
        status !== undefined ? status : rows[0].status,
        id,
        clientId
      ]
    );

    res.json({ message: 'Room updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete room (soft delete)
router.delete('/rooms/:id', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    await db.execute('UPDATE hotel_rooms SET active = 0 WHERE room_id = ? AND client_id = ?', [id, clientId]);
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
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const [rows] = await db.execute('SELECT * FROM hotel_guests WHERE client_id = ? ORDER BY name', [clientId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create guest
router.post('/guests', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { name, phone, email, id_proof_type, id_proof_no } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    const [result] = await db.execute(
      `INSERT INTO hotel_guests (client_id, name, phone, email, id_proof_type, id_proof_no) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clientId, name, phone, email || null, id_proof_type || 'Aadhaar', id_proof_no || '']
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
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { name, phone, email, id_proof_type, id_proof_no } = req.body;

    const [rows] = await db.execute('SELECT * FROM hotel_guests WHERE guest_id = ? AND client_id = ?', [id, clientId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Guest not found' });

    await db.execute(
      `UPDATE hotel_guests 
       SET name = ?, phone = ?, email = ?, id_proof_type = ?, id_proof_no = ? 
       WHERE guest_id = ? AND client_id = ?`,
      [
        name !== undefined ? name : rows[0].name,
        phone !== undefined ? phone : rows[0].phone,
        email !== undefined ? email : rows[0].email,
        id_proof_type !== undefined ? id_proof_type : rows[0].id_proof_type,
        id_proof_no !== undefined ? id_proof_no : rows[0].id_proof_no,
        id,
        clientId
      ]
    );

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
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const [rows] = await db.execute(
      `SELECT hb.*, hr.room_no, hr.room_type, hg.name AS guest_name, hg.phone AS guest_phone
       FROM hotel_bookings hb
       JOIN hotel_rooms hr ON hb.room_id = hr.room_id
       JOIN hotel_guests hg ON hb.guest_id = hg.guest_id
       WHERE hb.client_id = ?
       ORDER BY hb.booking_id DESC`,
      [clientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Booking / Check-in
router.post('/bookings', async (req, res) => {
  try {
    const clientId = getClientId(req);
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { room_id, guest_id, check_in_date, check_out_date, status, total_amount, notes } = req.body;
    if (!room_id || !guest_id) return res.status(400).json({ error: 'Room and Guest IDs are required' });

    // Insert booking record
    const [result] = await db.execute(
      `INSERT INTO hotel_bookings 
       (client_id, room_id, guest_id, check_in_date, check_out_date, status, total_amount, notes) 
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
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { status, total_amount } = req.body; // checked-out, cancelled

    const [booking] = await db.execute('SELECT * FROM hotel_bookings WHERE booking_id = ? AND client_id = ?', [id, clientId]);
    if (booking.length === 0) return res.status(404).json({ error: 'Booking not found' });

    await db.execute(
      'UPDATE hotel_bookings SET status = ?, total_amount = ? WHERE booking_id = ? AND client_id = ?',
      [status, total_amount !== undefined ? total_amount : booking[0].total_amount, id, clientId]
    );

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
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT hrs.* 
       FROM hotel_room_services hrs
       JOIN hotel_bookings hb ON hrs.booking_id = hb.booking_id
       WHERE hrs.booking_id = ? AND hb.client_id = ?`,
      [id, clientId]
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
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    const { id } = req.params;
    const { item_name, quantity, price } = req.body;
    if (!item_name || !quantity || !price) return res.status(400).json({ error: 'Item details are required' });

    const [booking] = await db.execute('SELECT * FROM hotel_bookings WHERE booking_id = ? AND client_id = ?', [id, clientId]);
    if (booking.length === 0) return res.status(404).json({ error: 'Booking context not found' });

    const [result] = await db.execute(
      'INSERT INTO hotel_room_services (booking_id, item_name, quantity, price, status) VALUES (?, ?, ?, ?, ?)',
      [id, item_name, quantity, price, 'ordered']
    );

    res.status(201).json({ service_id: result.insertId, message: 'Room service ordered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
