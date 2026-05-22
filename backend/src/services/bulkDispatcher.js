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
              -- AND l.status IN ('new', 'draft', 'queued') -- TEMPORARILY DISABLED FOR TESTING
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
                let emailSubject = 'New Message';

                // Fetch company info first so we can check if it's Growth Engine
                const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
                const company = companyRes.rows[0];
                const isGrowthEngine = company?.name?.trim().toLowerCase() === 'growth engine';

                if (isGrowthEngine) {
                    const { resolveOutreachByPillar } = require('../ai/pillarMessages');
                    // If gap_pillar is missing, we explicitly pass 'default' so it triggers the fallback message!
                    const resolved = resolveOutreachByPillar(lead.gap_pillar || 'default', lead.business_name, '');
                    
                    if (channel === 'whatsapp') {
                        content = resolved.whatsapp;
                        contentSource = `Pillar (WhatsApp): ${lead.gap_pillar || 'default'}`;
                    } else if (channel === 'email') {
                        content = resolved.email.body;
                        emailSubject = resolved.email.subject;
                        contentSource = `Pillar (Email): ${lead.gap_pillar || 'default'}`;
                    }
                } else if (channel === 'whatsapp') {
                    if (lead.outreach_draft && lead.outreach_draft.trim().length > 0) {
                        content = lead.outreach_draft;
                        contentSource = 'Individual Lead Draft';
                    } else if (company?.whatsapp_template && company.whatsapp_template.trim().length > 0) {
                        content = company.whatsapp_template.replace(/\{\{business_name\}\}/g, lead.business_name);
                        contentSource = 'Company Master Blueprint';
                    }
                } else if (channel === 'email') {
                    if (company?.email_body_template && company.email_body_template.trim().length > 0) {
                        content = company.email_body_template.replace(/\{\{business_name\}\}/g, lead.business_name);
                        emailSubject = company.email_subject_template || emailSubject;
                        contentSource = 'Company Email Blueprint';
                    } else if (lead.outreach_draft && lead.outreach_draft.trim().length > 0) {
                        content = lead.outreach_draft; 
                        contentSource = 'Individual Lead Draft Fallback';
                    }
                }

                // International Routing: Drop WhatsApp if not an Indian number
                const isIndianPhone = lead.phone && String(lead.phone).startsWith('+91');
                if (channel === 'whatsapp' && !isIndianPhone) {
                    console.log(`[Bulk Dispatch] Dropping lead ${lead.id} from WhatsApp queue because phone is not +91 (International)`);
                    continue; // Skip this lead entirely for WhatsApp
                }

                console.log(`[Bulk Dispatch DEBUG] Lead: ${lead.id}, Source: ${contentSource}, Match: ${lead.business_name}`);

                // Use mockup_url if it exists, regardless of pillar
                let finalMediaUrl = lead.mockup_url || null;

                if (channel === 'whatsapp') {
                    if (content) {
                        // For WhatsApp, we attach the image directly and use text as caption, so strip placeholder
                        content = content.replace(/\{\{mockup_url\}\}/g, '').trim();
                    }
                } else if (channel === 'email') {
                    // For Email, if we already have the URL, replace it. 
                    // IF we DON'T have the URL, we LEAVE {{mockup_url}} intact so emailWorker can JIT generate it!
                    if (content && finalMediaUrl) {
                        content = content.replace(/\{\{mockup_url\}\}/g, finalMediaUrl);
                    }
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
                        
                        let senderEmail = company.email;
                        let senderPassword = company.smtp_password;
                        
                        await emailQueue.add('send-email', {
                            messageId: messageRes.rows[0].id,
                            email: lead.email_address,
                            subject: emailSubject,
                            message: content,
                            leadData: lead,
                            companyEmail: senderEmail,
                            smtpPassword: senderPassword,
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
