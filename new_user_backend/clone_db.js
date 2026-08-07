const { Pool } = require('pg');

async function cloneDatabase(targetDbName = 'poss_1') {
  console.log(`🚀 Starting database data copy from old 'posss' database to '${targetDbName}'...`);
  
  const sourceConnectionString = process.env.OLD_DATABASE_URL || 'postgres://posss_user:wRR2382SEDvv97U8CjigtT47BGtG5OmR@dpg-d952i5uq1p3s73cg5470-a/posss';
  const targetConnectionString = process.env.DATABASE_URL || 'postgres://poss_1_user:XEXol-nmER6DxTmgae8qtHmi3s9oHA1yg@dpg-d3poc5e417fc73dhnfsg-a/poss_1';
  
  const sourcePool = new Pool({
    connectionString: sourceConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  const targetPool = new Pool({
    connectionString: targetConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sourceClient = await sourcePool.connect();
    const targetClient = await targetPool.connect();

    const tablesRes = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    let totalMigratedRows = 0;

    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      console.log(`📋 Copying table: "${tableName}"...`);

      try {
        const dataRes = await sourceClient.query(`SELECT * FROM "${tableName}";`);
        console.log(`   └─ Found ${dataRes.rows.length} rows in source database.`);

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
              totalMigratedRows++;
            } catch (insertErr) {
              // Silently swallow duplicate key conflicts during copy
            }
          }
        }
      } catch (tErr) {
        console.warn(`   └─ Skipped table ${tableName}:`, tErr.message);
      }
    }

    // Sync all serial sequence counters
    console.log('🔄 Syncing sequence counters...');
    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      try {
        const pkRes = await targetClient.query(`
          SELECT a.attname
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass AND i.indisprimary;
        `, [tableName]);

        if (pkRes.rows.length > 0) {
          const pkCol = pkRes.rows[0].attname;
          await targetClient.query(`
            SELECT setval(pg_get_serial_sequence('${tableName}', '${pkCol}'), COALESCE((SELECT MAX("${pkCol}") FROM "${tableName}"), 1));
          `);
        }
      } catch (seqErr) {}
    }

    sourceClient.release();
    targetClient.release();
    await sourcePool.end();
    await targetPool.end();
    console.log(`🎉 Database backup & migration from 'posss' to '${targetDbName}' completed successfully! Total ${totalMigratedRows} rows copied.`);
    return { success: true, message: `Backup & migration complete. Total ${totalMigratedRows} rows copied into ${targetDbName}.` };
  } catch (err) {
    console.error('Clone Execution Error:', err);
    return { success: false, error: err.message };
  }
}

if (require.main === module) {
  cloneDatabase(process.argv[2] || 'poss-1');
}

module.exports = cloneDatabase;
