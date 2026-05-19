const Imap = require('imap');
const { simpleParser } = require('mailparser');
const pool = require('../config/db');
const { analyzeReply } = require('../utils/sentimentAnalyzer');
require('dotenv').config();

let io = null;

function setIO(ioInstance) {
    io = ioInstance;
    console.log('[Email KillSwitch] Socket.io attached.');
}

const imapConfig = {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    host: process.env.IMAP_HOST,
    port: process.env.IMAP_PORT || 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
};

async function processEmailReply(emailAddress, body) {
    console.log(`[Email KillSwitch] New reply detected from ${emailAddress}`);

    try {
        // 1. Identify the lead
        const leadRes = await pool.query(
            "SELECT id, business_name, phone FROM leads WHERE email_address = $1 LIMIT 1",
            [emailAddress]
        );

        if (leadRes.rows.length === 0) return;
        const lead = leadRes.rows[0];

        // 2. Analyze Sentiment
        const analysis = await analyzeReply(body);
        console.log(`[AI Analysis] Lead ${lead.id} Email Category: ${analysis.category}`);

        // 3. Store the reply and get original DB ID
        const insertRes = await pool.query(
            "INSERT INTO replies (lead_id, message_text, channel, sentiment) VALUES ($1, $2, 'email', $3) RETURNING id",
            [lead.id, body.substring(0, 1000), analysis.category.toLowerCase()]
        );
        const replyId = insertRes.rows[0].id;

        // 4. Update Status
        if (analysis.category === 'STOP') {
            await pool.query("UPDATE leads SET is_blacklisted = TRUE, status = 'ignored' WHERE id = $1", [lead.id]);
            await pool.query("UPDATE lead_enrollments SET status = 'paused' WHERE lead_id = $1", [lead.id]);
            console.warn(`🛑 [BLACKLIST] Lead ${lead.id} unsubscribed via email.`);
        } else {
            // Mark as replied to stop the sequence sequenceWorker.js will check this status
            await pool.query(
                "UPDATE lead_enrollments SET status = 'replied' WHERE lead_id = $1 AND status = 'active'",
                [lead.id]
            );
            await pool.query("UPDATE leads SET status = 'replied' WHERE id = $1", [lead.id]);
        }

        // 5. Emit REAL-TIME update to Dashboard
        if (io) {
            console.log(`[Email KillSwitch] Emitting new_reply for lead ${lead.id} (ID: ${replyId})`);
            io.emit('new_reply', {
                id: replyId, // For deduplication
                leadId: lead.id,
                businessName: lead.business_name,
                email: emailAddress,
                phone: lead.phone,
                message: body,
                intent: analysis.category.toLowerCase(),
                priority: analysis.category === 'INTERESTED' ? 'HIGH' : 'NORMAL',
                channel: 'email',
                repliedAt: new Date().toISOString()
            });
        }

    } catch (err) {
        console.error('[Email KillSwitch] Error processing:', err.message);
    }
}

function startEmailMonitor() {
    // 0. Safety Checks: Only start if automation is on and credentials aren't placeholders
    if (process.env.ENABLE_AUTOMATION === 'false') {
        console.log('🔇 [Email KillSwitch] Automation is disabled. Skipping monitor.');
        return;
    }

    if (!process.env.IMAP_USER || process.env.IMAP_USER.includes('example.com')) {
        console.warn('⚠️ [Email KillSwitch] IMAP credentials not configured. Email replies will not be auto-paused.');
        console.info('👉 Set IMAP_USER and IMAP_PASSWORD in .env to enable this feature.');
        return;
    }

    const imap = new Imap(imapConfig);

    function openInbox(cb) {
        imap.openBox('INBOX', false, cb);
    }

    imap.once('ready', () => {
        openInbox((err, box) => {
            if (err) throw err;
            console.log('📬 [Email KillSwitch] Monitoring INBOX for replies...');

            imap.on('mail', (numNewMsgs) => {
                const nextMsg = box.messages.total + 1;
                console.log(`📬 [Email] ${numNewMsgs} new mail(s). Fetching from seqno ${nextMsg}`);
                
                const f = imap.seq.fetch(`${nextMsg}:*`, { bodies: '' });
                f.on('message', (msg, seqno) => {
                    // Update total as we process or just let it grow
                    box.messages.total = seqno;
                    msg.on('body', (stream, info) => {
                        simpleParser(stream, async (err, mail) => {
                            if (err) return;
                            const from = mail.from.value[0].address;
                            const body = mail.text || '';
                            await processEmailReply(from, body);
                        });
                    });
                });
            });
        });
    });

    imap.once('error', (err) => {
        console.error('[IMAP Error]', err.message);
        // Simple retry logic after 1 minute
        setTimeout(startEmailMonitor, 60000);
    });

    imap.once('end', () => {
        console.log('[IMAP Connection Ended]');
        setTimeout(startEmailMonitor, 10000);
    });

    imap.connect();
}

module.exports = { startEmailMonitor, setIO };
