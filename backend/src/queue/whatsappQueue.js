const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

const whatsappQueue = new Queue('whatsapp-send', { connection });

async function addWhatsAppJob(jobData) {
    if (!jobData.lead_id || !jobData.message_id) {
        throw new Error('lead_id and message_id are required fields for a WhatsApp send job.');
    }

    return await whatsappQueue.add(`send-lead-${jobData.lead_id}`, jobData, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000 * 60 * 60 // 1 hour
        }
    });
}

module.exports = {
    whatsappQueue,
    addWhatsAppJob
};
