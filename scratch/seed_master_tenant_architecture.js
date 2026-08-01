const path = require('path');
const backendDir = path.join(__dirname, '../new_user_backend');
const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const db = require(path.join(backendDir, 'db'));
const bcrypt = require(path.join(backendDir, 'node_modules/bcryptjs'));

async function seedMasterTenantArchitecture() {
  console.log('🏛️ SEEDING MASTER (CLIENT 1) & TENANT (CLIENT 2+) ARCHITECTURE...\n');

  try {
    // 1. Truncate all tables
    await db.execute(`
      TRUNCATE TABLE 
        sales_master, purchase_master, hotel_bookings, hotel_guests, hotel_rooms, 
        menu_items, menu_categories, restaurant_tables,
        employees, items, categories, taxes, units, customers, vendors, 
        users, clients, roles
      RESTART IDENTITY CASCADE
    `);
    console.log('  └─ ✅ All database tables truncated with RESTART IDENTITY CASCADE');

    // 2. Roles Master (4 Standard System Roles)
    await db.execute(`
      INSERT INTO roles (role_id, name)
      VALUES 
        (1, 'Super-Admin'),
        (2, 'Admin'),
        (3, 'Manager'),
        (4, 'Cashier')
    `);
    console.log('  └─ ✅ Roles Master: 4 Roles (1: Super-Admin, 2: Admin, 3: Manager, 4: Cashier)');

    // 3. Clients Master
    // Client ID 1 = Vanshee POS Enterprise (Master Head Office for Super-Admins)
    // Client ID 2 = ABC Retail & Hospitality (First Independent Client Company)
    await db.execute(`
      INSERT INTO clients (client_id, name, email, phone, address, active)
      VALUES 
        (1, 'Vanshee POS Enterprise', 'admin@vanshee.com', '9876543210', 'SG Highway, Ahmedabad, India', 1),
        (2, 'ABC Retail & Hospitality', 'abc@vanshee.com', '9876543214', 'Company Office, Ahmedabad, India', 1)
    `);
    // Advance sequence to 3 so next new client automatically gets Client ID 3, 4, 5...
    await db.execute(`SELECT setval(pg_get_serial_sequence('clients', 'client_id'), 2)`);
    console.log('  └─ ✅ Client Master: Client ID 1 (Master Enterprise) & Client ID 2 (ABC Company) created. Sequence set to 3+');

    // 4. Users Master
    // All 4 Super-Admins (Parshav, Dhruvi, Krinna, Kavy) -> role_id = 1, client_id = 1
    // Company Admin (abc) -> role_id = 2, client_id = 2
    const passParshav = await bcrypt.hash('Parshav', 10);
    const passDhruvi = await bcrypt.hash('Dhruvi', 10);
    const passKrinna = await bcrypt.hash('Krinna', 10);
    const passKavy = await bcrypt.hash('Kavy', 10);
    const passAbc = await bcrypt.hash('abc', 10);

    const [userRes] = await db.execute(`
      INSERT INTO users (username, password, first_name, last_name, email_1, address_1, city, country, phone_1, role_id, client_id, created_by)
      VALUES 
        ('Parshav', '${passParshav}', 'Parshav', 'Admin', 'parshav@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543210', 1, 1, 'System'),
        ('Dhruvi', '${passDhruvi}', 'Dhruvi', 'SuperAdmin', 'dhruvi@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543211', 1, 1, 'System'),
        ('Krinna', '${passKrinna}', 'Krinna', 'SuperAdmin', 'krinna@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543212', 1, 1, 'System'),
        ('Kavy', '${passKavy}', 'Kavy', 'SuperAdmin', 'kavy@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543213', 1, 1, 'System'),
        ('abc', '${passAbc}', 'abc', 'CompanyAdmin', 'abc@vanshee.com', 'Company Office', 'Ahmedabad', 'India', '9876543214', 2, 2, 'System')
      RETURNING user_id
    `);
    const parshavUserId = (userRes && userRes[0]) ? userRes[0].user_id : 1;
    console.log('  └─ ✅ User Master: Parshav, Dhruvi, Krinna, Kavy (Super-Admins, Client 1) & abc (Admin, Client 2)');

    // 5. Seed 1 Perfect Record for Client 1 (Master Organization)
    const [cat1Res] = await db.execute(`INSERT INTO categories (name, active, created_by, client_id) VALUES ('Dairy & Beverages', 1, 'Parshav', 1) RETURNING category_id`);
    const cat1Id = (cat1Res && cat1Res[0]) ? cat1Res[0].category_id : 1;
    const [unit1Res] = await db.execute(`INSERT INTO units (name, active, created_by, client_id) VALUES ('Packet / Unit', 1, 'Parshav', 1) RETURNING unit_id`);
    const unit1Id = (unit1Res && unit1Res[0]) ? unit1Res[0].unit_id : 1;
    const [tax1Res] = await db.execute(`INSERT INTO taxes (name, percentage, active, created_by, client_id) VALUES ('GST 18%', 18.00, 1, 'Parshav', 1) RETURNING tax_id`);
    const tax1Id = (tax1Res && tax1Res[0]) ? tax1Res[0].tax_id : 1;
    await db.execute(`INSERT INTO items (code, name, description, sales_price, purchase_price, category_id, unit_id, tax_id, active, created_by, client_id) VALUES ('8901262010015', 'Amul Taaza Milk 500ml', 'Pasteurised Toned Milk 500ml pouch', 34.00, 28.00, ${cat1Id}, ${unit1Id}, ${tax1Id}, 1, 'Parshav', 1)`);
    const [cust1Res] = await db.execute(`INSERT INTO customers (first_name, last_name, phone_1, email, address_1, city, country, created_by, client_id) VALUES ('Rajesh', 'Sharma', '9876543210', 'rajesh.sharma@example.com', 'A-102 Swastik Complex, SG Highway', 'Ahmedabad', 'India', 'Parshav', 1) RETURNING customer_id`);
    const cust1Id = (cust1Res && cust1Res[0]) ? cust1Res[0].customer_id : 1;
    const [vend1Res] = await db.execute(`INSERT INTO vendors (first_name, last_name, company, phone_1, email, address_1, city, country, created_by, client_id) VALUES ('Sanjay', 'Patel', 'Amul Dairy Distributors', '9825012345', 'distributor@amul.coop', 'GIDC Industrial Estate', 'Anand', 'India', 'Parshav', 1) RETURNING vendor_id`);
    const vend1Id = (vend1Res && vend1Res[0]) ? vend1Res[0].vendor_id : 1;
    await db.execute(`INSERT INTO employees (user_id, designation, department, salary, active, client_id) VALUES (${parshavUserId}, 'Store Manager', 'Management', 35000.00, 1, 1)`);
    const [room1Res] = await db.execute(`INSERT INTO hotel_rooms (room_no, type, price_per_night, status, client_id) VALUES ('Room 101', 'Deluxe AC Double', 2500.00, 'available', 1) RETURNING room_id`);
    const room1Id = (room1Res && room1Res[0]) ? room1Res[0].room_id : 1;
    const [guest1Res] = await db.execute(`INSERT INTO hotel_guests (first_name, last_name, phone, client_id) VALUES ('Anand', 'Verma', '9811223344', 1) RETURNING guest_id`);
    const guest1Id = (guest1Res && guest1Res[0]) ? guest1Res[0].guest_id : 1;
    await db.execute(`INSERT INTO hotel_bookings (room_id, guest_id, check_in, check_out, total_amount, status, client_id) VALUES (${room1Id}, ${guest1Id}, CURRENT_DATE, CURRENT_DATE + INTERVAL '2 days', 5000.00, 'Confirmed', 1)`);
    await db.execute(`INSERT INTO restaurant_tables (table_no, capacity, status, client_id) VALUES ('Table 01', 4, 'available', 1)`);
    const [mCat1Res] = await db.execute(`INSERT INTO menu_categories (name, active, client_id) VALUES ('Main Course', 1, 1) RETURNING category_id`);
    const menuCat1Id = (mCat1Res && mCat1Res[0]) ? mCat1Res[0].category_id : 1;
    await db.execute(`INSERT INTO menu_items (name, price, category_id, active, client_id) VALUES ('Paneer Butter Masala', 280.00, ${menuCat1Id}, 1, 1)`);
    await db.execute(`INSERT INTO sales_master (sales_bill_no, customer_id, sales_date, gross, tax, total, payment_method, client_id) VALUES ('INV-1001', ${cust1Id}, CURRENT_TIMESTAMP, 34.00, 6.12, 40.12, 'Cash', 1)`);
    await db.execute(`INSERT INTO purchase_master (purchase_bill_no, vendor_id, purchase_date, gross, tax, total, created_by, client_id) VALUES ('PO-1001', ${vend1Id}, CURRENT_TIMESTAMP, 280.00, 50.40, 330.40, 'System', 1)`);
    console.log('  └─ ✅ Client 1 (Vanshee POS Enterprise): 1 Complete Module Sample Dataset Seeded');

    // 6. Seed 1 Perfect Record for Client 2 (ABC Company)
    const [cat2Res] = await db.execute(`INSERT INTO categories (name, active, created_by, client_id) VALUES ('Bakery & Confectionery', 1, 'abc', 2) RETURNING category_id`);
    const cat2Id = (cat2Res && cat2Res[0]) ? cat2Res[0].category_id : 2;
    const [unit2Res] = await db.execute(`INSERT INTO units (name, active, created_by, client_id) VALUES ('Piece / Box', 1, 'abc', 2) RETURNING unit_id`);
    const unit2Id = (unit2Res && unit2Res[0]) ? unit2Res[0].unit_id : 2;
    const [tax2Res] = await db.execute(`INSERT INTO taxes (name, percentage, active, created_by, client_id) VALUES ('GST 5%', 5.00, 1, 'abc', 2) RETURNING tax_id`);
    const tax2Id = (tax2Res && tax2Res[0]) ? tax2Res[0].tax_id : 2;
    await db.execute(`INSERT INTO items (code, name, description, sales_price, purchase_price, category_id, unit_id, tax_id, active, created_by, client_id) VALUES ('8901000111222', 'Fresh Chocolate Cake 500g', 'Rich Dutch Chocolate Sponge Cake', 450.00, 320.00, ${cat2Id}, ${unit2Id}, ${tax2Id}, 1, 'abc', 2)`);
    const [cust2Res] = await db.execute(`INSERT INTO customers (first_name, last_name, phone_1, email, address_1, city, country, created_by, client_id) VALUES ('Priya', 'Shah', '9898989898', 'priya.shah@example.com', 'B-304 Venus Heights', 'Ahmedabad', 'India', 'abc', 2) RETURNING customer_id`);
    const cust2Id = (cust2Res && cust2Res[0]) ? cust2Res[0].customer_id : 2;
    const [vend2Res] = await db.execute(`INSERT INTO vendors (first_name, last_name, company, phone_1, email, address_1, city, country, created_by, client_id) VALUES ('Karan', 'Mehta', 'Fresh Bake Supplies', '9797979797', 'orders@freshbake.com', 'GIDC Phase 2', 'Vadodara', 'India', 'abc', 2) RETURNING vendor_id`);
    const vend2Id = (vend2Res && vend2Res[0]) ? vend2Res[0].vendor_id : 2;
    const [user2Res] = await db.execute(`SELECT user_id FROM users WHERE username = 'abc'`);
    const abcUserId = (user2Res && user2Res[0]) ? user2Res[0].user_id : 5;
    await db.execute(`INSERT INTO employees (user_id, designation, department, salary, active, client_id) VALUES (${abcUserId}, 'Store Administrator', 'Management', 40000.00, 1, 2)`);
    const [room2Res] = await db.execute(`INSERT INTO hotel_rooms (room_no, type, price_per_night, status, client_id) VALUES ('Room 201', 'Executive Suite', 4500.00, 'available', 2) RETURNING room_id`);
    const room2Id = (room2Res && room2Res[0]) ? room2Res[0].room_id : 2;
    const [guest2Res] = await db.execute(`INSERT INTO hotel_guests (first_name, last_name, phone, client_id) VALUES ('Vikram', 'Rathod', '9123456789', 2) RETURNING guest_id`);
    const guest2Id = (guest2Res && guest2Res[0]) ? guest2Res[0].guest_id : 2;
    await db.execute(`INSERT INTO hotel_bookings (room_id, guest_id, check_in, check_out, total_amount, status, client_id) VALUES (${room2Id}, ${guest2Id}, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 13500.00, 'Confirmed', 2)`);
    await db.execute(`INSERT INTO restaurant_tables (table_no, capacity, status, client_id) VALUES ('Table A1', 2, 'available', 2)`);
    const [mCat2Res] = await db.execute(`INSERT INTO menu_categories (name, active, client_id) VALUES ('Desserts', 1, 2) RETURNING category_id`);
    const menuCat2Id = (mCat2Res && mCat2Res[0]) ? mCat2Res[0].category_id : 2;
    await db.execute(`INSERT INTO menu_items (name, price, category_id, active, client_id) VALUES ('Chocolate Lava Cake', 180.00, ${menuCat2Id}, 1, 2)`);
    await db.execute(`INSERT INTO sales_master (sales_bill_no, customer_id, sales_date, gross, tax, total, payment_method, client_id) VALUES ('ABC-INV-001', ${cust2Id}, CURRENT_TIMESTAMP, 450.00, 22.50, 472.50, 'UPI', 2)`);
    await db.execute(`INSERT INTO purchase_master (purchase_bill_no, vendor_id, purchase_date, gross, tax, total, created_by, client_id) VALUES ('ABC-PO-001', ${vend2Id}, CURRENT_TIMESTAMP, 320.00, 16.00, 336.00, 'abc', 2)`);
    console.log('  └─ ✅ Client 2 (ABC Retail & Hospitality): 1 Complete Module Sample Dataset Seeded');

    console.log('\n=====================================================');
    console.log('🎉 MASTER (CLIENT 1) & MULTI-TENANT (CLIENT 2+) ARCHITECTURE READY!');
    console.log('=====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding master-tenant architecture:', err);
    process.exit(1);
  }
}

seedMasterTenantArchitecture();
