const cron = require('node-cron');
const pool = require('../config/db');
const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

// Access the sequence queue directly
const sequenceQueue = new Queue('sequenceQueue', { connection });

async function runAutoPilot() {
    if (process.env.ENABLE_AUTOMATION === 'false') {
        console.log('🤖 [AutoPilot] Skipping run because ENABLE_AUTOMATION is false.');
        return;
    }
    console.log('🚀 [AutoPilot] Looking for new Tier A leads to enroll...');

    try {
        // 1. Query leads that are Tier A but not enrolled yet
        const query = `
            SELECT l.id, l.campaign_id, c.name as campaign_name
            FROM leads l
            JOIN campaigns c ON l.campaign_id = c.id
            WHERE l.tier = 'A' 
              AND l.campaign_id IS NOT NULL
              AND l.id NOT IN (SELECT lead_id FROM lead_enrollments)
        `;

        const result = await pool.query(query);
        const leads = result.rows;

        console.log(`🔍 [AutoPilot] Found ${leads.length} Tier A leads ready for enrollment.`);

        for (const lead of leads) {
            try {
                // 2. Perform internal enrollment logic
                const enrollmentRes = await pool.query(`
                    INSERT INTO lead_enrollments (lead_id, campaign_id, current_step_order, status, next_run_at)
                    VALUES ($1, $2, 1, 'active', NOW())
                    ON CONFLICT (lead_id, campaign_id) DO NOTHING
                    RETURNING id
                `, [lead.id, lead.campaign_id]);

                if (enrollmentRes.rows.length > 0) {
                    const enrollmentId = enrollmentRes.rows[0].id;

                    // 3. Kick off the sequence immediately in BullMQ
                    await sequenceQueue.add(
                        `autopilot-enroll-${enrollmentId}`,
                        { enrollmentId },
                        { removeOnComplete: true }
                    );

                    console.log(`✅ [AutoPilot] Enrolled Lead ${lead.id} into "${lead.campaign_name}" (Enrollment #${enrollmentId})`);
                }
            } catch (err) {
                // Individual error handling so one failure doesn't stop the entire loop
                console.error(`❌ [AutoPilot] Failed to enroll lead ${lead.id}:`, err.message);
            }
        }
    } catch (err) {
        console.error('🛑 [AutoPilot] Critical Error in main loop:', err.message);
    }
}

// 4. Schedule to run every day at 9:00 AM (0 9 * * *)
cron.schedule('0 9 * * *', () => {
    runAutoPilot();
});

// For immediate debugging on first run, we can also call it once
// runAutoPilot();

console.log('🤖 AutoPilot service is active and scheduled for 9:00 AM daily.');

module.exports = { runAutoPilot };
