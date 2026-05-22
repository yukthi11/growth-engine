const { Queue } = require('bullmq');
const { connection } = require('./src/config/redis');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runTest() {
    console.log("🚀 Pushing test email to the queue...");
    
    const emailQueue = new Queue('emailQueue', { connection });
    
    // Fake lead data simulating an international lead with NO website
    const leadData = {
        id: 99999,
        business_name: 'Test Cafe Phuket',
        location_normalized: 'Phuket, Thailand',
        gap_pillar: 'presence',
        mockup_url: null, // Forces JIT Mockup Generation!
        phone: '+66 123456789' // International number
    };

    // The exact pillar message for 'presence'
    const message = `I came across {{business_name}} on Google and wanted to reach out.

I noticed you don't have a website yet. Most customers in {{location}} search online before deciding where to go. Without one, they're finding your competitors instead of you.

I help local businesses get online quickly with a clean, professional website that brings in enquiries. I went ahead and built a quick preview of what a modern site for your business could look like:
{{mockup_url}}

Could you point me to the right person to have a quick conversation about this?

Thanks & Regards,
Yukthi
+91 9108641490
<a href="https://reviveyourbusiness.in/" target="_blank">Website</a>`;

    await emailQueue.add('send-email', {
        messageId: 99999, // Fake message ID
        email: 'yukthirevive@gmail.com', // Send TO this email
        subject: `Quick note about {{business_name}}`,
        message: message,
        leadData: leadData,
        companyEmail: 'info@reviveyourbusiness.in', // Send FROM this email
        smtpPassword: process.env.SMTP_PASSWORD, // Google Workspace App Password
        mediaUrl: null // Force JIT Mockup
    });

    console.log("✅ Test email successfully queued!");
    console.log("👉 Check your backend terminal (run.ps1) to watch the worker generate the mockup and send the email!");
    process.exit(0);
}

runTest().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
