const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function testProgressAPI() {
    const pool = new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'growth_engine',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
    });

    console.log("🚀 Testing Progress Tracking API Logic...");

    try {
        // Query to check what the API returns for an existing campaign
        // Replace with a real campaign ID from your DB if you want to test a specific one
        const testCampaignId = 1; 

        const progressQuery = `
            SELECT 
                COUNT(*) as total_dispatched,
                SUM(CASE WHEN m.status = 'pending' THEN 1 ELSE 0 END) as queued,
                SUM(CASE WHEN m.status = 'sent' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN m.status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM messages m
            JOIN leads l ON m.lead_id = l.id
            WHERE l.campaign_id = $1 AND m.message_type = 'first_outreach'
        `;

        const result = await pool.query(progressQuery, [testCampaignId]);
        const stats = result.rows[0];

        console.log("✅ Progress API Query Successful!");
        console.log("-----------------------------------");
        console.log(`Total Dispatched:  ${stats.total_dispatched || 0}`);
        console.log(`Queued (Pending):  ${stats.queued || 0}`);
        console.log(`Sent (Completed):  ${stats.completed || 0}`);
        console.log(`Failed:            ${stats.failed || 0}`);
        console.log("-----------------------------------");
        console.log("If this returns numbers, the UI progress bar will perfectly render it in real-time!");

    } catch (err) {
        console.error("❌ Test failed:", err);
    } finally {
        await pool.end();
    }
}

testProgressAPI();
