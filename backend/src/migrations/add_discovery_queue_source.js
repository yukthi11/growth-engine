const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const pool = require('../config/db');

async function migrate() {
    console.log('🚀 Adding source + is_acknowledged columns to discovery_queue...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE discovery_queue
            ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'batch',
            ADD COLUMN IF NOT EXISTS is_acknowledged BOOLEAN DEFAULT FALSE;
        `);

        await client.query('COMMIT');
        console.log('✅ Migration complete.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
