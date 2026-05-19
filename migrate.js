const pool = require('./backend/src/config/db');

async function migrate() {
    try {
        await pool.query(`
            ALTER TABLE leads
                ADD COLUMN IF NOT EXISTS gap_details  JSONB,
                ADD COLUMN IF NOT EXISTS gap_top      TEXT[],
                ADD COLUMN IF NOT EXISTS gap_pillar   VARCHAR(20),
                ADD COLUMN IF NOT EXISTS gap_vertical VARCHAR(20),
                ADD COLUMN IF NOT EXISTS gap_pitch    TEXT,
                ADD COLUMN IF NOT EXISTS mockup_url   TEXT;

            CREATE INDEX IF NOT EXISTS idx_leads_gap_details 
                ON leads USING GIN(gap_details);
            CREATE INDEX IF NOT EXISTS idx_leads_gap_pillar 
                ON leads(gap_pillar);
        `);
        console.log("Migration successful");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        pool.end();
    }
}

migrate();
