const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://pos_system_db_q08x_user:pJOmugHrCubbkCanBII7LAKJCOdEJJix@dpg-da3el8rtm21s738j9870-a.singapore-postgres.render.com/pos_system_db_q08x',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log('Connected to Render DB!');
  
  const hash = await bcrypt.hash('admin123', 10);
  
  await client.query('DELETE FROM users');
  
  await client.query(`
    INSERT INTO users (
      username, password, first_name, last_name, 
      address_1, city, country, phone_1, email_1, 
      role_id, client_id, is_superadmin
    ) VALUES (
      'admin', $1, 'System', 'Admin', 
      'Office', 'City', 'Country', '0000000000', 'admin@pos.com', 
      1, 1, 1
    )
  `, [hash]);
  
  console.log('Successfully wiped users and created fresh admin user!');
  await client.end();
}
run().catch(console.error);
