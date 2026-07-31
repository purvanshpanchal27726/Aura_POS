const path = require('path');
const backendDir = path.join(__dirname, '../new_user_backend');
const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const db = require(path.join(backendDir, 'db'));
const bcrypt = require(path.join(backendDir, 'node_modules/bcryptjs'));

async function cleanDuplicatesAndSeedCleanSlate() {
  console.log('🧹 TRUNCATING ALL TABLES & SEEDING EXACTLY 1 CLEAN UNIQUE RECORD PER MODULE...\n');

  try {
    // 1. Truncate all main tables to reset PK sequences
    await db.execute(`
      TRUNCATE TABLE 
        sales_master, purchase_master, hotel_bookings, hotel_guests, hotel_rooms, 
        menu_items, menu_categories, restaurant_tables,
        employees, items, categories, taxes, units, customers, vendors, 
        users, clients, roles
      RESTART IDENTITY CASCADE
    `);
    console.log('  └─ ✅ All 18 core tables truncated with RESTART IDENTITY CASCADE');

    // 2. Roles (4 Roles)
    await db.execute(`
      INSERT INTO roles (role_id, name)
      VALUES 
        (1, 'Super-Admin'),
        (2, 'Admin'),
        (3, 'Manager'),
        (4, 'Cashier')
    `);
    console.log('  └─ ✅ Roles: 4 Roles (Super-Admin, Admin, Manager, Cashier)');

    // 3. Client Company (1 Company)
    const [clientRes] = await db.execute(`
      INSERT INTO clients (client_id, name, email, phone, address, active)
      VALUES (1, 'Vanshee POS Enterprise', 'admin@vanshee.com', '9876543210', 'SG Highway, Ahmedabad, India', 1)
      RETURNING client_id
    `);
    const clientId = clientRes[0] ? clientRes[0].client_id : 1;
    console.log('  └─ ✅ Client Companies: 1 Company ("Vanshee POS Enterprise")');

    // 4. Users (5 Users: Parshav, Dhruvi, Krinna, Kavy as SuperAdmins, abc as CompanyAdmin)
    const passParshav = await bcrypt.hash('Parshav', 10);
    const passDhruvi = await bcrypt.hash('Dhruvi', 10);
    const passKrinna = await bcrypt.hash('Krinna', 10);
    const passKavy = await bcrypt.hash('Kavy', 10);
    const passAbc = await bcrypt.hash('abc', 10);

    const [userRes] = await db.execute(`
      INSERT INTO users (username, password, first_name, last_name, email_1, address_1, city, country, phone_1, role_id, client_id, created_by)
      VALUES 
        ('Parshav', '${passParshav}', 'Parshav', 'Admin', 'parshav@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543210', 1, NULL, 'System'),
        ('Dhruvi', '${passDhruvi}', 'Dhruvi', 'SuperAdmin', 'dhruvi@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543211', 1, NULL, 'System'),
        ('Krinna', '${passKrinna}', 'Krinna', 'SuperAdmin', 'krinna@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543212', 1, NULL, 'System'),
        ('Kavy', '${passKavy}', 'Kavy', 'SuperAdmin', 'kavy@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543213', 1, NULL, 'System'),
        ('abc', '${passAbc}', 'abc', 'CompanyAdmin', 'abc@vanshee.com', 'Company Office', 'Ahmedabad', 'India', '9876543214', 2, ${clientId}, 'System')
      RETURNING user_id
    `);
    const parshavUserId = userRes[0] ? userRes[0].user_id : 1;
    console.log('  └─ ✅ User Master: EXACTLY 5 Users (Parshav, Dhruvi, Krinna, Kavy, abc)');

    // 5. Category Master (1 Record)
    const [catRes] = await db.execute(`
      INSERT INTO categories (name, active, created_by, client_id)
      VALUES ('Dairy & Beverages', 1, 'Parshav', ${clientId})
      RETURNING category_id
    `);
    const categoryId = catRes[0] ? catRes[0].category_id : 1;
    console.log('  └─ ✅ Category Master: EXACTLY 1 Record ("Dairy & Beverages")');

    // 6. Base Unit Master (1 Record)
    const [unitRes] = await db.execute(`
      INSERT INTO units (name, active, created_by, client_id)
      VALUES ('Packet / Unit', 1, 'Parshav', ${clientId})
      RETURNING unit_id
    `);
    const unitId = unitRes[0] ? unitRes[0].unit_id : 1;
    console.log('  └─ ✅ Base Unit Master: EXACTLY 1 Record ("Packet / Unit")');

    // 7. Tax Master (1 Record)
    const [taxRes] = await db.execute(`
      INSERT INTO taxes (name, percentage, active, created_by, client_id)
      VALUES ('GST 18%', 18.00, 1, 'Parshav', ${clientId})
      RETURNING tax_id
    `);
    const taxId = taxRes[0] ? taxRes[0].tax_id : 1;
    console.log('  └─ ✅ Tax Master: EXACTLY 1 Record ("GST 18%")');

    // 8. Item Master (1 Record)
    await db.execute(`
      INSERT INTO items (code, name, description, sales_price, purchase_price, category_id, unit_id, tax_id, active, created_by, client_id)
      VALUES ('8901262010015', 'Amul Taaza Milk 500ml', 'Pasteurised Toned Milk 500ml pouch', 34.00, 28.00, ${categoryId}, ${unitId}, ${taxId}, 1, 'Parshav', ${clientId})
    `);
    console.log('  └─ ✅ Item Master: EXACTLY 1 Record ("Amul Taaza Milk 500ml")');

    // 9. Customer Master (1 Record)
    const [custRes] = await db.execute(`
      INSERT INTO customers (first_name, last_name, phone_1, email, address_1, city, country, created_by, client_id)
      VALUES ('Rajesh', 'Sharma', '9876543210', 'rajesh.sharma@example.com', 'A-102 Swastik Complex, SG Highway', 'Ahmedabad', 'India', 'Parshav', ${clientId})
      RETURNING customer_id
    `);
    const customerId = custRes[0] ? custRes[0].customer_id : 1;
    console.log('  └─ ✅ Customer Master: EXACTLY 1 Record ("Rajesh Sharma")');

    // 10. Vendor Master (1 Record)
    const [vendRes] = await db.execute(`
      INSERT INTO vendors (first_name, last_name, company, phone_1, email, address_1, city, country, created_by, client_id)
      VALUES ('Sanjay', 'Patel', 'Amul Dairy Distributors', '9825012345', 'distributor@amul.coop', 'GIDC Industrial Estate', 'Anand', 'India', 'Parshav', ${clientId})
      RETURNING vendor_id
    `);
    const vendorId = vendRes[0] ? vendRes[0].vendor_id : 1;
    console.log('  └─ ✅ Vendor Master: EXACTLY 1 Record ("Amul Dairy Distributors")');

    // 11. Employee Directory (1 Record)
    await db.execute(`
      INSERT INTO employees (user_id, designation, department, salary, active, client_id)
      VALUES (${parshavUserId}, 'Store Manager', 'Management', 35000.00, 1, ${clientId})
    `);
    console.log('  └─ ✅ Employee Directory: EXACTLY 1 Record ("Parshav Admin - Store Manager")');

    // 12. Hotel Rooms (1 Record)
    const [roomRes] = await db.execute(`
      INSERT INTO hotel_rooms (room_no, type, price_per_night, status, client_id)
      VALUES ('Room 101', 'Deluxe AC Double', 2500.00, 'available', ${clientId})
      RETURNING room_id
    `);
    const roomId = roomRes[0] ? roomRes[0].room_id : 1;
    console.log('  └─ ✅ Hotel Rooms: EXACTLY 1 Record ("Room 101 - Deluxe AC Double")');

    // 13. Hotel Guests (1 Record)
    const [guestRes] = await db.execute(`
      INSERT INTO hotel_guests (first_name, last_name, phone, client_id)
      VALUES ('Anand', 'Verma', '9811223344', ${clientId})
      RETURNING guest_id
    `);
    const guestId = guestRes[0] ? guestRes[0].guest_id : 1;
    console.log('  └─ ✅ Hotel Guests: EXACTLY 1 Record ("Anand Verma")');

    // 14. Room Bookings (1 Record)
    await db.execute(`
      INSERT INTO hotel_bookings (room_id, guest_id, check_in, check_out, total_amount, status, client_id)
      VALUES (${roomId}, ${guestId}, CURRENT_DATE, CURRENT_DATE + INTERVAL '2 days', 5000.00, 'Confirmed', ${clientId})
    `);
    console.log('  └─ ✅ Room Bookings: EXACTLY 1 Booking ("Book #1001 - Anand Verma - Room 101")');

    // 15. Dine-in Tables (1 Record)
    const [tblRes] = await db.execute(`
      INSERT INTO restaurant_tables (table_no, capacity, status, client_id)
      VALUES ('Table 01', 4, 'available', ${clientId})
      RETURNING table_id
    `);
    const tableId = tblRes[0] ? tblRes[0].table_id : 1;
    console.log('  └─ ✅ Dine-in Tables: EXACTLY 1 Record ("Table 01 - 4 Chairs")');

    // 16. Menu Categories & Items (1 Record)
    const [mCatRes] = await db.execute(`
      INSERT INTO menu_categories (name, active, client_id)
      VALUES ('Main Course', 1, ${clientId})
      RETURNING category_id
    `);
    const menuCatId = mCatRes[0] ? mCatRes[0].category_id : 1;

    await db.execute(`
      INSERT INTO menu_items (name, price, category_id, active, client_id)
      VALUES ('Paneer Butter Masala', 280.00, ${menuCatId}, 1, ${clientId})
    `);
    console.log('  └─ ✅ Restaurant Menu: EXACTLY 1 Dish ("Paneer Butter Masala - ₹280")');

    // 17. Sales Master (1 Record)
    await db.execute(`
      INSERT INTO sales_master (sales_bill_no, customer_id, sales_date, gross, tax, total, payment_method, client_id)
      VALUES ('INV-1001', ${customerId}, CURRENT_TIMESTAMP, 34.00, 6.12, 40.12, 'Cash', ${clientId})
    `);
    console.log('  └─ ✅ Sales Billing & Receipts: EXACTLY 1 Invoice ("#INV-1001 - ₹40.12")');

    // 18. Purchase Master (1 Record)
    await db.execute(`
      INSERT INTO purchase_master (purchase_bill_no, vendor_id, purchase_date, gross, tax, total, created_by, client_id)
      VALUES ('PO-1001', ${vendorId}, CURRENT_TIMESTAMP, 280.00, 50.40, 330.40, 'System', ${clientId})
    `);
    console.log('  └─ ✅ Inward Purchase & Orders: EXACTLY 1 PO ("#PO-1001 - ₹330.40")');

    console.log('\n=====================================================');
    console.log('🎉 ALL DUPLICATES CLEANED & EXPLICITLY RESET TO 1 UNIQUE RECORD PER MODULE!');
    console.log('=====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during clean slate DB seeding:', err);
    process.exit(1);
  }
}

cleanDuplicatesAndSeedCleanSlate();
