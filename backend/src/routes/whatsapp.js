const express = require('express');
const router = express.Router();
const { getConnectionStatus } = require('../services/whatsappClient');
const { connection } = require('../config/redis');

/**
 * GET /status
 * Returns { connected: bool, qr: string|null, dailySends: n }
 */
router.get('/status', async (req, res) => {
    try {
        const status = getConnectionStatus();
        const dailySends = await connection.get('wa_sends_today') || 0;

        res.json({
            ...status,
            dailySends: parseInt(dailySends)
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch WhatsApp status' });
    }
});

const { initWhatsApp } = require('../services/whatsappClient');

/**
 * POST /refresh
 * Forces a re-initialization of the WhatsApp client.
 */
router.post('/refresh', async (req, res) => {
    try {
        await initWhatsApp();
        res.json({ message: 'Init re-triggered successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Fresh init failed.' });
    }
});

module.exports = router;
