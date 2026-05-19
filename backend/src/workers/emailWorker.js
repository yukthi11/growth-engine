const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const { sendEmail } = require('../services/emailService');
const pool = require('../config/db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

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
        const { messageId, email, subject, message, leadData, companyEmail, smtpPassword, mediaUrl } = job.data;
        console.log(`[Email] Processing messageId: ${messageId} to ${email}`);

        const personalizedMessage = parseTemplate(message, leadData || {});
        
        let htmlPayload = null;
        if (mediaUrl) {
            // Format text: replace double newlines with paragraphs, single with breaks
            let formattedText = `<p style="margin: 0 0 16px 0;">${personalizedMessage.trim().replace(/\n\n/g, '</p><p style="margin: 0 0 16px 0;">').replace(/\n/g, '<br>')}</p>`;
            
            // Inline Image Replacement: If the raw URL is in the text, replace it with the image tag!
            const imgTag = `<br><img src="${mediaUrl}" alt="Visual Proof" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" /><br>`;
            
            if (formattedText.includes(mediaUrl)) {
                formattedText = formattedText.replace(mediaUrl, imgTag);
            } else {
                // Fallback if the URL wasn't explicitly in the text
                formattedText += `<div>${imgTag}</div>`;
            }

            // Left-aligned wrapper
            htmlPayload = `
                <div style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: 0; text-align: left; line-height: 1.5;">
                    ${formattedText}
                </div>
            `;
        }

        try {
            // 1. Send using the provider-aware service
            await sendEmail(
                email, 
                subject, 
                personalizedMessage, 
                companyEmail || process.env.SMTP_USER, 
                smtpPassword || process.env.SMTP_PASSWORD,
                htmlPayload
            );

            // 2. Update DB
            await pool.query(
                "UPDATE messages SET status = 'sent', sent_at = NOW() WHERE id = $1",
                [messageId]
            );

            console.log(`[Email] Successfully delivered to ${email}`);

        } catch (error) {
            console.error(`[Email] Delivery failure for ${messageId}:`, error.message);
            
            await pool.query(
                "UPDATE messages SET status = 'failed' WHERE id = $1",
                [messageId]
            );

            throw error;
        }
    },
    { connection }
);

module.exports = emailWorker;
