const path = require('path');
const backendDir = path.join(__dirname, '../new_user_backend');
const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const db = require(path.join(backendDir, 'db'));
const bcrypt = require(path.join(backendDir, 'node_modules/bcryptjs'));

async function fixUserLoginAndRoles() {
  console.log('🔑 Updating 5 Users (4 Super-Admins + 1 Company Admin "abc")...\n');

  try {
    // Hash passwords
    const passParshav = await bcrypt.hash('Parshav', 10);
    const passDhruvi = await bcrypt.hash('Dhruvi', 10);
    const passKrinna = await bcrypt.hash('Krinna', 10);
    const passKavy = await bcrypt.hash('Kavy', 10);
    const passAbc = await bcrypt.hash('abc', 10);

    // Truncate employees and users
    await db.execute(`TRUNCATE TABLE employees, users RESTART IDENTITY CASCADE`);

    const [userRes] = await db.execute(`
      INSERT INTO users (username, password, first_name, last_name, email_1, address_1, city, country, phone_1, role_id, client_id, created_by)
      VALUES 
        ('Parshav', '${passParshav}', 'Parshav', 'Admin', 'parshav@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543210', 1, NULL, 'System'),
        ('Dhruvi', '${passDhruvi}', 'Dhruvi', 'SuperAdmin', 'dhruvi@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543211', 1, NULL, 'System'),
        ('Krinna', '${passKrinna}', 'Krinna', 'SuperAdmin', 'krinna@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543212', 1, NULL, 'System'),
        ('Kavy', '${passKavy}', 'Kavy', 'SuperAdmin', 'kavy@vanshee.com', 'Main Office', 'Ahmedabad', 'India', '9876543213', 1, NULL, 'System'),
        ('abc', '${passAbc}', 'abc', 'CompanyAdmin', 'abc@vanshee.com', 'Company Office', 'Ahmedabad', 'India', '9876543214', 2, 1, 'System')
      RETURNING user_id
    `);

    const parshavId = userRes[0] ? userRes[0].user_id : 1;

    // Seed 1 employee for Parshav
    await db.execute(`
      INSERT INTO employees (user_id, designation, department, salary, active)
      VALUES (${parshavId}, 'Store Manager', 'Management', 35000.00, 1)
    `);

    console.log('  └─ ✅ 4 Super-Admins Created: Parshav, Dhruvi, Krinna, Kavy (role_id = 1, client_id = null)');
    console.log('  └─ ✅ 1 Company Admin Created: abc (role_id = 2, client_id = 1)');
    console.log('\n=====================================================');
    console.log('🎉 USERS RE-SEEDED WITH ORIGINAL PASSWORDS & SUPERADMIN ROLES!');
    console.log('=====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating user login roles:', err);
    process.exit(1);
  }
}

fixUserLoginAndRoles();
