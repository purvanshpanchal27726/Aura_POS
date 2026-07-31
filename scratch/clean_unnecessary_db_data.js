const path = require('path');
const backendDir = path.join(__dirname, '../new_user_backend');
const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const db = require(path.join(backendDir, 'db'));

async function cleanupDbData() {
  console.log('🧹 Cleaning up unnecessary/duplicate test data across all database tables...');

  try {
    // 1. Delete test/duplicate items with blank names
    const [delItems] = await db.execute(`
      DELETE FROM items 
      WHERE name IS NULL OR TRIM(name) = '' OR name LIKE 'Test%' OR name LIKE 'Neg %' OR name LIKE 'NaN %'
    `);
    console.log(`  └─ Cleaned items table (${delItems.rowCount || 0} duplicate/test entries removed)`);

    // 2. Delete test categories
    const [delCats] = await db.execute(`
      DELETE FROM categories 
      WHERE name IS NULL OR TRIM(name) = '' OR name LIKE 'Test%' OR name LIKE 'Bad%'
    `);
    console.log(`  └─ Cleaned categories table (${delCats.rowCount || 0} entries removed)`);

    // 3. Delete test taxes with invalid percentage (> 100 or < 0)
    const [delTaxes] = await db.execute(`
      DELETE FROM taxes 
      WHERE name IS NULL OR TRIM(name) = '' OR name LIKE 'Bad %' OR name LIKE 'Super %' OR name LIKE 'Str %' OR percentage > 100 OR percentage < 0
    `);
    console.log(`  └─ Cleaned taxes table (${delTaxes.rowCount || 0} invalid entries removed)`);

    // 4. Delete test units
    const [delUnits] = await db.execute(`
      DELETE FROM units 
      WHERE name IS NULL OR TRIM(name) = '' OR name LIKE 'Test%'
    `);
    console.log(`  └─ Cleaned units table (${delUnits.rowCount || 0} entries removed)`);

    // 5. Delete test customers
    const [delCust] = await db.execute(`
      DELETE FROM customers 
      WHERE first_name IS NULL OR TRIM(first_name) = '' OR first_name LIKE 'Test%'
    `);
    console.log(`  └─ Cleaned customers table (${delCust.rowCount || 0} entries removed)`);

    // 6. Delete test vendors
    const [delVend] = await db.execute(`
      DELETE FROM vendors 
      WHERE (first_name IS NULL OR TRIM(first_name) = '') AND (company IS NULL OR TRIM(company) = '')
    `);
    console.log(`  └─ Cleaned vendors table (${delVend.rowCount || 0} entries removed)`);

    // 7. Delete test hotel rooms
    const [delRooms] = await db.execute(`
      DELETE FROM hotel_rooms 
      WHERE room_no = '999' OR room_no IS NULL OR TRIM(room_no) = ''
    `);
    console.log(`  └─ Cleaned hotel_rooms table (${delRooms.rowCount || 0} entries removed)`);

    console.log('✅ Database cleanup completed successfully!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during DB cleanup:', err);
    process.exit(1);
  }
}

cleanupDbData();
