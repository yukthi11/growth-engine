const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

let classificationQueue = null;

const getQueue = () => {
    if (!classificationQueue) {
        classificationQueue = new Queue('classificationQueue', { connection });
    }
    return classificationQueue;
};

/**
 * Pushes a new classification job to the queue.
 * @param {object} data - Job data (leadId, business_name, website).
 */
const addClassificationJob = async (data) => {
    try {
        const queue = getQueue();
        await queue.add('classifyLead', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        });
        console.log(`Job added to classificationQueue: leadId ${data.leadId}`);
    } catch (error) {
        console.error('Failed to add job to classificationQueue:', error);
        throw error;
    }
};

module.exports = {
    addClassificationJob,
};
