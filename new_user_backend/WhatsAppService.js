const db = require('./db');

/**
 * Simulates WhatsApp Cloud API billing delivery and records transactions in whatsapp_logs.
 */
async function sendWhatsAppInvoice(clientId, customerId, total, billNo) {
  try {
    // 1. Retrieve customer details
    const [custRows] = await db.query(
      'SELECT first_name, last_name, phone_1 FROM customers WHERE customer_id = ?',
      [customerId]
    );
    if (custRows.length === 0) {
      console.log(`[WhatsApp API] Customer with ID ${customerId} not found. Skipping.`);
      return;
    }
    
    const { first_name, last_name, phone_1 } = custRows[0];
    if (!phone_1) {
      console.log(`[WhatsApp API] Customer has no phone number recorded. Skipping.`);
      return;
    }

    // 2. Draft transactional invoice message template
    const msg = `Hello ${first_name} ${last_name},\nThank you for shopping with us! Your invoice #${billNo} for total value ₹${parseFloat(total).toFixed(2)} has been generated.`;

    // 3. Save logs to PostgreSQL (foreign-key safe with NULL bill_id)
    await db.query(`
      INSERT INTO whatsapp_logs (client_id, bill_id, phone, message, status)
      VALUES (?, NULL, ?, ?, 'sent')
    `, [clientId, phone_1, msg]);

    console.log(`[WhatsApp API] Message sent successfully to ${phone_1}: "${msg}"`);
  } catch (err) {
    console.error('[WhatsApp Error]', err.message);
  }
}

module.exports = { sendWhatsAppInvoice };
