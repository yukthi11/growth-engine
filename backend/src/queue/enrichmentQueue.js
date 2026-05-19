const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

let enrichmentQueue = null;

const getQueue = () => {
    if (!enrichmentQueue) {
        enrichmentQueue = new Queue('enrichmentQueue', { connection });
    }
    return enrichmentQueue;
};

/**
 * Pushes a new enrichment job to the queue.
 * @param {object} data - Job data (leadId, website).
 */
const addEnrichmentJob = async (data) => {
    try {
        const queue = getQueue();
        await queue.add('enrichLead', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 10000,
            },
        });
        console.log(`Job added to enrichmentQueue: leadId ${data.leadId}`);
    } catch (error) {
        console.error('Failed to add job to enrichmentQueue:', error);
        throw error;
    }
};

module.exports = {
    addEnrichmentJob,
};
