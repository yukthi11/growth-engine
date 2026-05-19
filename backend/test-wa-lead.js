const axios = require('axios');

async function runTest() {
    const leadId = 1303;
    const API = 'http://127.0.0.1:5000';

    try {
        console.log(`[0/3] Preparing lead ${leadId} for testing...`);
        const pool = require('./src/config/db');
        await pool.query("UPDATE leads SET gap_pillar = 'presence', mockup_url = NULL WHERE id = $1", [leadId]);

        console.log(`\n[1/3] Generating visual mockup for lead ${leadId}...`);
        const mockRes = await axios.post(`${API}/leads/${leadId}/generate-mockup`);
        const mediaUrl = mockRes.data.mockup_url;
        console.log(`      ✓ Mockup ready: ${mediaUrl}`);

        console.log(`\n[2/3] Generating AI outreach pitch...`);
        const draftRes = await axios.post(`${API}/leads/${leadId}/preview-message`);
        const message = draftRes.data.message;
        console.log(`      ✓ Pitch generated: "${message}"`);

        console.log(`\n[3/3] Sending to WhatsApp (Will redirect to TEST_PHONE)...`);
        const sendRes = await axios.post(`${API}/replies/manual-reply/${leadId}`, {
            message: message,
            channel: 'whatsapp',
            mediaUrl: mediaUrl
        });

        console.log(`      ✓ Message dispatched successfully!`);
        console.log(`\nAll done. Check your WhatsApp (${process.env.TEST_PHONE || 'test number'}) and the backend terminal logs to see the cleanup in action.`);

    } catch (err) {
        console.error('\n[❌] Test Failed:');
        console.error(err.response ? err.response.data : err.message);
    }
}

runTest();
