const path = require('path');
const backendDir = path.join(__dirname, '../new_user_backend');
const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const db = require(path.join(backendDir, 'db'));

async function seedCleanSlateData() {
  console.log('🧹 Purging old data and seeding EXACTLY 5 users and 1 perfect realistic record per module...\n');

  try {
    // 1. Truncate all tables with CASCADE & RESTART IDENTITY
    await db.execute(`
      TRUNCATE TABLE 
        sales_master, purchase_master, hotel_guests, hotel_rooms, 
        employees, items, categories, taxes, units, customers, vendors, 
        restaurant_tables, users
      RESTART IDENTITY CASCADE
    `);
    console.log('  └─ ✅ All database tables truncated with RESTART IDENTITY CASCADE');

    // 2. Insert EXACTLY 5 Users (Parshav, Dhruvi, Krinna, Kavy, abc)
    const [userRes] = await db.execute(`
      INSERT INTO users (username, password, first_name, last_name, email_1, address_1, city, country, phone_1, role_id, created_by)
      VALUES 
        ('Parshav', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', 'Parshav', 'Admin', 'parshav@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543210', 1, 'System'),
        ('Dhruvi', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', 'Dhruvi', 'Manager', 'dhruvi@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543211', 1, 'System'),
        ('Krinna', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', 'Krinna', 'Supervisor', 'krinna@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543212', 2, 'System'),
        ('Kavy', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', 'Kavy', 'Cashier', 'kavy@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543213', 3, 'System'),
        ('abc', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', 'abc', 'User', 'abc@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543214', 4, 'System')
      RETURNING user_id
    `);
    const parshavUserId = userRes[0] ? userRes[0].user_id : 1;
    console.log('  └─ ✅ User Master: 5 Clean Users (Parshav, Dhruvi, Krinna, Kavy, abc)');

    // 3. Seed 1 Perfect Category
    const [catRes] = await db.execute(`
      INSERT INTO categories (name, active, created_by)
      VALUES ('Dairy & Beverages', 1, 'Parshav')
      RETURNING category_id
    `);
    const categoryId = catRes[0] ? catRes[0].category_id : 1;
    console.log('  └─ ✅ Category Master: 1 Clean Record ("Dairy & Beverages")');

    // 4. Seed 1 Perfect Unit
    const [unitRes] = await db.execute(`
      INSERT INTO units (name, active, created_by)
      VALUES ('Packet / Unit', 1, 'Parshav')
      RETURNING unit_id
    `);
    const unitId = unitRes[0] ? unitRes[0].unit_id : 1;
    console.log('  └─ ✅ Base Unit Master: 1 Clean Record ("Packet / Unit")');

    // 5. Seed 1 Perfect Tax
    const [taxRes] = await db.execute(`
      INSERT INTO taxes (name, percentage, active, created_by)
      VALUES ('GST 18%', 18.00, 1, 'Parshav')
      RETURNING tax_id
    `);
    const taxId = taxRes[0] ? taxRes[0].tax_id : 1;
    console.log('  └─ ✅ Tax Master: 1 Clean Record ("GST 18%")');

    // 6. Seed 1 Perfect Item
    const [itemRes] = await db.execute(`
      INSERT INTO items (code, name, description, sales_price, purchase_price, category_id, unit_id, tax_id, active, created_by)
      VALUES ('8901262010015', 'Amul Taaza Milk 500ml', 'Pasteurised Toned Milk 500ml pouch', 34.00, 28.00, ${categoryId}, ${unitId}, ${taxId}, 1, 'Parshav')
      RETURNING item_id
    `);
    console.log('  └─ ✅ Item Master: 1 Clean Record ("Amul Taaza Milk 500ml")');

    // 7. Seed 1 Perfect Customer
    await db.execute(`
      INSERT INTO customers (first_name, last_name, phone_1, email, address_1, city, country, created_by)
      VALUES ('Rajesh', 'Sharma', '9876543210', 'rajesh.sharma@example.com', 'A-102 Swastik Complex, SG Highway', 'Ahmedabad', 'India', 'Parshav')
    `);
    console.log('  └─ ✅ Customer Master: 1 Clean Record ("Rajesh Sharma")');

    // 8. Seed 1 Perfect Vendor
    await db.execute(`
      INSERT INTO vendors (first_name, last_name, company, phone_1, email, address_1, city, country, created_by)
      VALUES ('Sanjay', 'Patel', 'Amul Dairy Distributors', '9825012345', 'distributor@amul.coop', 'GIDC Industrial Estate', 'Anand', 'India', 'Parshav')
    `);
    console.log('  └─ ✅ Vendor Master: 1 Clean Record ("Amul Dairy Distributors")');

    // 9. Seed 1 Perfect Employee linked to Parshav
    await db.execute(`
      INSERT INTO employees (user_id, designation, department, salary, active)
      VALUES (${parshavUserId}, 'Store Manager', 'Management', 35000.00, 1)
    `);
    console.log('  └─ ✅ Employee Directory: 1 Clean Record ("Parshav Admin - Store Manager")');

    // 10. Seed 1 Perfect Hotel Room
    await db.execute(`
      INSERT INTO hotel_rooms (room_no, type, price_per_night, status)
      VALUES ('Room 101', 'Deluxe AC Double', 2500.00, 'available')
    `);
    console.log('  └─ ✅ Hotel Rooms: 1 Clean Record ("Room 101 - Deluxe AC Double")');

    // 11. Seed 1 Perfect Hotel Guest
    await db.execute(`
      INSERT INTO hotel_guests (first_name, last_name, phone)
      VALUES ('Anand', 'Verma', '9811223344')
    `);
    console.log('  └─ ✅ Hotel Guests: 1 Clean Record ("Anand Verma")');

    // 12. Seed 1 Perfect Dine-in Table
    await db.execute(`
      INSERT INTO restaurant_tables (table_no, capacity, status)
      VALUES ('Table 01', 4, 'available')
    `);
    console.log('  └─ ✅ Dine-in Tables: 1 Clean Record ("Table 01 - 4 Chairs")');

    console.log('\n=====================================================');
    console.log('🎉 100% CLEAN SLATE DATABASE RESET COMPLETE!');
    console.log('=====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during clean slate DB seeding:', err);
    process.exit(1);
  }
}

seedCleanSlateData();
