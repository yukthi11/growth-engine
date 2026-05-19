const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const { chromium } = require('playwright');
const pool = require('../config/db');
const { addClassificationJob } = require('../queue/classificationQueue');
const leadScorer = require('../services/leadScorer');
const { generateFirstMessage } = require('../services/messageGenerator');
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;

/**
 * Extracts unique emails from HTML content.
 * @param {string} html 
 * @returns {string[]} Unique emails
 */
function extractEmails(html) {
    if (!html) return [];
    const matches = html.match(EMAIL_REGEX);
    if (!matches) return [];

    // Filter out common false positives and duplicates
    return [...new Set(matches.map(e => e.toLowerCase()))].filter(email => {
        const forbidden = ['.png', '.jpg', '.jpeg', '.gif', '.svg', 'sentry.io', 'example.com', 'wixpress.com'];
        return !forbidden.some(f => email.endsWith(f)) && !email.includes('test');
    });
}

/**
 * Scans a website using Playwright to find email addresses.
 * @param {string} baseUrl 
 * @returns {Promise<string|null>} Discovered email
 */
async function findEmailWithPlaywright(baseUrl) {
    let url = baseUrl.trim();
    if (!url.startsWith('http')) url = `https://${url}`;

    console.log(`[Enrichment] Visiting: ${url}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // 1. Visit Homepage
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const homepageContent = await page.content();
        let emails = extractEmails(homepageContent);

        if (emails.length > 0) {
            await browser.close();
            return emails[0];
        }

        // 2. Look for Contact/About links
        const contactLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
                .map(a => ({ text: a.innerText.toLowerCase(), href: a.href }))
                .filter(a => {
                    const keywords = ['contact', 'about', 'reach', 'support', 'info'];
                    return keywords.some(k => a.text.includes(k) || a.href.toLowerCase().includes(k));
                })
                .map(a => a.href);
        });

        // Unique links only, limit to 3 to avoid infinite loops or massive crawls
        const uniqueLinks = [...new Set(contactLinks)].slice(0, 3);

        for (const link of uniqueLinks) {
            try {
                console.log(`[Enrichment] Checking subpage: ${link}`);
                await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                const content = await page.content();
                emails = extractEmails(content);
                if (emails.length > 0) {
                    await browser.close();
                    return emails[0];
                }
            } catch (e) {
                console.log(`[Enrichment] Failed to visit subpage ${link}: ${e.message}`);
            }
        }

        await browser.close();
        return null;
    } catch (error) {
        console.error(`[Enrichment] Error during Playwright scan for ${url}:`, error.message);
        await browser.close();
        return null;
    }
}

/**
 * Worker to process enrichment jobs.
 */
const enrichmentWorker = new Worker(
    'enrichmentQueue',
    async (job) => {
        const { leadId, website, businessName } = job.data;
        console.log(`[Enrichment] Processing lead: ${businessName} (${website})`);

        if (!website) {
            console.log(`[Enrichment] No website for lead ${leadId}, skipping.`);
            return;
        }

        try {
            const email = await findEmailWithPlaywright(website);

            if (email) {
                await pool.query('UPDATE leads SET email_address = $1 WHERE id = $2', [email, leadId]);
                console.log(`[Enrichment] SUCCESS: Found ${email} for ${businessName}`);

                // RE-SCORE after enrichment
                const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
                const lead = leadRes.rows[0];
                const scores = leadScorer.scoreLeadIntent(lead);

                await pool.query(`
                    UPDATE leads 
                    SET 
                        visibility_score = $1,
                        footfall_score = $2,
                        partnership_score = $3,
                        primary_intent = $4
                    WHERE id = $5
                `, [scores.visibility_score, scores.footfall_score, scores.partnership_score, scores.primary_intent, leadId]);

                // GENERATE MESSAGE (Phase 2)
                try {
                    const finalLeadData = leadResFinal.rows[0];
                    const preview = await generateFirstMessage(finalLeadData);
                    
                    // Dynamic Channel Routing: Fallback to email if no phone number exists
                    const preferredChannel = finalLeadData.phone ? 'whatsapp' : (finalLeadData.email_address ? 'email' : 'whatsapp');
                    
                    await pool.query(`
                        INSERT INTO messages (lead_id, message_type, content, status, channel, message_text)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT DO NOTHING;
                    `, [leadId, 'first_outreach', preview.message, 'pending', preferredChannel, preview.message]);
                    
                    console.log(`[Enrichment] SUCCESS: Lead "${businessName}" scored and message generated.`);
                } catch (msgErr) {
                    console.warn(`[Enrichment Warning]: Failed to generate auto-outreach:`, msgErr.message);
                }

                // Trigger classification immediately
                await addClassificationJob({ leadId, business_name: businessName, website });
            } else {
                console.log(`[Enrichment] No email found for ${businessName}`);
            }
        } catch (error) {
            console.error(`[Enrichment] Job ${job.id} failed:`, error);
            throw error;
        }
    },
    {
        connection,
        concurrency: 2 // Run 2 enrichment tasks in parallel
    }
);

enrichmentWorker.on('completed', (job) => {
    console.log(`[Enrichment] Job ${job.id} completed.`);
});

enrichmentWorker.on('failed', (job, err) => {
    console.error(`[Enrichment] Job ${job.id} failed with ${err.message}`);
});

/**
 * Function to find leads missing email and add them to the queue.
 */
async function triggerEnrichmentBatch(limit = 20) {
    console.log(`[Enrichment] Triggering batch enrichment for up to ${limit} leads...`);
    const { addEnrichmentJob } = require('../queue/enrichmentQueue');

    try {
        const res = await pool.query(`
            SELECT id, business_name as "businessName", website 
            FROM leads 
            WHERE website IS NOT NULL 
            AND email_address IS NULL 
            ORDER BY created_at DESC
            LIMIT $1;
        `, [limit]);

        for (const lead of res.rows) {
            await addEnrichmentJob({
                leadId: lead.id,
                website: lead.website,
                businessName: lead.businessName
            });
        }
        console.log(`[Enrichment] Added ${res.rows.length} jobs to enrichmentQueue.`);
    } catch (error) {
        console.error(`[Enrichment] Error triggering batch:`, error);
    }
}

console.log('Enrichment worker is running and listening for jobs...');

module.exports = {
    enrichmentWorker,
    triggerEnrichmentBatch
};
