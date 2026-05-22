const pool = require('../config/db');
const { classifyReply } = require('./replyClassifier');
const { sendWhatsAppMessage } = require('./whatsappClient');

let io = null;

/**
 * Normalizes phone number for lookup.
 * @param {string} phone 
 */
async function findLeadByPhone(phone) {
    // Remove all non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Attempt match with trailing suffix to handle country codes
    // e.g. if we have 9876543210 in DB, and incoming is 919876543210
    const query = `
        SELECT * FROM leads 
        WHERE phone LIKE $1 
        OR $2 LIKE '%' || phone 
        ORDER BY created_at DESC 
        LIMIT 1
    `;
    const result = await pool.query(query, [`%${cleanPhone}`, cleanPhone]);
    return result.rows[0];
}

/**
 * Handle incoming WhatsApp reply.
 * @param {string} phone 
 * @param {string} messageText 
 */
async function handleIncomingReply(phone, messageText) {
    console.log(`[Reply Handler] Processing reply from ${phone}: "${messageText.substring(0, 30)}..."`);
    
    const lead = await findLeadByPhone(phone);
    if (!lead) {
        console.warn(`[Reply Handler] Skip - No lead found for phone ${phone}`);
        return;
    }

    const { intent, sentiment } = await classifyReply(messageText);

    // 1. Store the reply and get the generated ID
    const insertRes = await pool.query(
        'INSERT INTO replies (lead_id, message, intent, sentiment) VALUES ($1, $2, $3, $4) RETURNING id',
        [lead.id, messageText, intent, sentiment]
    );
    const replyId = insertRes.rows[0].id;

    // 2. Update lead status directly to the intent so it reflects in the UI and Google Sheet!
    await pool.query("UPDATE leads SET status=$2 WHERE id=$1", [lead.id, intent]);

    if (intent === 'not_interested') {
        console.log(`[Reply Handler] Lead ${lead.id} is NOT INTERESTED. (Auto-reply skipped for safety)`);
        return;
    }

    // 4. Emit to dashboard via Socket.io for REAL-TIME updates
    if (io) {
        console.log(`[Reply Handler] Emitting new_reply for lead ${lead.id} (ID: ${replyId})`);
        
        const priority = (intent === 'pricing' || intent === 'interested') ? 'HIGH' : 'NORMAL';
        
        io.emit('new_reply', {
            id: replyId, // Unique ID for deduplication
            leadId: lead.id,
            businessName: lead.business_name,
            phone: lead.phone,
            emailAddress: lead.email_address,
            message: messageText,
            intent,
            sentiment,
            priority,
            channel: 'whatsapp',
            repliedAt: new Date().toISOString()
        });
    }
}

/**
 * Dependency injection for Socket.io
 * @param {object} ioInstance 
 */
function setIO(ioInstance) {
    io = ioInstance;
    console.log('[Reply Handler] Socket.io attached.');
}

/**
 * Notify frontend that a campaign has finished sending.
 */
function notifyCampaignComplete(campaignId) {
    if (io) {
        console.log(`[Socket] Broadcasting campaign_complete for ID: ${campaignId}`);
        io.emit('campaign_complete', { campaignId });
    }
}

module.exports = {
    handleIncomingReply,
    setIO,
    notifyCampaignComplete
};
