const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');
const path = require('path');

// Load Render-specific environment variables if running on Render
if (process.env.RENDER === 'true') {
  const renderEnvPath = path.join(__dirname, '.env.render');
  if (fs.existsSync(renderEnvPath)) {
    require('dotenv').config({ path: renderEnvPath });
  } else {
    require('dotenv').config();
  }
} else {
  require('dotenv').config();
}

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL Connection Pool
// Priority: DATABASE_URL (Render external URL with SSL) > individual PG_* vars
// ─────────────────────────────────────────────────────────────────────────────
let poolConfig;

if (process.env.DATABASE_URL) {
  // Render provides DATABASE_URL — use it with SSL required
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Required for Render PostgreSQL
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    allowExitOnIdle: false
  };
} else {
  // Local development / Remote fallback — use individual PG_* environment variables
  const pgHost = process.env.PG_HOST || 'dpg-d9pbc8e417fc73dhnfsg-a.singapore-postgres.render.com';
  poolConfig = {
    host: pgHost,
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'poss_1_user',
    password: process.env.PG_PASSWORD || 'XfXpHnm5R6DxTmgac8qtHn13s9aHA1yg',
    database: process.env.PG_NAME || 'poss_1',
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    allowExitOnIdle: false
  };

  // Enable SSL if connecting to a remote host (like Render PostgreSQL)
  if (pgHost !== 'localhost' && pgHost !== '127.0.0.1') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
}

const pgPool = new Pool(poolConfig);
console.log(`[DB] Connecting via ${process.env.DATABASE_URL ? 'DATABASE_URL (Render)' : 'PG_* env vars (local)'}`);

// ⚠️ CRITICAL: Handle unexpected connection drops gracefully.
// Without this handler, any dropped PG connection crashes the Node process.
// Error code 57P01 = "terminating connection due to administrator command"
pgPool.on('error', (err, client) => {
  console.error('[DB Pool] Unexpected client error — connection was dropped by PostgreSQL.');
  console.error(`[DB Pool] Code: ${err.code} | Message: ${err.message}`);
  // The pool will automatically remove this broken client and create a new one.
  // No crash, no manual restart needed.
});

// Using AsyncLocalStorage to trace global transactions
const transactionStorage = new AsyncLocalStorage();

const tablePrimaryKeyMap = {
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
  license_payments: 'payment_id'
};

// Robust state-machine parser for query parameter replacement (? -> $1, $2...)
function replacePlaceholders(sql) {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let result = '';
  let placeholderCount = 0;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    
    // Handle escape characters inside strings
    if (char === '\\' && i + 1 < sql.length) {
      result += char + sql[i + 1];
      i++;
      continue;
    }
    
    if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
    }
    
    if (char === '?' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      placeholderCount++;
      result += '$' + placeholderCount;
    } else {
      result += char;
    }
  }
  return result;
}

