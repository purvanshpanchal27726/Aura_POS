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
 * Helper to export database tables to JSON object and save local/cloud snapshot
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
      backupData.tables[tableName] = [];
    }
  }

  // Save automatic snapshot to local backups folder
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const localSnapshotPath = path.join(backupDir, 'latest_auto_backup.json');
    fs.writeFileSync(localSnapshotPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log('[Auto Backup Engine] ✅ Saved latest auto backup snapshot to:', localSnapshotPath);
  } catch (fsErr) {
    console.warn('[Auto Backup Engine] Failed saving local snapshot:', fsErr.message);
  }

  return backupData;
}

/**
 * Helper to restore database from backup JSON data
 */
async function restoreDatabaseFromJson(tablesData) {
  if (!tablesData || typeof tablesData !== 'object') {
    throw new Error('Invalid database backup data structure.');
  }

  const connection = await db.getConnection();
  let restoredTablesCount = 0;
  let restoredRecordsCount = 0;

  try {
    await connection.beginTransaction();

    for (const tableName of BACKUP_TABLES) {
      const rows = tablesData[tableName];
      if (!Array.isArray(rows) || rows.length === 0) continue;

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
    console.log(`[Auto Restore Engine] 🎉 Successfully restored ${restoredRecordsCount} records across ${restoredTablesCount} tables!`);
    return { restoredTablesCount, restoredRecordsCount };
  } catch (err) {
    await connection.rollback();
    connection.release();
    throw err;
  }
}

// Start daily automatic backup interval (every 12 hours)
setInterval(() => {
  console.log('[Auto Backup Engine] Triggering scheduled database backup...');
  exportDatabaseJson().catch(e => console.warn('[Auto Backup Engine Error]', e.message));
}, 12 * 60 * 60 * 1000);

/**
 * GET /api/backup/export
 */
router.get('/export', async (req, res) => {
  try {
    const backupData = await exportDatabaseJson();
    const filename = `pos_pg_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate database backup.' });
  }
});

/**
 * POST /api/backup/restore
 */
router.post('/restore', async (req, res) => {
  try {
    const payload = req.body || {};
    const tablesData = payload.tables || payload;
    const result = await restoreDatabaseFromJson(tablesData);
    return res.status(200).json({
      success: true,
      message: `Successfully restored database! Imported ${result.restoredRecordsCount} records across ${result.restoredTablesCount} tables.`,
      restored_tables: result.restoredTablesCount,
      restored_records: result.restoredRecordsCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Database restore failed: ' + err.message });
  }
});

module.exports = router;
module.exports.exportDatabaseJson = exportDatabaseJson;
module.exports.restoreDatabaseFromJson = restoreDatabaseFromJson;
