const mysql = require('mysql2/promise');
const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  console.log('=== Starting MySQL to PostgreSQL Database Migration ===');
  
  // 1. Establish MySQL Connection
  console.log('Connecting to MySQL...');
  const mysqlConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'POSSystem'
  });
  console.log('MySQL Connected!');

  // 2. Connect to PostgreSQL Default DB 'postgres' to verify / create DB
  console.log('Connecting to default PostgreSQL database to verify target database...');
  const pgAdminClient = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    database: 'postgres'
  });
  await pgAdminClient.connect();
  
  const dbName = process.env.PG_NAME || 'POSSystem';
  const checkDbRes = await pgAdminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  
  if (checkDbRes.rowCount === 0) {
    console.log(`Target database "${dbName}" does not exist. Creating...`);
    // CREATE DATABASE cannot run inside a transaction block in PostgreSQL
    await pgAdminClient.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created successfully!`);
  } else {
    console.log(`Target database "${dbName}" already exists.`);
  }
  await pgAdminClient.end();

  // 3. Connect to PostgreSQL Target DB
  console.log(`Connecting to target PostgreSQL database "${dbName}"...`);
  const pgClient = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    database: dbName
  });
  await pgClient.connect();
  console.log('PostgreSQL Connected!');

  // 4. Create Tables in PostgreSQL
  console.log('Initializing schema tables in PostgreSQL...');
  await pgClient.query('BEGIN');
  try {
    // Drop existing tables in reverse constraint order
    await pgClient.query('DROP TABLE IF EXISTS purchase_details CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS purchase_master CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS sales_details CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS sales_master CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS items CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS categories CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS taxes CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS units CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS vendors CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS customers CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS users CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS role_permissions CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS modules CASCADE');
    await pgClient.query('DROP TABLE IF EXISTS roles CASCADE');

    console.log('Creating tables...');
    await pgClient.query(`
      CREATE TABLE roles (
        role_id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        active SMALLINT DEFAULT 1,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE modules (
        module_id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE
      )
    `);

    await pgClient.query(`
      CREATE TABLE role_permissions (
        role_id INT REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE,
        module_id INT REFERENCES modules(module_id) ON DELETE CASCADE ON UPDATE CASCADE,
        allowed SMALLINT DEFAULT 0,
        PRIMARY KEY (role_id, module_id)
      )
    `);

    await pgClient.query(`
      CREATE TABLE users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        middle_name VARCHAR(255),
        last_name VARCHAR(255) NOT NULL,
        address_1 VARCHAR(255) NOT NULL,
        address_2 VARCHAR(255),
        address_3 VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        country VARCHAR(100) NOT NULL,
        phone_1 VARCHAR(20) NOT NULL,
        phone_2 VARCHAR(20),
        email_1 VARCHAR(255) NOT NULL,
        email_2 VARCHAR(255),
        role_id INT REFERENCES roles(role_id) ON DELETE SET NULL ON UPDATE CASCADE,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE customers (
        customer_id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        address_1 VARCHAR(255) NOT NULL,
        address_2 VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        country VARCHAR(100) NOT NULL,
        phone_1 VARCHAR(20) NOT NULL,
        phone_2 VARCHAR(20),
        email VARCHAR(255) NOT NULL,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE vendors (
        vendor_id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        address_1 VARCHAR(255) NOT NULL,
        address_2 VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        country VARCHAR(100) NOT NULL,
        phone_1 VARCHAR(20) NOT NULL,
        phone_2 VARCHAR(20),
        email VARCHAR(255) NOT NULL,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE units (
        unit_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        active SMALLINT DEFAULT 1,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE taxes (
        tax_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        active SMALLINT DEFAULT 1,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE categories (
        category_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        active SMALLINT DEFAULT 1,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE items (
        item_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        short_name VARCHAR(255),
        long_name VARCHAR(255),
        description TEXT,
        code VARCHAR(100),
        image TEXT,
        sales_price DECIMAL(10, 2) NOT NULL,
        purchase_price DECIMAL(10, 2) NOT NULL,
        editable_price SMALLINT DEFAULT 0,
        visible SMALLINT DEFAULT 1,
        tax_id INT REFERENCES taxes(tax_id) ON DELETE SET NULL ON UPDATE CASCADE,
        category_id INT REFERENCES categories(category_id) ON DELETE SET NULL ON UPDATE CASCADE,
        unit_id INT REFERENCES units(unit_id) ON DELETE SET NULL ON UPDATE CASCADE,
        base_quantity DECIMAL(10, 2) DEFAULT 1.00,
        weight_measurement VARCHAR(50) DEFAULT 'none',
        active SMALLINT DEFAULT 1,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE sales_master (
        sales_id SERIAL PRIMARY KEY,
        customer_id INT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE,
        sales_date DATE NOT NULL,
        sales_bill_no VARCHAR(100) NOT NULL,
        gross DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE sales_details (
        sales_detail_id SERIAL PRIMARY KEY,
        sales_id INT NOT NULL REFERENCES sales_master(sales_id) ON DELETE CASCADE ON UPDATE CASCADE,
        item_id INT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE ON UPDATE CASCADE,
        rate DECIMAL(10, 2) NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        item_amount DECIMAL(10, 2) NOT NULL
      )
    `);

    await pgClient.query(`
      CREATE TABLE purchase_master (
        purchase_id SERIAL PRIMARY KEY,
        vendor_id INT NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE ON UPDATE CASCADE,
        purchase_date DATE NOT NULL,
        purchase_bill_no VARCHAR(100) NOT NULL,
        gross DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        created_by VARCHAR(255) DEFAULT 'System',
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pgClient.query(`
      CREATE TABLE purchase_details (
        purchase_detail_id SERIAL PRIMARY KEY,
        purchase_id INT NOT NULL REFERENCES purchase_master(purchase_id) ON DELETE CASCADE ON UPDATE CASCADE,
        item_id INT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE ON UPDATE CASCADE,
        rate DECIMAL(10, 2) NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        item_amount DECIMAL(10, 2) NOT NULL
      )
    `);

    await pgClient.query('COMMIT');
    console.log('Tables created successfully in PostgreSQL!');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('Error creating PostgreSQL tables:', err);
    throw err;
  }

  // 5. Transfer data table by table
  const tables = [
    { name: 'roles', pk: 'role_id' },
    { name: 'modules', pk: 'module_id' },
    { name: 'role_permissions', pk: null },
    { name: 'users', pk: 'user_id' },
    { name: 'customers', pk: 'customer_id' },
    { name: 'vendors', pk: 'vendor_id' },
    { name: 'units', pk: 'unit_id' },
    { name: 'taxes', pk: 'tax_id' },
    { name: 'categories', pk: 'category_id' },
    { name: 'items', pk: 'item_id' },
    { name: 'sales_master', pk: 'sales_id' },
    { name: 'sales_details', pk: 'sales_detail_id' },
    { name: 'purchase_master', pk: 'purchase_id' },
    { name: 'purchase_details', pk: 'purchase_detail_id' }
  ];

  for (const table of tables) {
    console.log(`Migrating table "${table.name}"...`);
    const [rows] = await mysqlConn.query(`SELECT * FROM \`${table.name}\``);
    
    if (rows.length === 0) {
      console.log(`Table "${table.name}" is empty.`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const colNames = columns.join(', ');
    
    // Transfer row data safely
    for (const row of rows) {
      const values = columns.map(col => {
        let val = row[col];
        if (val instanceof Date) {
          return val.toISOString();
        }
        if (typeof val === 'boolean') {
          return val ? 1 : 0;
        }
        return val;
      });

      const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO ${table.name} (${colNames}) VALUES (${valuePlaceholders})`;
      await pgClient.query(query, values);
    }
    console.log(`Successfully migrated ${rows.length} rows for table "${table.name}".`);

    // Reset identity primary key sequences to allow new inserts without key collisions
    if (table.pk) {
      const seqQuery = `SELECT setval(pg_get_serial_sequence('${table.name}', '${table.pk}'), COALESCE((SELECT MAX(${table.pk}) FROM ${table.name}), 0) + 1, false)`;
      await pgClient.query(seqQuery);
      console.log(`Sequence generator reset completed for table "${table.name}".`);
    }
  }

  // 6. Close Connections
  await mysqlConn.end();
  await pgClient.end();
  console.log('=== Database Migration Completed Successfully! ===');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
