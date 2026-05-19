const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { generalPrompt } = require('../scrapers/llmExtractor');
const { resolveOutreachByPillar } = require('../ai/pillarMessages');

const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// MASTER TEMPLATE GENERATOR
// Generates company-level WhatsApp & Email templates ONCE via AI.
// These are stored on the companies table and used as a final fallback.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AI Master Template Generator
 * Drafts the core outreach communication ONCE per company profile.
 * Use placeholders like {{business_name}} for lead-specific injection.
 */
async function generateMasterTemplates(companyId) {
    try {
        const res = await pool.query('SELECT name, bio_summary, goal_summary FROM companies WHERE id = $1', [companyId]);
        if (res.rowCount === 0) return null;
        const { name, bio_summary, goal_summary } = res.rows[0];

        const waPrompt = `
      Create a warm, professional WhatsApp outreach template for a business growth agency.
      Company Name: ${name}
      What we do: ${bio_summary}
      Our Goal: ${goal_summary}
      
      Requirements:
      - Start with "Hi, I noticed {{business_name}}..."
      - Keep it under 250 characters.
      - Sound like a real person, not a bot.
      - Use {{business_name}} as a placeholder.
      - Return only the template text.
    `.trim();

        const emailPrompt = `
      Create a professional cold email template for: ${name}.
      Focused on: ${bio_summary}
      Targeting: small business owners.
      
      Return JSON format:
      {
        "subject": "Quick question about {{business_name}}",
        "body": "Hi there,\\n\\nI noticed {{business_name}} and... [rest of your pitch]\\n\\nRegards,\\nDevi"
      }
      Rules:
      - Use {{business_name}} placeholder.
      - Simple, plain English.
      - Short and punchy.
    `.trim();

        console.log(`[Message Engine] Generating Master Templates for Company ${companyId}...`);
        const [waTemplate, emailRaw] = await Promise.all([
            generalPrompt(waPrompt),
            generalPrompt(emailPrompt)
        ]);

        let emailTemplate = { subject: "Question about {{business_name}}", body: "" };
        try {
            const jsonMatch = emailRaw.match(/\{[\s\S]*\}/);
            emailTemplate = JSON.parse(jsonMatch ? jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, "") : emailRaw);
        } catch (e) {
            console.warn("[Message Engine] Email parse failed, trying fallback...");
            try {
                const fallbackMatch = emailRaw.match(/"subject":\s*"(.*?)",\s*"body":\s*"(.*?)"/s);
                if (fallbackMatch) emailTemplate = { subject: fallbackMatch[1], body: fallbackMatch[2] };
            } catch (innerE) {
                console.error("[Message Engine] Email template extraction completely failed", innerE);
            }
        }

        await pool.query(
            `UPDATE companies SET whatsapp_template = $1, email_subject_template = $2, email_body_template = $3 WHERE id = $4`,
            [waTemplate, emailTemplate.subject, emailTemplate.body, companyId]
        );

        return { waTemplate, emailTemplate };
    } catch (err) {
        console.error('[Message Engine] Master Template generation failed:', err.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE MESSAGE RESOLUTION
// Priority: Pillar-Structured Message → Company Master Template → Hard Default
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the WhatsApp outreach message for a lead.
 * Resolution order:
 *   1. Structured pillar message (based on lead's gap_pillar)
 *   2. Company-level master WhatsApp template
 *   3. Hard-coded default
 *
 * Signature is kept identical to the previous version — all callers are unaffected.
 *
 * @param {Object} lead    - Lead row from DB (must have business_name, gap_pillar)
 * @param {Object} company - Company row from DB (may have whatsapp_template)
 * @returns {{ message: string, business: string, intent: string, source: string }}
 */
async function generateFirstMessage(lead, company) {
    const businessName = lead.business_name || lead.businessName || 'your business';
    let location = lead.location_normalized || '';
    if (location.toLowerCase().includes('bengaluru') || location.toLowerCase().includes('bangalore')) {
        location = 'Bangalore';
    } else if (location.includes(',')) {
        location = location.split(',').pop().trim();
        location = location.charAt(0).toUpperCase() + location.slice(1);
    }
    const pillar = lead.gap_pillar || null;

    let message;
    let source;

    if (pillar) {
        // Priority 1: Structured pillar message
        const resolved = resolveOutreachByPillar(pillar, businessName, location);
        message = resolved.whatsapp;
        source = `pillar:${pillar}`;
    } else if (company?.whatsapp_template?.trim()) {
        // Priority 2: Company master template
        message = company.whatsapp_template.replace(/{{business_name}}/g, businessName);
        source = 'company_template';
    } else {
        // Priority 3: Hard default
        message = `Hi, I came across ${businessName} and think we can help you grow. Worth a quick chat?`;
        source = 'default';
    }

    console.log(`[Message Engine] WhatsApp message resolved via "${source}" for: ${businessName}`);

    return {
        message,
        business: company?.name || '',
        intent: lead.primary_intent || pillar || 'general',
        source
    };
}

/**
 * Resolves the Email outreach draft for a lead.
 * Resolution order:
 *   1. Structured pillar message (based on lead's gap_pillar)
 *   2. Company-level email templates
 *   3. Hard-coded default
 *
 * Signature is kept identical to the previous version — all callers are unaffected.
 *
 * @param {Object} lead    - Lead row from DB
 * @param {Object} company - Company row from DB
 * @returns {string} Formatted "Subject: ...\n\nBody..." string
 */
async function generateEmailDraft(lead, company) {
    const businessName = lead.business_name || lead.businessName || 'your business';
    let location = lead.location_normalized || '';
    if (location.toLowerCase().includes('bengaluru') || location.toLowerCase().includes('bangalore')) {
        location = 'Bangalore';
    } else if (location.includes(',')) {
        location = location.split(',').pop().trim();
        location = location.charAt(0).toUpperCase() + location.slice(1);
    }
    const pillar = lead.gap_pillar || null;

    let subject, body;

    if (pillar) {
        // Priority 1: Structured pillar message
        const resolved = resolveOutreachByPillar(pillar, businessName, location);
        subject = resolved.email.subject;
        body = resolved.email.body;
    } else {
        // Priority 2: Company templates
        subject = company?.email_subject_template || "Quick question about {{business_name}}";
        body = company?.email_body_template || `Hi there,\n\nI noticed {{business_name}} and wanted to connect.\n\nBest,`;
        subject = subject.replace(/{{business_name}}/g, businessName);
        body = body.replace(/{{business_name}}/g, businessName);
    }

    return `Subject: ${subject}\n\n${body}`;
}

module.exports = {
    generateMasterTemplates,
    generateFirstMessage,
    generateEmailDraft
};
