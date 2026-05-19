const pool = require('../config/db');
const { runSource } = require('./scraperWorker');
const { generateEmailDraft } = require('../services/messageGenerator');

let activeIO = null;

function setIO(io) {
    activeIO = io;
}

/**
 * Automator Worker
 * ────────────────────────────────────────────────────────
 * 1. Processes 'pending' discovery queries from the queue.
 * 2. Auto-drafts outreach messages for high-quality (Tier A) leads.
 * 3. Sends Socket.io notifications when milestones are hit.
 */
async function processDiscoveryQueue() {
    if (process.env.ENABLE_AUTOMATION === 'false') return;
    const io = activeIO;
    console.log('🤖 [Automator] Checking Discovery Queue...');
    try {
        const nextJob = await pool.query(`
            SELECT * FROM discovery_queue 
            WHERE status = 'pending' 
            ORDER BY created_at ASC 
            LIMIT 1 FOR UPDATE SKIP LOCKED
        `);

        if (nextJob.rowCount === 0) {
            console.log('🤖 [Automator] Discovery Queue is empty. Nothing to process.');
            return;
        }

        const job = nextJob.rows[0];
        console.log(`📡 [Automator] Starting Job #${job.id}: "${job.query}"`);
        
        await pool.query('UPDATE discovery_queue SET status = $1, updated_at = NOW() WHERE id = $2', ['processing', job.id]);

        // Run the actual discovery
        const leadsFound = await runSource(
            'article_explorer', 
            job.query, 
            job.campaign_id, 
            { id: `auto-${job.id}` }, 
            job.company_id, 
            false
        );

        await pool.query(
            'UPDATE discovery_queue SET status = $1, leads_found = $2, updated_at = NOW() WHERE id = $3', 
            ['completed', leadsFound, job.id]
        );

        console.log(`✅ [Automator] Job #${job.id} Complete. Leads Found: ${leadsFound}`);

        // Check if this was the last pending job to notify the user
        const remaining = await pool.query("SELECT count(*) FROM discovery_queue WHERE status = 'pending' AND company_id = $1", [job.company_id]);
        if (parseInt(remaining.rows[0].count) === 0) {
            console.log('🎉 [Automator] All discovery jobs in batch completed.');
            if (io) io.emit('discovery_batch_complete', { companyId: job.company_id, leadsFound });
        }

    } catch (err) {
        console.error('❌ [Automator] Discovery Queue Error:', err.message);
    }
}

/**
 * Auto-Drafter
 * Picks Tier A leads that are NOT yet drafted and generates their outreach content.
 */
async function autoDraftLeads() {
    if (process.env.ENABLE_AUTOMATION === 'false') return;
    const io = activeIO;
    console.log('🧠 [Automator] Scanning for leads needing AI drafting...');
    try {
        const leads = await pool.query(`
            SELECT l.* 
            FROM leads l
            WHERE l.tier = 'A' 
            AND l.is_auto_drafted = FALSE 
            AND (l.website IS NOT NULL OR l.instagram_username IS NOT NULL)
            LIMIT 5
        `);

        if (leads.rowCount === 0) {
            console.log('🧠 [Automator] No Tier A leads found that need drafting.');
            return;
        }

        console.log(`✍️ [Automator] Drafting outreach for ${leads.rowCount} leads...`);

        for (const lead of leads.rows) {
            try {
                // 1. Fetch company context
                const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [lead.company_id]);
                const company = companyRes.rows[0];

                // 2. Generate the draft
                const draft = await generateEmailDraft(lead, company);
                
                // 3. Save as draft in replies table
                const parts = draft.split('\n\n');
                const subject = parts[0]?.replace('Subject: ', '') || 'Outreach';
                const body = parts.slice(1).join('\n\n');

                await pool.query(`
                    INSERT INTO replies (lead_id, company_id, message, channel, status, subject)
                    VALUES ($1, $2, $3, 'email', 'draft', $4)
                    ON CONFLICT (lead_id) DO UPDATE SET 
                        message = EXCLUDED.message,
                        subject = EXCLUDED.subject
                `, [lead.id, lead.company_id, body, subject]);

                // 4. Mark lead as drafted
                await pool.query('UPDATE leads SET is_auto_drafted = TRUE WHERE id = $1', [lead.id]);
                
                console.log(`✅ [Automator] Saved AI Draft for: ${lead.business_name}`);

                if (io) io.emit('draft_complete', { leadId: lead.id, businessName: lead.business_name });

            } catch (pErr) {
                console.error(`❌ [Automator] Drafting failed for lead ${lead.id}:`, pErr.message);
                await pool.query('UPDATE leads SET auto_draft_error = $1 WHERE id = $2', [pErr.message, lead.id]);
            }
        }
    } catch (err) {
        console.error('❌ [Automator] Auto-Drafter Error:', err.message);
    }
}

module.exports = { processDiscoveryQueue, autoDraftLeads, setIO };
