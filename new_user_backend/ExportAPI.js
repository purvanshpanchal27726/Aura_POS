const express = require('express');
const db = require('./db');

const router = express.Router();

function getClientId(req) {
  let cid = req.headers['x-client-id'] || req.query.client_id;
  if (cid === 'ALL' || cid === 'all' || cid === '0') return 'ALL';
  if (!cid) {
    if (req.user && req.user.client_id !== undefined && req.user.client_id !== null) {
      cid = req.user.client_id;
    }
  }
  if (cid === 'ALL' || cid === 'all' || cid === '0') return 'ALL';
  if (!cid) return 1;
  const parsed = parseInt(cid);
  return isNaN(parsed) ? 1 : parsed;
}

/**
 * GET /api/export/inventory
 * Exports current stock inventory to CSV format.
 */
router.get('/inventory', async (req, res) => {
  try {
    const clientId = getClientId(req);
    let query = 'SELECT item_id, name, item_code, sales_price, purchase_price, stock_quantity, min_stock FROM items';
    let params = [];
    if (clientId !== 'ALL') {
      query += ' WHERE client_id = $1';
      params.push(clientId);
    }
    query += ' ORDER BY item_id ASC';

    const [items] = await db.execute(query, params);

    let csv = 'Item ID,Item Name,Item Code,Sales Price (INR),Purchase Price (INR),Current Stock,Min Alert Level\n';
    for (const item of items) {
      const name = `"${(item.name || '').replace(/"/g, '""')}"`;
      csv += `${item.item_id},${name},${item.item_code || ''},${item.sales_price || 0},${item.purchase_price || 0},${item.stock_quantity || 0},${item.min_stock || 5}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_stock_report.csv"');
    return res.status(200).send(csv);
  } catch (e) {
    console.error('Error exporting inventory CSV:', e);
    return res.status(500).json({ error: 'Failed to generate inventory CSV export' });
  }
});

/**
 * GET /api/export/sales
 * Exports sales register invoices to CSV format.
 */
router.get('/sales', async (req, res) => {
  try {
    const clientId = getClientId(req);
    let query = 'SELECT sales_id, sales_bill_no, sales_date, total, payment_method, customer_id FROM sales_master';
    let params = [];
    if (clientId !== 'ALL') {
      query += ' WHERE client_id = $1';
      params.push(clientId);
    }
    query += ' ORDER BY sales_id DESC';

    const [sales] = await db.execute(query, params);

    let csv = 'Sales ID,Invoice Number,Date,Payment Mode,Total Amount (INR)\n';
    for (const s of sales) {
      const dateStr = s.sales_date ? new Date(s.sales_date).toISOString().split('T')[0] : '';
      csv += `${s.sales_id},${s.sales_bill_no || ''},${dateStr},${s.payment_method || 'Cash'},${s.total || 0}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_register_report.csv"');
    return res.status(200).send(csv);
  } catch (e) {
    console.error('Error exporting sales CSV:', e);
    return res.status(500).json({ error: 'Failed to generate sales CSV export' });
  }
});

/**
 * GET /api/export/gst
 * Exports GSTR-1 & GSTR-3B Tax Filing Report to CSV format.
 */
router.get('/gst', async (req, res) => {
  try {
    const clientId = getClientId(req);
    let query = 'SELECT sales_id, sales_bill_no, sales_date, gross, tax, total FROM sales_master';
    let params = [];
    if (clientId !== 'ALL') {
      query += ' WHERE client_id = $1';
      params.push(clientId);
    }

    const [sales] = await db.execute(query, params);

    let csv = 'Invoice No,Sales Date,Taxable Value (INR),CGST (9%),SGST (9%),IGST (18%),Total Tax (INR),Invoice Total (INR)\n';
    for (const s of sales) {
      const taxable = s.gross || (s.total * 0.8475) || 0;
      const totalTax = s.tax || (s.total - taxable) || 0;
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;
      const dateStr = s.sales_date ? new Date(s.sales_date).toISOString().split('T')[0] : '';

      csv += `${s.sales_bill_no || ''},${dateStr},${taxable.toFixed(2)},${cgst.toFixed(2)},${sgst.toFixed(2)},0.00,${totalTax.toFixed(2)},${(s.total || 0).toFixed(2)}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="gstr1_tax_report.csv"');
    return res.status(200).send(csv);
  } catch (e) {
    console.error('Error exporting GST CSV:', e);
    return res.status(500).json({ error: 'Failed to generate GST CSV export' });
  }
});

module.exports = router;
