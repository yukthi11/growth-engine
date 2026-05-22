const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const { sendEmail } = require('../services/emailService');
const pool = require('../config/db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

let failureReasonColumnReady = false;
async function ensureFailureReasonColumn() {
    if (failureReasonColumnReady) return;
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS failure_reason TEXT");
    failureReasonColumnReady = true;
}

/**
 * Helper to replace variables in message templates
 */
function parseTemplate(template, data) {
    let output = template;
    const variables = {
        business_name: data.business_name || 'there',
        contact_name: data.contact_name || 'friend',
        location: data.location_normalized || 'your area',
        mockup_url: data.mockup_url || ''
    };

    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        output = output.replace(regex, variables[key]);
    });

    return output;
}

const emailWorker = new Worker(
    'emailQueue',
    async (job) => {
        await ensureFailureReasonColumn();
        const { messageId, email, subject, message, leadData, companyEmail, smtpPassword, mediaUrl } = job.data;
        const isTestMode = (process.env.TEST_MODE || '').trim().toLowerCase() === 'true';
        
        if (isTestMode && !process.env.TEST_EMAIL) {
            throw new Error("SECURITY HALT: TEST_MODE is enabled but TEST_EMAIL is missing in .env. Outreach aborted to prevent real-time delivery.");
        }

        const targetEmail = isTestMode ? process.env.TEST_EMAIL : email;
        const personalizedSubject = parseTemplate(subject, leadData);
        const finalSubject = personalizedSubject; // Removed [TEST] prefix to avoid spam filters

        if (isTestMode) {
            console.log(`[Email][TEST MODE] Redirecting outreach to test target: ${targetEmail}`);
        }

        console.log(`[Email] Processing messageId: ${messageId} to ${targetEmail}`);

        let finalMediaUrl = mediaUrl;

        // JIT Mockup Generation: ONLY for leads that do not have a website (presence pillar)
        // We must check !leadData.mockup_url instead of !finalMediaUrl because finalMediaUrl might contain the company's fallback logo!
        const needsMockup = leadData && leadData.gap_pillar === 'presence' && !leadData.mockup_url;

        if (needsMockup) {
            console.log(`[Email Worker] JIT Mockup Generation triggered for lead ${leadData.id} (no website)...`);
            try {
                const { generateMockup } = require('../services/mockupGenerator');
                const { uploadMockup } = require('../lib/r2');
                
                const buffer = await generateMockup({
                    id: leadData.id,
                    business_name: leadData.business_name,
                    category: leadData.gap_vertical || 'generic',
                    location: leadData.location_normalized || ''
                });
                
                if (buffer) {
                    finalMediaUrl = await uploadMockup(buffer, leadData.id);
                    await pool.query('UPDATE leads SET mockup_url = $1 WHERE id = $2', [finalMediaUrl, leadData.id]);
                    leadData.mockup_url = finalMediaUrl; // Update in-memory for template parsing!
                    console.log(`[Email Worker] Successfully generated JIT mockup: ${finalMediaUrl}`);
                }
            } catch (mockupErr) {
                console.error(`[Email Worker] Failed to generate JIT mockup for lead ${leadData.id}:`, mockupErr.message);
                // Proceed with sending the email even if mockup generation fails
            }
        }

        // Resolve template variables in the media URL itself (in case they put {{mockup_url}} in the company settings)
        finalMediaUrl = finalMediaUrl ? parseTemplate(finalMediaUrl, { ...leadData, mockup_url: leadData.mockup_url || '' }) : null;
        
        // Clean it up if it evaluated to just empty string or undefined string
        if (finalMediaUrl && finalMediaUrl.trim() === '') {
            finalMediaUrl = null;
        }

        // IMPORTANT: When replacing {{mockup_url}} in the email text, we MUST ONLY use leadData.mockup_url.
        // We cannot use finalMediaUrl because finalMediaUrl might be the company's generic fallback logo!
        const personalizedMessage = parseTemplate(message, { ...leadData, mockup_url: leadData.mockup_url || '' });
        
        // Always build an HTML payload to ensure paragraph alignment is preserved!
        // Format text: replace single newlines with <br> to perfectly mimic plain-text double spacing
        let formattedText = personalizedMessage.trim().replace(/\n/g, '<br>');
        
        // Only inject the visual proof image if leadData.mockup_url actually exists and looks like a real URL
        if (leadData.mockup_url && leadData.mockup_url.startsWith('http')) {
            const imgTag = `<br><img src="${leadData.mockup_url}" alt="Visual Proof" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" /><br>`;
            
            // Only inject if the template actually explicitly requested the mockup_url
            if (formattedText.includes(leadData.mockup_url)) {
                formattedText = formattedText.replace(leadData.mockup_url, imgTag);
            }
        }

        // Wrap the entire email in a clean, left-aligned standard format
        htmlPayload = `
            <div style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0; text-align: left; line-height: 1.5; font-size: 14px;">
                ${formattedText}
            </div>
        `;

        // Allow fallback to .env configured email if company credentials are not provided
        if (!companyEmail && !process.env.EMAIL_FROM) {
            throw new Error("No company email credentials provided and no EMAIL_FROM fallback in .env.");
        }

        try {
            // 1. Send using the provider-aware service
            await sendEmail(
                targetEmail, 
                finalSubject, 
                personalizedMessage, 
                companyEmail, 
                smtpPassword,
                htmlPayload
            );

            // 2. Update DB
            await pool.query(
                "UPDATE messages SET status = 'sent', sent_at = NOW(), failure_reason = NULL WHERE id = $1",
                [messageId]
            );

            console.log(`[Email] Successfully delivered to ${targetEmail}`);

        } catch (error) {
            console.error(`[Email] Delivery failure for ${messageId}:`, error.message);
            
            await pool.query(
                "UPDATE messages SET status = 'failed', failure_reason = $2 WHERE id = $1",
                [messageId, error.message?.slice(0, 500) || 'Unknown email delivery failure']
            );

            throw error;
        }
    },
    { connection }
);

module.exports = emailWorker;
