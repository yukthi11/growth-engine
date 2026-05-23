const pool = require('../config/db');

async function migrate() {
    console.log('🚀 Creating discovery_history table for Continuous Deep Discovery...');
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS discovery_history (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER,
                city VARCHAR(100),
                area_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(campaign_id, city, area_name)
            );

            CREATE INDEX IF NOT EXISTS idx_discovery_history_campaign 
                ON discovery_history(campaign_id, city);
        `);
        console.log('✅ Migration successful: discovery_history table created.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        pool.end();
    }
}

migrate();
