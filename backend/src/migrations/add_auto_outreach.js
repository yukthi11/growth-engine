const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const pool = require('../config/db');

async function migrate() {
    console.log('🚀 Adding auto_outreach column to companies table...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE companies
            ADD COLUMN IF NOT EXISTS auto_outreach BOOLEAN DEFAULT TRUE;
        `);

        await client.query('COMMIT');
        console.log('✅ Migration complete: auto_outreach column added (defaults to TRUE).');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
