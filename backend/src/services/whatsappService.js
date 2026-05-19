const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const pool = require('../config/db');
const { analyzeReply } = require('../utils/sentimentAnalyzer');
const path = require('path');
const fs = require('fs');

let sock = null;
let isConnected = false;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'warn' }),
        browser: ['Windows', 'Chrome', '120.0.0'], // Mimic a real browser to bypass 405 blocks
        syncFullHistory: false
    });

    // Handle QR manually to silence deprecation warning
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            const qrcode = require('qrcode-terminal');
            console.log('[WhatsApp] 🔐 New QR Code generated. Scan to authenticate:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`[WhatsApp] Connection closed (Status: ${statusCode}). Reconnecting: ${shouldReconnect}`);

            if (shouldReconnect) {
                isConnected = false;
                // Add a small delay to avoid rapid-fire log spam
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connection opened');
            isConnected = true;
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            if (msg.key.fromMe || !msg.message) continue;

            const fromJid = msg.key.remoteJid;
            const phoneNumber = fromJid.split('@')[0];
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            if (!text) continue;

            console.log(`[WhatsApp] New message from ${phoneNumber}: ${text}`);

            try {
                // 1. Identify the lead in DB
                // We search for phone numbers containing this digits sequence
                const leadRes = await pool.query(
                    "SELECT id, business_name FROM leads WHERE phone LIKE $1 LIMIT 1",
                    [`%${phoneNumber}%`]
                );

                if (leadRes.rows.length === 0) continue;

                const lead = leadRes.rows[0];

                // 2. Analyze Sentiment
                const analysis = await analyzeReply(text);
                console.log(`[AI Analysis] Lead ${lead.id} (${lead.business_name}) Category: ${analysis.category}`);

                // 3. Log the reply
                await pool.query(
                    "INSERT INTO replies (lead_id, message_text, channel, sentiment) VALUES ($1, $2, 'whatsapp', $3)",
                    [lead.id, text, analysis.category.toLowerCase()]
                );

                // 4. Handle based on Category
                if (analysis.category === 'STOP') {
                    // Safety Stop - Blacklist
                    await pool.query("UPDATE leads SET is_blacklisted = TRUE WHERE id = $1", [lead.id]);
                    await pool.query("UPDATE lead_enrollments SET status = 'paused' WHERE lead_id = $1", [lead.id]);
                } else {
                    // Mark as replied and stop further automation for now
                    await pool.query(
                        "UPDATE lead_enrollments SET status = 'replied' WHERE lead_id = $1 AND status = 'active'",
                        [lead.id]
                    );
                }

                if (analysis.category === 'INTERESTED') {
                    console.info(`🎯 [HOT LEAD] ${lead.business_name} responded with interest: "${text}"`);
                    // Slack hook could go here
                }

            } catch (err) {
                console.error('[WhatsApp Hook] Error processing reply:', err.message);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    return sock;
}

// Initial connection - SWITCHED TO BROWSER-MODE (whatsappClient.js)
// connectToWhatsApp();

module.exports = {
    getSocket: () => sock,
    isReady: () => isConnected,
    sendMessage: async (jid, text) => {
        if (!sock || !isConnected) throw new Error('WhatsApp client not ready');
        const formattedJid = jid.includes('@s.whatsapp.net') ? jid : `${jid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        return sock.sendMessage(formattedJid, { text });
    }
};
