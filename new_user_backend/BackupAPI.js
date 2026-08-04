const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const router = express.Router();

// Tables to backup/restore in topological order (parent dependencies first)
const BACKUP_TABLES = [
  'clients',
  'roles',
  'modules',
  'role_permissions',
  'users',
  'customers',
  'vendors',
  'units',
  'taxes',
  'categories',
  'items',
  'sales_master',
  'sales_details',
  'purchase_master',
  'purchase_details',
  'employees',
  'inventory',
  'inventory_movements',
  'purchase_orders',
  'purchase_order_items',
  'grn_master',
  'grn_details',
  'hotel_rooms',
  'hotel_guests',
  'hotel_bookings',
  'hotel_services',
  'restaurant_tables',
  'restaurant_menu_categories',
  'restaurant_menu_items',
  'restaurant_orders',
  'restaurant_order_items',
  'licenses',
  'license_info'
];

const PK_MAP = {
  clients: 'client_id',
  roles: 'role_id',
  modules: 'module_id',
  users: 'user_id',
  customers: 'customer_id',
  vendors: 'vendor_id',
  units: 'unit_id',
  taxes: 'tax_id',
  categories: 'category_id',
  items: 'item_id',
  sales_master: 'sales_id',
  sales_details: 'sales_detail_id',
  purchase_master: 'purchase_id',
  purchase_details: 'purchase_detail_id',
  employees: 'employee_id',
  inventory: 'inventory_id',
  inventory_movements: 'movement_id',
  purchase_orders: 'po_id',
  purchase_order_items: 'po_item_id',
  grn_master: 'grn_id',
  grn_details: 'grn_detail_id',
  hotel_rooms: 'room_id',
  hotel_guests: 'guest_id',
  hotel_bookings: 'booking_id',
  hotel_services: 'service_id',
  restaurant_tables: 'table_id',
  restaurant_menu_categories: 'category_id',
  restaurant_menu_items: 'item_id',
  restaurant_orders: 'order_id',
  restaurant_order_items: 'order_item_id',
  licenses: 'license_id',
  license_info: 'license_id'
};

/**
 * Helper to export database tables to JSON object
 */
async function exportDatabaseJson() {
  const backupData = {
    app: 'Vanshee POS System',
    version: '2.0',
    timestamp: new Date().toISOString(),
    tables: {}
  };

  for (const tableName of BACKUP_TABLES) {
    try {
      const [rows] = await db.query(`SELECT * FROM ${tableName}`);
      backupData.tables[tableName] = rows || [];
    } catch (err) {
      console.warn(`[Backup] Warning reading table ${tableName}:`, err.message);
      backupData.tables[tableName] = [];
    }
  }

  // Also save automatic local snapshot in backend directory
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const localSnapshotPath = path.join(backupDir, 'latest_auto_backup.json');
    fs.writeFileSync(localSnapshotPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log('[Backup] Saved latest auto backup snapshot to', localSnapshotPath);
  } catch (fsErr) {
    console.warn('[Backup] Failed to save local snapshot file:', fsErr.message);
  }

  return backupData;
}

/**
 * GET /api/backup/export
 * Download full database JSON backup file
 */
router.get('/export', async (req, res) => {
  try {
    const backupData = await exportDatabaseJson();
    const filename = `pos_pg_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    console.error('[Backup Export Error]', err);
    res.status(500).json({ error: 'Failed to generate database backup.' });
  }
});

/**
 * POST /api/backup/export
 * Express POST alternate for trigger download
 */
router.post('/export', async (req, res) => {
  try {
    const backupData = await exportDatabaseJson();
    return res.status(200).json(backupData);
  } catch (err) {
    console.error('[Backup Export Error]', err);
    res.status(500).json({ error: 'Failed to generate database backup.' });
  }
});

/**
 * POST /api/backup/restore
 * One-click Restore database to a new PostgreSQL instance
 */
router.post('/restore', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const payload = req.body || {};
    const tablesData = payload.tables || payload;

    if (!tablesData || typeof tablesData !== 'object') {
      await connection.rollback();
      return res.status(400).json({ error: 'Invalid database backup file format.' });
    }

    let restoredTablesCount = 0;
    let restoredRecordsCount = 0;

    for (const tableName of BACKUP_TABLES) {
      const rows = tablesData[tableName];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      // Clean existing table data safely
      try {
        await connection.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE;`);
      } catch (truncErr) {
        try {
          await connection.query(`DELETE FROM ${tableName};`);
        } catch (delErr) {}
      }

      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = columns.map(c => `"${c}"`).join(', ');
        const values = columns.map(c => row[c]);

        const insertSql = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
        await connection.query(insertSql, values);
        restoredRecordsCount++;
      }

      // Reset auto-increment sequence for PK
      const pkField = PK_MAP[tableName];
      if (pkField) {
        try {
          await connection.query(`
            SELECT setval(pg_get_serial_sequence('${tableName}', '${pkField}'), COALESCE((SELECT MAX(${pkField}) FROM ${tableName}), 0) + 1, false);
          `);
        } catch (seqErr) {}
      }

      restoredTablesCount++;
    }

    await connection.commit();
    connection.release();

    console.log(`[Backup Restore] Restored ${restoredRecordsCount} records across ${restoredTablesCount} tables.`);

    return res.status(200).json({
      success: true,
      message: `Successfully restored database! Imported ${restoredRecordsCount} records across ${restoredTablesCount} tables.`,
      restored_tables: restoredTablesCount,
      restored_records: restoredRecordsCount
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('[Backup Restore Error]', err);
    res.status(500).json({ error: 'Database restore failed: ' + err.message });
  }
});

module.exports = router;
