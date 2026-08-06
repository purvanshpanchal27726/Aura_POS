const db = require('./db');

async function seedLiveDatabase() {
  try {
    console.log('🚀 Seeding live Render PostgreSQL database poss_1 directly...');
    await db.initDb();
    console.log('✅ Live Render database poss_1 populated with full POS data!');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  }
}

seedLiveDatabase();
