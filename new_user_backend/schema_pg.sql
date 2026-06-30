-- PostgreSQL-compatible schema for POS System (Render Deployment)
-- Run this on your Render PostgreSQL database using the External Database URL

-- Drop tables in reverse dependency order
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
    created_by VARCHAR(255) DEFAULT 'System',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE SET NULL ON UPDATE CASCADE
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
    email VARCHAR(255) NOT NULL,
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
    email VARCHAR(255) NOT NULL,
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
