const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { r2Client } = require('./r2');
const pool = require('../config/db');

async function getR2StorageStatus() {
    try {
        const bucket = process.env.R2_BUCKET_NAME;
        if (!bucket) throw new Error('R2_BUCKET_NAME not set');

        let totalBytes = 0;
        let isTruncated = true;
        let continuationToken = undefined;

        while (isTruncated) {
            const command = new ListObjectsV2Command({
                Bucket: bucket,
                ContinuationToken: continuationToken
            });
            const response = await r2Client.send(command);
            
            if (response.Contents) {
                for (const item of response.Contents) {
                    totalBytes += item.Size || 0;
                }
            }
            
            isTruncated = response.IsTruncated;
            continuationToken = response.NextContinuationToken;
        }

        const usedGB = totalBytes / (1024 * 1024 * 1024);
        const freeLimitGB = 10;
        const pctUsed = (usedGB / freeLimitGB) * 100;

        let status = 'ok';
        if (pctUsed >= 95) status = 'critical';
        else if (pctUsed >= 80) status = 'warn';

        // Query DB for mockups created in the last 7 days
        const recentMockupsRes = await pool.query(`
            SELECT COUNT(*) 
            FROM leads 
            WHERE mockup_url IS NOT NULL 
              AND updated_at > NOW() - INTERVAL '7 days'
        `);
        const recentCount = parseInt(recentMockupsRes.rows[0].count) || 0;
        
        // Assume avg mockup size is ~70KB (71680 bytes)
        const avgDailyBytes = (recentCount * 71680) / 7;

        let daysEstimate = 999;
        if (avgDailyBytes > 0) {
            const remainingBytes = (freeLimitGB * 1024 * 1024 * 1024) - totalBytes;
            daysEstimate = Math.max(0, Math.floor(remainingBytes / avgDailyBytes));
            if (daysEstimate > 999) daysEstimate = 999;
        }

        return {
            usedBytes: totalBytes,
            usedGB: parseFloat(usedGB.toFixed(2)),
            freeLimitGB,
            pctUsed: parseFloat(pctUsed.toFixed(1)),
            status,
            daysEstimate
        };
    } catch (err) {
        console.error('[r2Monitor] Failed to get storage status:', err);
        return {
            usedBytes: 0,
            usedGB: 0,
            freeLimitGB: 10,
            pctUsed: 0,
            status: 'ok',
            daysEstimate: 999
        };
    }
}

module.exports = { getR2StorageStatus };
