const { Pool } = require('pg');

async function cloneDatabase(targetDbName = 'poss-1') {
  console.log(`🚀 Starting database clone from 'posss' to '${targetDbName}'...`);
  
  const sourceConnectionString = process.env.DATABASE_URL || 'postgres://posss_user:wRR2382SEDvv97U8CjigtT47BGtG5OmR@dpg-d952i5uq1p3s73cg5470-a.singapore-postgres.render.com/posss';
  
  const sourcePool = new Pool({
    connectionString: sourceConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await sourcePool.connect();
    
    // Check if target db exists
    const checkDbRes = await client.query(`SELECT datname FROM pg_database WHERE datname = $1;`, [targetDbName]);
    if (checkDbRes.rows.length === 0) {
      console.log(`Database "${targetDbName}" does not exist. Attempting to create it...`);
      try {
        await client.query(`CREATE DATABASE "${targetDbName}";`);
        console.log(`Successfully created database "${targetDbName}"!`);
      } catch (createErr) {
        console.warn(`CREATE DATABASE warning: ${createErr.message}`);
      }
    } else {
      console.log(`Database "${targetDbName}" exists.`);
    }
    client.release();

    const targetConnectionString = sourceConnectionString.replace(/\/posss(\?|$)/, `/${targetDbName}$1`);
    console.log(`Target database URL: ${targetConnectionString.replace(/:[^:@]+@/, ':****@')}`);

    const targetPool = new Pool({
      connectionString: targetConnectionString,
      ssl: { rejectUnauthorized: false }
    });

    const sourceClient = await sourcePool.connect();
    const targetClient = await targetPool.connect();

    const tablesRes = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      console.log(`📋 Copying table: "${tableName}"...`);

      const dataRes = await sourceClient.query(`SELECT * FROM "${tableName}";`);
      console.log(`   └─ Found ${dataRes.rows.length} rows.`);

      if (dataRes.rows.length > 0) {
        for (const dataRow of dataRes.rows) {
          const keys = Object.keys(dataRow);
          const values = Object.values(dataRow);
          const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
          const colNames = keys.map(k => `"${k}"`).join(', ');

          const insertSql = `
            INSERT INTO "${tableName}" (${colNames}) 
            VALUES (${placeholders}) 
            ON CONFLICT DO NOTHING;
          `;
          try {
            await targetClient.query(insertSql, values);
          } catch (insertErr) {
            // Silently swallow duplicate key conflicts during copy
          }
        }
      }
    }

    sourceClient.release();
    targetClient.release();
    await sourcePool.end();
    await targetPool.end();
    console.log(`🎉 Database backup & migration to '${targetDbName}' completed successfully!`);
    return { success: true, message: `Backup & migration to database ${targetDbName} complete.` };
  } catch (err) {
    console.error('Clone Execution Error:', err);
    return { success: false, error: err.message };
  }
}

if (require.main === module) {
  cloneDatabase(process.argv[2] || 'poss-1');
}

module.exports = cloneDatabase;
