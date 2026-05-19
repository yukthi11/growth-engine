const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const pool = require('../config/db');
const { sendWhatsAppMessage, getConnectionStatus, isRegisteredUser } = require('../services/whatsappClient');
const { notifyCampaignComplete } = require('../services/replyHandler');
const { deleteMockup } = require('../lib/r2');

/**
 * Random Delay between 45 and 90 seconds
 */
const randomDelay = (min, max) => new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1) + min)));

// Force connection to avoid lazyConnect hanging in BullMQ
connection.connect().catch(() => { /* already connecting */ });

console.log('📡 [WhatsApp Worker] LISTENING — Waiting for outreach jobs...');

const whatsappWorker = new Worker('whatsapp-send-v2', async (job) => {
    const { lead_id, message_id, campaign_id, media_url } = job.data;
    console.log(`[WhatsApp Worker] Processing Job ${job.id} for lead ${lead_id}`);

    // Fetch lead and message with a 1s auto-retry for transient DB visibility issues
    let leadRes, msgRes;
    for (let attempts = 0; attempts < 3; attempts++) {
        leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [lead_id]);
        msgRes = await pool.query('SELECT * FROM messages WHERE id = $1', [message_id]);
        
        if (leadRes.rowCount > 0 && msgRes.rowCount > 0) break;
        console.warn(`[DIAGNOSTIC] Job ${job.id}: Postgres visibility lag. Retrying fetch in 1s...`);
        await new Promise(r => setTimeout(r, 1000));
    }

    if (leadRes.rowCount === 0 || msgRes.rowCount === 0) {
        console.error(`[DIAGNOSTIC] Job ${job.id}: Lead RowCount=${leadRes.rowCount}, Msg RowCount=${msgRes.rowCount}`);
        throw new Error(`Lead ${lead_id} or message ${message_id} not found`);
    }

    const lead = leadRes.rows[0];
    const message = msgRes.rows[0];

    // Safety checks
    if (lead.status === 'messaged') {
        console.warn(`[WhatsApp Worker] Skipping - lead ${lead_id} already messaged.`);
        return;
    }

    if (!lead.phone) {
        throw new Error(`Lead ${lead_id} has no phone number`);
    }

    // Daily Cap Enforcement (Redis)
    const DAILY_CAP = parseInt(process.env.WA_DAILY_CAP) || 75;
    const currentCount = await connection.get('wa_sends_today') || 0;
    
    if (parseInt(currentCount) >= DAILY_CAP) {
        console.warn(`[WhatsApp Worker] Daily limit (${DAILY_CAP}) reached. Job ${job.id} postponed.`);
        throw new Error('Daily limit reached');
    }

    // [CRITICAL] Safety check connection status and number registration
    const status = getConnectionStatus();
    if (!status.connected) {
        throw new Error('WhatsApp Disconnected: Your session is stale. Please refresh in dashboard.');
    }

    try {
        // TEST MODE Support: If in test mode, check the test phone number instead
        const IS_TEST = (process.env.TEST_MODE || '').trim().toLowerCase() === 'true';
        const targetPhone = IS_TEST ? (process.env.TEST_PHONE || lead.phone) : lead.phone;

        // [STABILITY FIX] Skip numbers that aren't on WhatsApp
        const registered = await isRegisteredUser(targetPhone);
        if (!registered) {
            console.log(`[WhatsApp Worker] ❌ Number ${targetPhone} is NOT on WhatsApp. Skipping.`);
            await pool.query("UPDATE leads SET status='rejected', rejection_reason='Not on WhatsApp' WHERE id=$1", [lead_id]);
            return;
        }

        let finalMediaUrl = media_url;
        
        // JIT Mockup Generation: ONLY for leads that do not have a website (presence pillar)
        if (!finalMediaUrl && lead.gap_pillar === 'presence') {
            console.log(`[WhatsApp Worker] JIT Mockup Generation triggered for lead ${lead.id} (no website)...`);
            try {
                const { generateMockup } = require('../services/mockupGenerator');
                const { uploadMockup } = require('../lib/r2');
                
                const buffer = await generateMockup({
                    id: lead.id,
                    business_name: lead.business_name,
                    category: lead.gap_vertical || 'generic',
                    location: lead.location_normalized || ''
                });
                
                if (buffer) {
                    finalMediaUrl = await uploadMockup(buffer, lead.id);
                    await pool.query('UPDATE leads SET mockup_url = $1 WHERE id = $2', [finalMediaUrl, lead.id]);
                    console.log(`[WhatsApp Worker] Successfully generated JIT mockup: ${finalMediaUrl}`);
                }
            } catch (mockupErr) {
                console.error(`[WhatsApp Worker] Failed to generate JIT mockup for lead ${lead.id}:`, mockupErr.message);
                // We proceed to send the text message even if mockup fails
            }
        }

        await sendWhatsAppMessage(lead.phone, message.content || message.message_text, finalMediaUrl);

        // Clean up R2 storage to save space after sending
        if (finalMediaUrl) {
            try {
                await deleteMockup(lead_id);
            } catch (cleanupErr) {
                console.warn(`[WhatsApp Worker] Failed to clean up mockup for lead ${lead_id}:`, cleanupErr.message);
            }
        }

        // Success updates
        await pool.query('UPDATE messages SET status=$1, sent_at=NOW() WHERE id=$2', ['sent', message_id]);
        await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['messaged', lead_id]);

        // Increment daily counter
        await connection.incr('wa_sends_today');

        // Check for campaign completion
        if (campaign_id) {
            const remaining = await pool.query(
                "SELECT COUNT(*) FROM leads WHERE campaign_id = $1 AND status = 'queued'",
                [campaign_id]
            );
            
            if (parseInt(remaining.rows[0].count) === 0) {
                notifyCampaignComplete(campaign_id);
            }
        }

        console.log(`[WhatsApp Worker] Successfully messaged lead ${lead_id}`);
    } catch (err) {
        console.error(`[WhatsApp Worker] Send failed:`, err.message);
        throw err; // Trigger BullMQ retry
    }
}, {
    connection,
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 30000 // Retry in 30 seconds if failed (warmup safety)
    }
});

// Diagnostic Listeners
whatsappWorker.on('completed', job => {
    console.log(`✅ [WhatsApp Worker] Job ${job.id} completed successfully.`);
});

whatsappWorker.on('failed', (job, err) => {
    console.error(`❌ [WhatsApp Worker] Job ${job?.id} FAILED:`, err.message);
});

whatsappWorker.on('error', err => {
    console.error('🔥 [WhatsApp Worker] CRITICAL ERROR:', err);
});

// Periodic Heartbeat to prove we are alive
setInterval(() => {
    console.log(`📡 [WhatsApp Worker] Heartbeat: ${new Date().toLocaleTimeString()} - Monitoring Queue...`);
}, 30000);

module.exports = whatsappWorker;
