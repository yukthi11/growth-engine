const pool = require('../config/db');
const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

const whatsappQueue = new Queue('whatsapp-send-v2', { connection });

async function bulkDispatch(campaignId, channel, companyId) {
    console.log(`--- ENGINE RESTART: DISPATCH V3 ACTIVE (Campaign ${campaignId}) ---`);
    
    try {
        // 1. Get all leads in this campaign that are in valid starting statuses
        const isEmail = channel === 'email';
        const leadQuery = `
            SELECT l.id, l.phone, l.email_address, l.business_name, c.whatsapp_template, l.outreach_draft, l.mockup_url, l.gap_pillar
            FROM leads l
            JOIN companies c ON l.company_id = c.id
            WHERE l.campaign_id = $1 
              AND l.status IN ('new', 'draft', 'queued')
              ${isEmail ? 'AND l.email_address IS NOT NULL' : 'AND l.phone IS NOT NULL'}
        `;
        
        const leadsResult = await pool.query(leadQuery, [campaignId]);
        const leads = leadsResult.rows;
        
        console.log(`[Bulk Dispatch] Found ${leads.length} leads to queue.`);

        for (const lead of leads) {
            try {
                // Determine the content - use AI draft if available, else template, else a smart default
                // AGGRESSIVE FIX: Always prefer the manual blueprint (whatsapp_template) if it exists.
                // This ensures "Testing I'm a bot" is used instead of stale lead-level drafts.
                let contentSource = 'Default';
                let content = '';

                if (lead.whatsapp_template && lead.whatsapp_template.trim().length > 0) {
                    content = lead.whatsapp_template.replace(/\{\{business_name\}\}/g, lead.business_name);
                    contentSource = 'Company Master Blueprint';
                } else if (lead.outreach_draft) {
                    content = lead.outreach_draft;
                    contentSource = 'Individual Lead Draft';
                }

                console.log(`[Bulk Dispatch DEBUG] Lead: ${lead.id}, Source: ${contentSource}, Match: ${lead.business_name}`);

                // REPLACE mockup_url ONLY if it is a 'presence' pillar (no website)
                let finalMediaUrl = (lead.gap_pillar === 'presence') ? lead.mockup_url : null;

                if (channel === 'whatsapp' && content) {
                    // For WhatsApp, we attach the image directly and use text as caption
                    content = content.replace(/\{\{mockup_url\}\}/g, '').trim();
                } else if (content && finalMediaUrl) {
                    content = content.replace(/\{\{mockup_url\}\}/g, finalMediaUrl);
                } else if (content) {
                    content = content.replace(/\{\{mockup_url\}\}/g, ''); // strip it if null
                }

                console.log(`[Bulk Dispatch DEBUG] Final Content: "${content?.substring(0, 50)}..."`);

                // 2. Create the message record first
                const messageRes = await pool.query(`
                    INSERT INTO messages (lead_id, message_type, content, status, channel, message_text)
                    VALUES ($1, 'first_outreach', $2, 'pending', $3, $2)
                    RETURNING id;
                `, [lead.id, content, channel]); // Dynamically insert channel
                
                // 3. Add to the correct queue
                if (channel === 'email') {
                    // Pull company for email settings
                    const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
                    const company = companyRes.rows[0];
                    if (company && lead.email_address) {
                        const { Queue } = require('bullmq');
                        const { connection } = require('../config/redis');
                        const emailQueue = new Queue('emailQueue', { connection });
                        await emailQueue.add('send-email', {
                            messageId: messageRes.rows[0].id,
                            email: lead.email_address,
                            subject: company.email_subject_template || 'New Message',
                            message: company.email_body_template || content,
                            leadData: lead,
                            companyEmail: company.email_sender,
                            smtpPassword: company.smtp_password,
                            mediaUrl: finalMediaUrl || company.email_media_url
                        }, { attempts: 3, backoff: { type: 'exponential', delay: 30000 } });
                    }
                } else {
                    await whatsappQueue.add('send-message', {
                        message_id: messageRes.rows[0].id,
                        lead_id: lead.id,
                        campaign_id: campaignId,
                        content,
                        media_url: finalMediaUrl
                    }, {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 30000 }
                    });
                }

                // 4. Update lead status to avoid double-queueing
                await pool.query("UPDATE leads SET status = 'queued' WHERE id = $1", [lead.id]);

            } catch (err) {
                console.error(`❌ [Bulk Dispatch] Failed to queue lead ${lead.id}:`, err.message);
            }
        }
        
        console.log(`🏁 [Bulk Dispatch] Successfully enqueued ${leads.length} tasks.`);
    } catch (err) {
        console.error('❌ [Bulk Dispatch] Fatal error:', err.message);
    }
}

module.exports = { bulkDispatch };
