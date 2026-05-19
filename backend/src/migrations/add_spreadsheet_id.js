const pool = require('../config/db');

async function up() {
    try {
        console.log('🚀 Starting Migration: Add spreadsheet_id to companies');
        
        // Check if column exists first to avoid errors
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='companies' AND column_name='spreadsheet_id';
        `);

        if (checkColumn.rowCount === 0) {
            await pool.query(`
                ALTER TABLE companies 
                ADD COLUMN spreadsheet_id TEXT;
            `);
            console.log('✅ Column spreadsheet_id added to companies table.');
        } else {
            console.log('ℹ️ Column spreadsheet_id already exists.');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
        process.exit(1);
    }
}

up();