// Global query executor with query mapping and translations
async function dbQuery(clientOrPool, sql, values = []) {
  let cleanSql = sql;
  
  // Clean backticks
  cleanSql = cleanSql.replace(/`/g, '"');
  
  // Standardize uppercase for prefix checks
  const upperSql = cleanSql.trim().toUpperCase();

  // 1. Handle MySQL ON DUPLICATE KEY UPDATE
  if (upperSql.includes('ON DUPLICATE KEY UPDATE')) {
    cleanSql = cleanSql.replace(/ON DUPLICATE KEY UPDATE\s+allowed\s*=\s*VALUES\s*\(\s*allowed\s*\)/i, 
      'ON CONFLICT (role_id, module_id) DO UPDATE SET allowed = EXCLUDED.allowed');
  }

  // 2. Intercept ALTER TABLE ... AUTO_INCREMENT = 1 and map to PG serial reset
  const autoIncrementMatch = cleanSql.match(/ALTER\s+TABLE\s+([a-zA-Z0-9_"]+)\s+AUTO_INCREMENT\s*=\s*\d+/i);
  if (autoIncrementMatch) {
    const tableName = autoIncrementMatch[1].replace(/["']/g, '').trim().toLowerCase();
    const pkField = tablePrimaryKeyMap[tableName];
    if (pkField) {
      cleanSql = `SELECT setval(pg_get_serial_sequence('${tableName}', '${pkField}'), COALESCE((SELECT MAX(${pkField}) FROM ${tableName}), 0) + 1, false)`;
    }
  }

  // 3. Handle INSERT commands (append RETURNING * to fetch insertId)
  const isInsert = cleanSql.trim().toUpperCase().startsWith('INSERT');
  let pkField = null;
  if (isInsert) {
    const insertTableMatch = cleanSql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_"]+)/i);
    if (insertTableMatch) {
      const tableName = insertTableMatch[1].replace(/["']/g, '').trim().toLowerCase();
      pkField = tablePrimaryKeyMap[tableName];
    }
    cleanSql = cleanSql.trim().replace(/;+$/, '');
    if (!cleanSql.toUpperCase().includes('RETURNING')) {
      cleanSql += ' RETURNING *';
    }
  }

  // Replace placeholders (? -> $1, $2...)
  const translatedSql = replacePlaceholders(cleanSql);
  
  // Execute translated query with auto-retry on dropped connection
  let res;
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      res = await clientOrPool.query(translatedSql, values);
      break;
    } catch (err) {
      attempts++;
      const isConnErr = err.code === '57P01' || 
                        err.code === 'ECONNRESET' || 
                        err.code === 'ETIMEDOUT' ||
                        (err.message && (
                          err.message.includes('terminated unexpectedly') ||
                          err.message.includes('Connection terminated') ||
                          err.message.includes('closed') ||
                          err.message.includes('Connection reset')
                        ));
      if (isConnErr && attempts < maxAttempts) {
        console.warn(`[DB Query Retry] Connection dropped by PostgreSQL. Retrying query (attempt ${attempts}/${maxAttempts})...`);
        await new Promise(r => setTimeout(r, 300 * attempts));
        continue;
      }
      throw err;
    }
  }
  
  // If it was insert, wrap results to match mysql2 response
  if (isInsert) {
    let insertId = null;
    if (res.rows && res.rows.length > 0) {
      if (pkField && res.rows[0][pkField] !== undefined) {
        insertId = res.rows[0][pkField];
      } else {
        const firstRow = res.rows[0];
        const keys = Object.keys(firstRow);
        const idKey = keys.find(k => k.endsWith('_id') || k === 'id');
        if (idKey && firstRow[idKey] !== undefined) {
          insertId = firstRow[idKey];
        } else if (keys.length > 0) {
          insertId = firstRow[keys[0]];
        }
      }
    }
    const mockResult = {
      insertId: insertId,
      affectedRows: res.rowCount,
      warningStatus: 0
    };
    return [mockResult, null];
  }

  return [res.rows, null];
}

// Connection Wrapper for db.getConnection()
class PgConnectionWrapper {
  constructor(client) {
    this.client = client;
  }
  
  async beginTransaction() {
    await this.client.query('BEGIN');
  }
  
  async query(sql, values = []) {
    return dbQuery(this.client, sql, values);
  }
  
  async execute(sql, values = []) {
    return dbQuery(this.client, sql, values);
  }
  
  async commit() {
    await this.client.query('COMMIT');
  }
  
  async rollback() {
    await this.client.query('ROLLBACK');
  }
  
  release() {
    this.client.release();
  }
}

// Promisified DB Client Wrapper
const db = {
  async query(sql, values = []) {
    const store = transactionStorage.getStore();
    const upperSql = sql.trim().toUpperCase();

    // Intercept transaction commands at pool level
    if (upperSql === 'START TRANSACTION' || upperSql === 'BEGIN') {
      if (store && store.client) {
        await store.client.query('BEGIN');
        return [{}, null];
      }
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        transactionStorage.enterWith({ client });
        return [{}, null];
      } catch (err) {
        client.release();
        throw err;
      }
    }

    if (upperSql === 'COMMIT') {
      if (store && store.client) {
        try {
          await store.client.query('COMMIT');
          return [{}, null];
        } finally {
          store.client.release();
          store.client = null;
        }
      }
      return [{}, null];
    }

    if (upperSql === 'ROLLBACK') {
      if (store && store.client) {
        try {
          await store.client.query('ROLLBACK');
          return [{}, null];
        } finally {
          store.client.release();
          store.client = null;
        }
      }
      return [{}, null];
    }

    // Execute query using context-managed client if in transaction, otherwise use pool
    const executor = (store && store.client) ? store.client : pgPool;
    return dbQuery(executor, sql, values);
  },

  async execute(sql, values = []) {
    return this.query(sql, values);
  },

  async getConnection() {
    let client;
    let attempts = 0;
    while (attempts < 3) {
      try {
        client = await pgPool.connect();
        break;
      } catch (err) {
        attempts++;
        if (attempts < 3) {
          console.warn(`[DB Connect Retry] Retrying pool connection (attempt ${attempts}/3)...`);
          await new Promise(r => setTimeout(r, 300 * attempts));
          continue;
        }
        throw err;
      }
    }
    return new PgConnectionWrapper(client);
  }
};

// Auto-initialize database schema if empty
db.initDb = async function() {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // 1. Check if the 'users' table exists first
    const [result] = await this.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);
    
    const usersExist = result && result[0] && result[0].exists;

    if (!usersExist) {
      console.log('[DB] Database tables not found. Initializing PostgreSQL database...');
      
      const schemaPath = path.join(__dirname, 'schema_pg.sql');
      if (!fs.existsSync(schemaPath)) {
        console.error('[DB] schema_pg.sql not found! Cannot auto-initialize.');
        return;
      }
      
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      const cleanedSql = schemaSql.replace(/--.*$/gm, '');
      const statements = cleanedSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
        
      console.log(`[DB] Executing ${statements.length} schema statements...`);
      
      const client = await pgPool.connect();
      try {
        for (const statement of statements) {
          try {
            await client.query(statement);
          } catch (stmtErr) {
            console.warn('[DB Init Warning]', stmtErr.message);
          }
        }
        console.log('[DB] Database initialization completed successfully!');
        
        // Seed full initial POS dataset directly from backend code
        try {
          const bcrypt = require('bcryptjs');

          // 1. Client #1
          await client.query(`
            INSERT INTO clients (client_id, name, email, phone, address, gst_no, active)
            VALUES (1, 'Vanshee POS Enterprise', 'support@vanshee.com', '9876543210', 'Ahmedabad, Gujarat, India', '24AAACV1234F1Z5', 1)
            ON CONFLICT (client_id) DO NOTHING;
          `);
          await client.query(`SELECT setval(pg_get_serial_sequence('clients','client_id'), COALESCE((SELECT MAX(client_id) FROM clients), 1));`);

          // 2. Roles
          await client.query(`
            INSERT INTO roles (role_id, client_id, name, active, created_by) VALUES
            (1, 1, 'Super Admin', 1, 'System'),
            (2, 1, 'Admin', 1, 'System'),
            (3, 1, 'Staff', 1, 'System')
            ON CONFLICT (role_id) DO NOTHING;
          `);
          await client.query(`SELECT setval(pg_get_serial_sequence('roles','role_id'), COALESCE((SELECT MAX(role_id) FROM roles), 3));`);

          // 3. Super Admin & Admin Users
          const hashPassword = await bcrypt.hash('Parshav@123', 10);
          await client.query(`
            INSERT INTO users (user_id, username, password, first_name, last_name, address_1, city, country, phone_1, email_1, role_id, client_id, is_superadmin)
            VALUES (1, 'Parshav', $1, 'Parshav', 'Shah', 'Vanshee Infotech', 'Ahmedabad', 'India', '9876543210', 'parshav@vanshee.com', 1, 1, 1)
            ON CONFLICT (username) DO NOTHING;
          `, [hashPassword]);

          const adminHash = await bcrypt.hash('Admin@123', 10);
          await client.query(`
            INSERT INTO users (user_id, username, password, first_name, last_name, address_1, city, country, phone_1, email_1, role_id, client_id, is_superadmin)
            VALUES (2, 'admin', $1, 'System', 'Admin', 'Vanshee POS HQ', 'Ahmedabad', 'India', '9876543211', 'admin@vanshee.com', 2, 1, 0)
            ON CONFLICT (username) DO NOTHING;
          `, [adminHash]);
          await client.query(`SELECT setval(pg_get_serial_sequence('users','user_id'), COALESCE((SELECT MAX(user_id) FROM users), 2));`);

          // 4. Units
          await client.query(`
            INSERT INTO units (unit_id, client_id, name, short_code) VALUES
            (1, 1, 'Pieces', 'Pcs'),
            (2, 1, 'Kilograms', 'Kg'),
            (3, 1, 'Liters', 'Ltr'),
            (4, 1, 'Packet', 'Pkt'),
            (5, 1, 'Box', 'Box')
            ON CONFLICT (unit_id) DO NOTHING;
          `);
          await client.query(`SELECT setval(pg_get_serial_sequence('units','unit_id'), COALESCE((SELECT MAX(unit_id) FROM units), 5));`);

          // 5. Taxes
          await client.query(`
            INSERT INTO taxes (tax_id, client_id, tax_name, rate) VALUES
            (1, 1, 'GST 0%', 0.00),
            (2, 1, 'GST 5%', 5.00),
            (3, 1, 'GST 12%', 12.00),
            (4, 1, 'GST 18%', 18.00)
            ON CONFLICT (tax_id) DO NOTHING;
          `);
          await client.query(`SELECT setval(pg_get_serial_sequence('taxes','tax_id'), COALESCE((SELECT MAX(tax_id) FROM taxes), 4));`);

          // 6. Categories
          await client.query(`
            INSERT INTO categories (category_id, client_id, category_name, description) VALUES
            (1, 1, 'Dairy Products', 'Fresh milk, butter, cheese, paneer'),
            (2, 1, 'Beverages', 'Soft drinks, juices, mineral water'),
            (3, 1, 'Snacks & Wafers', 'Chips, biscuits, namkeen'),
            (4, 1, 'Grocery & Staples', 'Rice, flour, sugar, oil'),
            (5, 1, 'Bakery', 'Fresh bread, cakes, buns')
            ON CONFLICT (category_id) DO NOTHING;
          `);
          await client.query(`SELECT setval(pg_get_serial_sequence('categories','category_id'), COALESCE((SELECT MAX(category_id) FROM categories), 5));`);

          // 7. Items
          await client.query(`
            INSERT INTO items (item_id, client_id, item_code, barcode, item_name, category_id, unit_id, cost_price, sales_price, stock_quantity, min_stock, active, pos_item) VALUES
            (1, 1, 'ITM-001', '890123400001', 'Amul Taaza Milk 500ml', 1, 3, 31.00, 34.00, 100.00, 10.00, 1, 1),
            (2, 1, 'ITM-002', '890123400002', 'Amul Gold Milk 500ml', 1, 3, 32.50, 35.00, 80.00, 10.00, 1, 1),
            (3, 1, 'ITM-003', '890123400003', 'Amul Butter 100g', 1, 4, 50.00, 56.00, 50.00, 5.00, 1, 1),
            (4, 1, 'ITM-004', '890123400004', 'Coca Cola 750ml', 2, 1, 32.00, 40.00, 60.00, 10.00, 1, 1),
            (5, 1, 'ITM-005', '890123400005', 'Bisleri Mineral Water 1L', 2, 1, 12.00, 20.00, 150.00, 20.00, 1, 1),
            (6, 1, 'ITM-006', '890123400006', 'Lays Classic Salted 50g', 3, 4, 16.00, 20.00, 120.00, 15.00, 1, 1),
            (7, 1, 'ITM-007', '890123400007', 'Britannia Sandwich Bread 400g', 5, 4, 38.00, 45.00, 30.00, 5.00, 1, 1)
            ON CONFLICT (item_id) DO NOTHING;
          `);
          await client.query(`SELECT setval(pg_get_serial_sequence('items','item_id'), COALESCE((SELECT MAX(item_id) FROM items), 7));`);

          // 8. Customers
          await client.query(`
            INSERT INTO customers (customer_id, client_id, first_name, last_name, address_1, city, country, phone_1, email_1) VALUES
            (1, 1, 'Walk-in', 'Customer', 'Counter Sale', 'Ahmedabad', 'India', '9999999999', 'cash@store.com'),
            (2, 1, 'Rahul', 'Sharma', 'Satellite', 'Ahmedabad', 'India', '9876543210', 'rahul@gmail.com')
            ON CONFLICT (customer_id) DO NOTHING;
          `);
          await client.query(`SELECT setval(pg_get_serial_sequence('customers','customer_id'), COALESCE((SELECT MAX(customer_id) FROM customers), 2));`);

          // 9. Vendors
          await client.query(`
            INSERT INTO vendors (vendor_id, client_id, company_name, contact_person, phone_1, email_1, address_1, city, country) VALUES
            (1, 1, 'Vanshee Wholesale Distributors', 'Anand Shah', '9898989898', 'supply@vanshee.com', 'CG Road', 'Ahmedabad', 'India'),
            (2, 1, 'Amul Dairy Co-op', 'Rajesh Patel', '9797979797', 'orders@amul.com', 'Anand', 'Anand', 'India')
            ON CONFLICT (vendor_id) DO NOTHING;
          `);
          await client.query(`SELECT setval(pg_get_serial_sequence('vendors','vendor_id'), COALESCE((SELECT MAX(vendor_id) FROM vendors), 2));`);

          // 10. Printer Settings
          await client.query(`
            INSERT INTO printer_settings (client_id, printer_name, printer_type, paper_size, connection, copies)
            VALUES (1, 'POS Thermal Receipt Printer', 'thermal', 'medium', 'usb', 1)
            ON CONFLICT DO NOTHING;
          `);

          // 11. License
          await client.query(`
            INSERT INTO license_info (client_id, license_key, valid_from, valid_to, amc_start_date, amc_end_date, status)
            VALUES (1, 'VANSHEE-POS-LICENSE-KEY-2026', '2026-01-01', '2030-12-31', '2026-01-01', '2030-12-31', 'Active')
            ON CONFLICT DO NOTHING;
          `);

          console.log('[DB Seed] 🎉 Successfully seeded complete initial POS dataset into PostgreSQL database!');
        } catch (seedErr) {
          console.warn('[DB Seed Warning]', seedErr.message);
        }
      } finally {
        client.release();
      }
    } else {
      console.log('[DB] Database already initialized.');
    }

    // 2. Run incremental migrations safely
    try {
      await this.query(`ALTER TABLE sales_master ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Cash';`);
    } catch (err) {}

    try {
      await this.query(`
        ALTER TABLE items ADD COLUMN IF NOT EXISTS pos_item SMALLINT DEFAULT 0;
        ALTER TABLE items ADD COLUMN IF NOT EXISTS show_in_restaurant SMALLINT DEFAULT 0;
        ALTER TABLE items ADD COLUMN IF NOT EXISTS is_hotel_service SMALLINT DEFAULT 0;
      `);
    } catch (err) {}

    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS license_info (
          license_id SERIAL PRIMARY KEY,
          license_key VARCHAR(255) NOT NULL,
          valid_from DATE NOT NULL,
          valid_to DATE NOT NULL,
          amc_start_date DATE NOT NULL,
          amc_end_date DATE NOT NULL,
          status VARCHAR(50) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      const [licenseCount] = await this.query('SELECT COUNT(*) AS count FROM license_info');
      if (licenseCount && licenseCount[0] && parseInt(licenseCount[0].count) === 0) {
        await this.query(`
          INSERT INTO license_info (license_key, valid_from, valid_to, amc_start_date, amc_end_date, status)
          VALUES ('VANSHEE-POS-LICENSE-KEY-2026', '2026-01-01', '2026-08-31', '2026-01-01', '2026-08-31', 'Active');
        `);
      }
    } catch (err) {}

  } catch (err) {
    console.error('[DB] Database auto-initialization error:', err);
  }
};

module.exports = db;

