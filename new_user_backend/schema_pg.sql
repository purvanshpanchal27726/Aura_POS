-- PostgreSQL-compatible schema for POS System (Render Deployment)
-- Run this on your Render PostgreSQL database using the External Database URL

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS whatsapp_logs CASCADE;
DROP TABLE IF EXISTS printer_settings CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS grn CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS room_services CASCADE;
DROP TABLE IF EXISTS hotel_bookings CASCADE;
DROP TABLE IF EXISTS hotel_guests CASCADE;
DROP TABLE IF EXISTS hotel_rooms CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS kitchen_orders CASCADE;
DROP TABLE IF EXISTS restaurant_order_items CASCADE;
DROP TABLE IF EXISTS restaurant_orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS client_modules CASCADE;
DROP TABLE IF EXISTS module_groups CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS purchase_details CASCADE;
DROP TABLE IF EXISTS purchase_master CASCADE;
DROP TABLE IF EXISTS sales_details CASCADE;
DROP TABLE IF EXISTS sales_master CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS taxes CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS license_info CASCADE;


-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    active SMALLINT DEFAULT 1,
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Modules
CREATE TABLE IF NOT EXISTS modules (
    module_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- 3. Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT,
    module_id INT,
    allowed SMALLINT DEFAULT 0,
    PRIMARY KEY (role_id, module_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (module_id) REFERENCES modules(module_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- A. Clients
CREATE TABLE IF NOT EXISTS clients (
    client_id    SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    email        VARCHAR(255),
    phone        VARCHAR(20),
    address      TEXT,
    gst_no       VARCHAR(20),
    logo_url     TEXT,
    active       SMALLINT DEFAULT 1,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Users
CREATE TABLE IF NOT EXISTS users (
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
    role_id INT,
    client_id INT,
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 5. Customers
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    address_1 VARCHAR(255) NOT NULL,
    address_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    phone_1 VARCHAR(20) NOT NULL,
    phone_2 VARCHAR(20),
    email VARCHAR(255),
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Vendors
CREATE TABLE IF NOT EXISTS vendors (
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
    email VARCHAR(255),
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Units
CREATE TABLE IF NOT EXISTS units (
    unit_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active SMALLINT DEFAULT 1,
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Taxes
CREATE TABLE IF NOT EXISTS taxes (
    tax_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    active SMALLINT DEFAULT 1,
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Categories
CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active SMALLINT DEFAULT 1,
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Items
CREATE TABLE IF NOT EXISTS items (
    item_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(255),
    long_name VARCHAR(255),
    description TEXT,
    code VARCHAR(100),
    image TEXT,
    sales_price DECIMAL(10,2) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    editable_price SMALLINT DEFAULT 0,
    visible SMALLINT DEFAULT 1,
    tax_id INT,
    category_id INT,
    unit_id INT,
    base_quantity DECIMAL(10,2) DEFAULT 1.00,
    weight_measurement VARCHAR(50) DEFAULT 'none',
    active SMALLINT DEFAULT 1,
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tax_id) REFERENCES taxes(tax_id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES units(unit_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 11. Sales Master
CREATE TABLE IF NOT EXISTS sales_master (
    sales_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    sales_date DATE NOT NULL,
    sales_bill_no VARCHAR(100) NOT NULL,
    gross DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 12. Sales Details
CREATE TABLE IF NOT EXISTS sales_details (
    sales_detail_id SERIAL PRIMARY KEY,
    sales_id INT NOT NULL,
    item_id INT NOT NULL,
    rate DECIMAL(10,2) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    item_amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sales_id) REFERENCES sales_master(sales_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 13. Purchase Master
CREATE TABLE IF NOT EXISTS purchase_master (
    purchase_id SERIAL PRIMARY KEY,
    vendor_id INT NOT NULL,
    purchase_date DATE NOT NULL,
    purchase_bill_no VARCHAR(100) NOT NULL,
    gross DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 14. Purchase Details
CREATE TABLE IF NOT EXISTS purchase_details (
    purchase_detail_id SERIAL PRIMARY KEY,
    purchase_id INT NOT NULL,
    item_id INT NOT NULL,
    rate DECIMAL(10,2) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    item_amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchase_master(purchase_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- SEED DATA
INSERT INTO roles (role_id, name, active, created_by) VALUES 
(1, 'Admin', 1, 'System'),
(2, 'Manager', 1, 'System'),
(3, 'User', 1, 'System'),
(4, 'Viewer', 1, 'System');

INSERT INTO modules (module_id, name) VALUES
(1, 'User'), (2, 'Customer'), (3, 'Item'),
(4, 'Sales'), (5, 'Purchase'), (6, 'Report');

INSERT INTO role_permissions (role_id, module_id, allowed) VALUES
(1,1,1),(1,2,1),(1,3,1),(1,4,1),(1,5,1),(1,6,1),
(2,1,0),(2,2,1),(2,3,1),(2,4,1),(2,5,1),(2,6,1),
(3,1,0),(3,2,0),(3,3,0),(3,4,1),(3,5,1),(3,6,0),
(4,1,0),(4,2,0),(4,3,0),(4,4,0),(4,5,0),(4,6,1);

INSERT INTO users (user_id, username, password, first_name, middle_name, last_name, address_1, address_2, address_3, city, country, phone_1, phone_2, email_1, email_2, role_id, created_by) VALUES
(1,'Dhruvi','8d0f37767e31b16034b9d632edf7402b:40f21b5c7d9d28ce873f25a0551d85f9','Dhruvi','','Patel','Admin Office 1','','','Ahmedabad','India','9876543210','','dhruvi@vanshee.com','',1,'System'),
(2,'Krinna','8d0f37767e31b16034b9d632edf7402b:40f21b5c7d9d28ce873f25a0551d85f9','Krinna','','Anandpara','Manager Desk A','','','Surat','India','9876543211','','krinna@vanshee.com','',1,'System'),
(3,'Parshav','8d0f37767e31b16034b9d632edf7402b:40f21b5c7d9d28ce873f25a0551d85f9','Parshav','','Shah','Store Counter 1','','','Vadodara','India','9876543212','','parshav@vanshee.com','',1,'System');

-- Fix serial sequences after explicit ID inserts (REQUIRED in PostgreSQL)
SELECT setval(pg_get_serial_sequence('roles','role_id'), MAX(role_id)) FROM roles;
SELECT setval(pg_get_serial_sequence('modules','module_id'), MAX(module_id)) FROM modules;
SELECT setval(pg_get_serial_sequence('users','user_id'), MAX(user_id)) FROM users;

-- 15. License Info Table
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

-- Seed default license row
INSERT INTO license_info (license_key, valid_from, valid_to, amc_start_date, amc_end_date, status)
VALUES ('VANSHEE-POS-LICENSE-KEY-2026', '2026-01-01', '2026-08-31', '2026-01-01', '2026-08-31', 'Active')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('license_info','license_id'), COALESCE((SELECT MAX(license_id) FROM license_info), 1));

-- 16. Module Groups
CREATE TABLE IF NOT EXISTS module_groups (
    group_id    SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    icon        VARCHAR(100),
    description TEXT
);

-- 17. Client Modules
CREATE TABLE IF NOT EXISTS client_modules (
    client_id INT NOT NULL,
    group_id  INT NOT NULL,
    enabled   SMALLINT DEFAULT 1,
    PRIMARY KEY (client_id, group_id),
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (group_id)  REFERENCES module_groups(group_id) ON DELETE CASCADE
);

-- 18. Restaurant Tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
    table_id   SERIAL PRIMARY KEY,
    client_id  INT REFERENCES clients(client_id) ON DELETE CASCADE,
    table_no   VARCHAR(20) NOT NULL,
    section    VARCHAR(50),
    capacity   INT DEFAULT 4,
    qr_token   VARCHAR(255) UNIQUE,
    status     VARCHAR(20) DEFAULT 'available',
    active     SMALLINT DEFAULT 1
);

-- 19. Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
    category_id  SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    image_url    TEXT,
    active       SMALLINT DEFAULT 1
);

-- 20. Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    menu_item_id    SERIAL PRIMARY KEY,
    client_id       INT REFERENCES clients(client_id) ON DELETE CASCADE,
    category_id     INT REFERENCES menu_categories(category_id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    price           DECIMAL(10,2) NOT NULL,
    image_url       TEXT,
    preparation_time INT DEFAULT 10,
    kitchen_dept    VARCHAR(100),
    gst_percent     DECIMAL(5,2) DEFAULT 0,
    is_veg          SMALLINT DEFAULT 1,
    available       SMALLINT DEFAULT 1,
    active          SMALLINT DEFAULT 1
);

-- 21. Restaurant Orders
CREATE TABLE IF NOT EXISTS restaurant_orders (
    order_id     SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id) ON DELETE CASCADE,
    table_id     INT REFERENCES restaurant_tables(table_id),
    customer_id  INT REFERENCES customers(customer_id),
    waiter_id    INT REFERENCES users(user_id),
    order_type   VARCHAR(20) DEFAULT 'dine-in',
    status       VARCHAR(20) DEFAULT 'pending',
    total        DECIMAL(10,2) DEFAULT 0,
    tax_amount   DECIMAL(10,2) DEFAULT 0,
    discount     DECIMAL(10,2) DEFAULT 0,
    notes        TEXT,
    created_by   VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 22. Restaurant Order Items
CREATE TABLE IF NOT EXISTS restaurant_order_items (
    id           SERIAL PRIMARY KEY,
    order_id     INT REFERENCES restaurant_orders(order_id) ON DELETE CASCADE,
    menu_item_id INT REFERENCES menu_items(menu_item_id),
    quantity     DECIMAL(10,2) DEFAULT 1,
    price        DECIMAL(10,2),
    status       VARCHAR(20) DEFAULT 'pending',
    notes        TEXT,
    chef_id      INT REFERENCES users(user_id)
);

-- 23. Kitchen Orders (KDS)
CREATE TABLE IF NOT EXISTS kitchen_orders (
    kitchen_order_id SERIAL PRIMARY KEY,
    order_id         INT REFERENCES restaurant_orders(order_id),
    client_id        INT REFERENCES clients(client_id),
    status           VARCHAR(20) DEFAULT 'new',
    priority         INT DEFAULT 0,
    created_date     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at      TIMESTAMP,
    ready_at         TIMESTAMP
);

-- 24. Bills
CREATE TABLE IF NOT EXISTS bills (
    bill_id      SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id),
    order_id     INT REFERENCES restaurant_orders(order_id),
    booking_id   INT,
    bill_no      VARCHAR(50) UNIQUE,
    subtotal     DECIMAL(10,2),
    tax_amount   DECIMAL(10,2),
    discount     DECIMAL(10,2) DEFAULT 0,
    total        DECIMAL(10,2),
    status       VARCHAR(20) DEFAULT 'unpaid',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 25. Payments
CREATE TABLE IF NOT EXISTS payments (
    payment_id     SERIAL PRIMARY KEY,
    client_id      INT REFERENCES clients(client_id),
    bill_id        INT REFERENCES bills(bill_id),
    method         VARCHAR(30),
    amount         DECIMAL(10,2),
    transaction_id VARCHAR(255),
    status         VARCHAR(20) DEFAULT 'completed',
    created_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 26. Hotel Rooms
CREATE TABLE IF NOT EXISTS hotel_rooms (
    room_id          SERIAL PRIMARY KEY,
    client_id        INT REFERENCES clients(client_id) ON DELETE CASCADE,
    room_no          VARCHAR(20) NOT NULL,
    type             VARCHAR(50) DEFAULT 'Standard',
    floor            INT,
    price_per_night  DECIMAL(10,2) NOT NULL,
    status           VARCHAR(20) DEFAULT 'available',
    amenities        TEXT,
    active           SMALLINT DEFAULT 1
);

-- 27. Hotel Guests
CREATE TABLE IF NOT EXISTS hotel_guests (
    guest_id   SERIAL PRIMARY KEY,
    client_id  INT REFERENCES clients(client_id),
    first_name VARCHAR(255) NOT NULL,
    last_name  VARCHAR(255) NOT NULL,
    phone      VARCHAR(20),
    email      VARCHAR(255),
    id_type    VARCHAR(50),
    id_number  VARCHAR(100),
    address    TEXT,
    loyalty_points INT DEFAULT 0
);

-- 28. Hotel Bookings
CREATE TABLE IF NOT EXISTS hotel_bookings (
    booking_id    SERIAL PRIMARY KEY,
    client_id     INT REFERENCES clients(client_id),
    room_id       INT REFERENCES hotel_rooms(room_id),
    guest_id      INT REFERENCES hotel_guests(guest_id),
    check_in      DATE NOT NULL,
    check_out     DATE NOT NULL,
    nights        INT,
    total_amount  DECIMAL(10,2),
    advance_paid  DECIMAL(10,2) DEFAULT 0,
    status        VARCHAR(20) DEFAULT 'confirmed',
    receptionist_id INT REFERENCES users(user_id),
    notes         TEXT,
    created_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 29. Room Services
CREATE TABLE IF NOT EXISTS room_services (
    service_id   SERIAL PRIMARY KEY,
    booking_id   INT REFERENCES hotel_bookings(booking_id),
    client_id    INT REFERENCES clients(client_id),
    service_type VARCHAR(50),
    description  TEXT,
    amount       DECIMAL(10,2) DEFAULT 0,
    status       VARCHAR(20) DEFAULT 'pending',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 30. Inventory
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id),
    item_name    VARCHAR(255) NOT NULL,
    sku          VARCHAR(100),
    barcode      VARCHAR(100),
    unit         VARCHAR(50),
    current_stock DECIMAL(10,3) DEFAULT 0,
    min_stock    DECIMAL(10,3) DEFAULT 0,
    expiry_date  DATE,
    batch_no     VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 31. Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    movement_id  SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id),
    inventory_id INT REFERENCES inventory(inventory_id),
    type         VARCHAR(20),
    quantity     DECIMAL(10,3),
    reference    VARCHAR(255),
    notes        TEXT,
    created_by   VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 32. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id        SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id),
    vendor_id    INT REFERENCES vendors(vendor_id),
    status       VARCHAR(20) DEFAULT 'draft',
    total        DECIMAL(10,2),
    approved_by  INT REFERENCES users(user_id),
    created_by   VARCHAR(255),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 33. GRN
CREATE TABLE IF NOT EXISTS grn (
    grn_id       SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id),
    po_id        INT REFERENCES purchase_orders(po_id),
    received_by  INT REFERENCES users(user_id),
    notes        TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 34. Employees
CREATE TABLE IF NOT EXISTS employees (
    employee_id  SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id),
    user_id      INT REFERENCES users(user_id),
    designation  VARCHAR(100),
    department   VARCHAR(100),
    salary       DECIMAL(10,2),
    join_date    DATE,
    active       SMALLINT DEFAULT 1
);

-- 35. Attendance
CREATE TABLE IF NOT EXISTS attendance (
    id           SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id),
    employee_id  INT REFERENCES employees(employee_id),
    date         DATE NOT NULL,
    check_in     TIME,
    check_out    TIME,
    status       VARCHAR(20) DEFAULT 'present'
);

-- 36. Printer Settings
CREATE TABLE IF NOT EXISTS printer_settings (
    id            SERIAL PRIMARY KEY,
    client_id     INT REFERENCES clients(client_id) ON DELETE CASCADE,
    printer_name  VARCHAR(255),
    printer_type  VARCHAR(30) DEFAULT 'thermal',
    paper_size    VARCHAR(10) DEFAULT 'medium',
    connection    VARCHAR(20) DEFAULT 'usb',
    ip_address    VARCHAR(50),
    port          INT DEFAULT 9100,
    auto_print    SMALLINT DEFAULT 0,
    copies        INT DEFAULT 1,
    updated_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 37. WhatsApp Logs
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id           SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id),
    bill_id      INT REFERENCES bills(bill_id),
    phone        VARCHAR(20),
    message      TEXT,
    status       VARCHAR(20) DEFAULT 'sent',
    sent_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 38. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    client_id       INT REFERENCES clients(client_id),
    type            VARCHAR(50),
    message         TEXT,
    is_read         SMALLINT DEFAULT 0,
    created_date    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 39. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id       SERIAL PRIMARY KEY,
    client_id    INT REFERENCES clients(client_id),
    user_id      INT REFERENCES users(user_id),
    action       VARCHAR(255),
    table_name   VARCHAR(100),
    record_id    INT,
    old_value    TEXT,
    new_value    TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Module Groups
INSERT INTO module_groups (group_id, name, description) VALUES
(1, 'Kirana', 'Manage products, billing, inventory, payments'),
(2, 'Restaurant', 'Manage tables, orders, menu, kitchen'),
(3, 'Hotel', 'Manage rooms, bookings, guests, check in/out')
ON CONFLICT (group_id) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Fix serial sequences
SELECT setval(pg_get_serial_sequence('module_groups','group_id'), COALESCE((SELECT MAX(group_id) FROM module_groups), 1));

