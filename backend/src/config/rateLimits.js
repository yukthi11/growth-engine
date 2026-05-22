// Rate limiting configuration for outreach workers
// This ensures DRY principles across email and WhatsApp channels.
module.exports = {
    outreachLimiter: {
        max: 1,
        duration: 60000 // 1 message every 60 seconds (1 minute)
    }
};
