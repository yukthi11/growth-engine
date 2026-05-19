const express = require('express');
const router = express.Router();
const { getR2StorageStatus } = require('../lib/r2Monitor');
const { cleanupOldMockups } = require('../lib/r2Cleanup');

// GET /api/r2/status
router.get('/status', async (req, res) => {
    try {
        const status = await getR2StorageStatus();
        res.json(status);
    } catch (err) {
        console.error('Error fetching R2 status:', err);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// POST /api/r2/cleanup
router.post('/cleanup', async (req, res) => {
    try {
        const maxAgeDays = req.body.maxAgeDays ? parseInt(req.body.maxAgeDays) : 30;
        const result = await cleanupOldMockups(maxAgeDays);
        
        // Fetch new status after cleanup
        const newStatus = await getR2StorageStatus();
        
        res.json({
            deleted: result.deleted,
            freedBytes: result.freedBytes,
            newUsageGB: newStatus.usedGB
        });
    } catch (err) {
        console.error('Error running R2 cleanup:', err);
        res.status(500).json({ error: 'Failed to run cleanup' });
    }
});

module.exports = router;
