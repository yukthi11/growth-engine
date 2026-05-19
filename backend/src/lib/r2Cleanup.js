const { ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { r2Client } = require('./r2');

async function cleanupOldMockups(maxAgeDays = 30) {
    try {
        const bucket = process.env.R2_BUCKET_NAME;
        if (!bucket) throw new Error('R2_BUCKET_NAME not set');

        let deleted = 0;
        let freedBytes = 0;
        let isTruncated = true;
        let continuationToken = undefined;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

        while (isTruncated) {
            const command = new ListObjectsV2Command({
                Bucket: bucket,
                ContinuationToken: continuationToken
            });
            const response = await r2Client.send(command);
            
            const toDelete = [];

            if (response.Contents) {
                for (const item of response.Contents) {
                    if (item.LastModified && new Date(item.LastModified) < cutoffDate) {
                        toDelete.push({ Key: item.Key });
                        freedBytes += item.Size || 0;
                    }
                }
            }
            
            // Delete in batches of 1000 (S3 limit)
            if (toDelete.length > 0) {
                // chunk by 1000
                for (let i = 0; i < toDelete.length; i += 1000) {
                    const chunk = toDelete.slice(i, i + 1000);
                    const deleteCommand = new DeleteObjectsCommand({
                        Bucket: bucket,
                        Delete: { Objects: chunk, Quiet: true }
                    });
                    await r2Client.send(deleteCommand);
                    deleted += chunk.length;
                }
            }

            isTruncated = response.IsTruncated;
            continuationToken = response.NextContinuationToken;
        }

        return { deleted, freedBytes };
    } catch (err) {
        console.error('[r2Cleanup] Failed to cleanup mockups:', err);
        throw err;
    }
}

module.exports = { cleanupOldMockups };
