const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

let emailQueue = null;

const getQueue = () => {
    if (!emailQueue) {
        emailQueue = new Queue('emailQueue', { connection });
    }
    return emailQueue;
};

/**
 * Pushes a new email job to the queue.
 * @param {object} data - Job data (messageId, leadId, email, subject, message).
 */
const addEmailJob = async (data) => {
    try {
        const queue = getQueue();
        await queue.add('sendEmail', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        });
        console.log(`Job added to emailQueue: messageId ${data.messageId}`);
    } catch (error) {
        console.error('Failed to add job to emailQueue:', error);
        throw error;
    }
};

module.exports = {
    addEmailJob,
};
