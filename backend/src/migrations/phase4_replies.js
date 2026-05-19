require('dotenv').config();
const pool = require('../config/db');

async function migrate() {
    console.log('🚀 Phase 4: Refined ENUMs for replies table...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check leads.id type (UUID or INT)
        const idCheck = await client.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'leads' AND column_name = 'id'
        `);
        const idType = idCheck.rows[0].data_type;
        const refType = (idType === 'uuid') ? 'UUID' : 'INT';

        // 1. Drop existing table to recreate with ENUMs
        await client.query('DROP TABLE IF EXISTS replies CASCADE');

        // 2. Create ENUM types if they don't exist
        await client.query(`
            DO $$ BEGIN
                CREATE TYPE intent_enum AS ENUM ('interested', 'not_interested', 'inquiry', 'pricing', 'unclear');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await client.query(`
            DO $$ BEGIN
                CREATE TYPE sentiment_enum AS ENUM ('positive', 'neutral', 'negative');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // 3. Create table with ENUMs
        await client.query(`
            CREATE TABLE replies (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              lead_id ${refType} REFERENCES leads(id),
              message TEXT NOT NULL,
              intent intent_enum DEFAULT 'unclear',
              sentiment sentiment_enum DEFAULT 'neutral',
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        await client.query('COMMIT');
        console.log('✅ Replies table with ENUM types created successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
