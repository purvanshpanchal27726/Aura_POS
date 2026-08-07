process.env.DATABASE_URL = 'postgresql://poss_1_user:XEXol-nmER6DxTmgae8qtHmi3s9oHA1yg@dpg-d3poc5e417fc73dhnfsg-a.singapore-postgres.render.com/poss_1';
const db = require('./db');

async function seedLiveDatabase() {
  try {
    console.log('🚀 Seeding live Render PostgreSQL database poss_1 directly...');
    await db.initDb();
    console.log('🎉 LIVE RENDER DATABASE poss_1 SEEDED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  }
}

seedLiveDatabase();
