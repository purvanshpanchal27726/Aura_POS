const express = require('express');
const router = express.Router();
const db = require('./db');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Generate complete database backup snapshot
 */
async function generateDatabaseBackup() {
  const tables = [
    'clients', 'users', 'roles', 'categories', 'units', 'taxes',
    'items', 'customers', 'vendors', 'sales_master', 'sales_details',
    'purchase_master', 'purchase_details', 'license_info'
  ];

  const backupData = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    tables: {}
  };

  for (const table of tables) {
    try {
      const [rows] = await db.execute(`SELECT * FROM ${table}`);
      backupData.tables[table] = rows;
    } catch (err) {
      console.warn(`[Backup] Warning reading table ${table}:`, err.message);
      backupData.tables[table] = [];
    }
  }

  // Save JSON backup snapshot to backups/ directory
  const filename = `pos_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf8');

  // Keep latest 10 backups, prune older ones
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('pos_backup_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length > 10) {
    for (let i = 10; i < files.length; i++) {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
      } catch (e) {}
    }
  }

  return { filename, filePath, backupData };
}

/**
 * GET /api/system/backup
 * Triggers manual database backup download
 */
router.get('/', async (req, res) => {
  try {
    const { filename, backupData } = await generateDatabaseBackup();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).json(backupData);
  } catch (err) {
    console.error('[Backup Error]:', err);
    return res.status(500).json({ error: 'Failed to generate database backup: ' + err.message });
  }
});

/**
 * GET /api/system/backup/latest
 * Get list of available local backups
 */
router.get('/latest', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, size: stat.size, created_at: stat.mtime };
      })
      .sort((a, b) => b.created_at - a.created_at);

    return res.status(200).json(files);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = {
  router,
  generateDatabaseBackup
};
