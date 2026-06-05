const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

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
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false
  };
} else {
  // Local development — use individual PG_* environment variables
  poolConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    database: process.env.PG_NAME || 'POSSystem',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: false
  };
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
  purchase_details: 'purchase_detail_id'
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
    if (!cleanSql.toUpperCase().includes('RETURNING')) {
      cleanSql += ' RETURNING *';
    }
  }

  // Replace placeholders (? -> $1, $2...)
  const translatedSql = replacePlaceholders(cleanSql);
  
  // Execute translated query
  const res = await clientOrPool.query(translatedSql, values);
  
  // If it was insert, wrap results to match mysql2 response
  if (isInsert) {
    let insertId = null;
    if (res.rows && res.rows.length > 0 && pkField) {
      insertId = res.rows[0][pkField];
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
    const client = await pgPool.connect();
    return new PgConnectionWrapper(client);
  }
};

module.exports = db;
