require('dotenv').config();
const pool = require('../config/db');

async function migrate() {
    console.log('🚀 Fixing leads table schema to match application requirements...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Rename existing columns if they exist
        const columnsRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'leads'
        `);
        const columns = columnsRes.rows.map(r => r.column_name);

        if (columns.includes('email') && !columns.includes('email_address')) {
            console.log('Renaming email to email_address...');
            await client.query('ALTER TABLE leads RENAME COLUMN email TO email_address');
        }

        if (columns.includes('address') && !columns.includes('location_normalized')) {
            console.log('Renaming address to location_normalized...');
            await client.query('ALTER TABLE leads RENAME COLUMN address TO location_normalized');
        }

        if (columns.includes('lead_score') && !columns.includes('intent_score')) {
            console.log('Renaming lead_score to intent_score...');
            await client.query('ALTER TABLE leads RENAME COLUMN lead_score TO intent_score');
        }

        // 2. Add missing columns
        const addColumns = [
            { name: 'sources', type: 'text[]' },
            { name: 'merged_at', type: 'timestamp' },
            { name: 'instagram_username', type: 'varchar' },
            { name: 'facebook_username', type: 'varchar' },
            { name: 'intent_score', type: 'integer' }, // just in case it wasn't renamed
            { name: 'tier', type: 'varchar' },
            { name: 'service_fit', type: 'text' },
            { name: 'outreach_draft', type: 'text' },
            { name: 'enriched_at', type: 'timestamp' },
            { name: 'visibility_score', type: 'integer' },
            { name: 'footfall_score', type: 'integer' },
            { name: 'partnership_score', type: 'integer' },
            { name: 'primary_intent', type: 'varchar' },
            { name: 'updated_at', type: 'timestamp DEFAULT NOW()' }
        ];

        // Refresh columns after potential renames
        const updatedColumnsRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'leads'
        `);
        const updatedColumns = updatedColumnsRes.rows.map(r => r.column_name);

        for (const col of addColumns) {
            if (!updatedColumns.includes(col.name)) {
                console.log(`Adding column ${col.name}...`);
                await client.query(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        // 3. Ensure constraints and indexes
        // The business_name ON CONFLICT expects a unique constraint or index
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_business_name_key') THEN
                    ALTER TABLE leads ADD CONSTRAINT leads_business_name_key UNIQUE (business_name);
                END IF;
            END $$;
        `);

        await client.query('COMMIT');
        console.log('✅ Leads table schema fixed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
