const { enrichmentWorker } = require('./workers/enrichmentWorker');
const emailWorker = require('./workers/emailWorker');
const { classificationWorker } = require('./workers/classificationWorker');
const sequenceWorker = require('./workers/sequenceWorker');

console.log('--- Growth Engine Workers Process ---');
console.log('Enrichment Worker: Active');
console.log('Email Worker: Active');
console.log('Classification Worker: Active');
console.log('Sequence Worker: Active');
console.log('WhatsApp Worker: [Moved to Master Server]');
console.log('------------------------------------');

// The workers start automatically upon import as they use the Worker constructor
// from BullMQ which connects and starts listening immediately.

process.on('SIGTERM', async () => {
    console.log('Shutting down workers...');
    await enrichmentWorker.close();
    await emailWorker.close();
    await classificationWorker.close();
    await sequenceWorker.close();
    process.exit(0);
});
