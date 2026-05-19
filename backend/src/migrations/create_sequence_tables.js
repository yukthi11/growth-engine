require('dotenv').config();
const pool = require('../config/db');

async function migrate() {
    console.log('🚀 Initializing Campaign & Sequence System Tables...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Create Campaigns table if it doesn't already exist correctly
        // (Wait, we know it exists, but let's ensure it has all columns)
        await client.query(`
            CREATE TABLE IF NOT EXISTS campaigns (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. Create Sequence Steps table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sequence_steps (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL, -- 'email', 'whatsapp', 'call'
                delay_days INTEGER DEFAULT 0,
                subject VARCHAR(255),
                body TEXT NOT NULL,
                step_order INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(campaign_id, step_order)
            );
        `);

        // 3. Create Lead Enrollments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS lead_enrollments (
                id SERIAL PRIMARY KEY,
                lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                current_step_order INTEGER DEFAULT 1,
                status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'paused', 'rejected'
                next_run_at TIMESTAMP,
                last_run_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(lead_id, campaign_id)
            );
        `);

        // 4. Create Sequence History table (optional but good for tracking)
        await client.query(`
            CREATE TABLE IF NOT EXISTS sequence_history (
                id SERIAL PRIMARY KEY,
                enrollment_id INTEGER REFERENCES lead_enrollments(id) ON DELETE CASCADE,
                step_id INTEGER REFERENCES sequence_steps(id) ON DELETE SET NULL,
                status VARCHAR(50) NOT NULL, -- 'sent', 'failed'
                sent_at TIMESTAMP DEFAULT NOW(),
                details TEXT
            );
        `);

        await client.query('COMMIT');
        console.log('✅ Campaign system tables initialized successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
