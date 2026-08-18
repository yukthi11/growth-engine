const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generalPrompt } = require('../scrapers/llmExtractor');
const { recommendServices, formatPricingSummary, formatTotals, computeLineItemTotals, applyMilestoneSplit, DEFAULT_MILESTONE_SPLIT } = require('../utils/serviceMatcher');

// Scoped to this route only (doesn't touch GROQ_MODEL used elsewhere, e.g. outreach
// drafting). The shared default (qwen/qwen3.6-27b) is a reasoning model whose hidden
// <think> tokens reliably blow past Groq's token budget on this route's large JSON
// schema before ever emitting the answer — openai/gpt-oss-20b answers this schema
// directly, in ~2-3s instead of failing after ~90s of retries/fallback.
const PROPOSAL_LLM_MODEL = process.env.PROPOSAL_LLM_MODEL || 'openai/gpt-oss-20b';
const PROPOSAL_LLM_MAX_TOKENS = 4000;
const proposalLLM = (prompt) => generalPrompt(prompt, { model: PROPOSAL_LLM_MODEL, maxTokens: PROPOSAL_LLM_MAX_TOKENS });

/**
 * Helper to clean up JSON responses from LLM (in case of markdown blocks).
 */
function parseLLMJson(text) {
    try {
        let cleaned = text.trim();
        // Remove markdown formatting if present
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
        return JSON.parse(cleaned);
    } catch (err) {
        console.error('Failed to parse LLM JSON:', err.message, '\nRaw Text:', text);
        throw new Error('LLM did not return valid JSON: ' + err.message);
    }
}

/**
 * 1. GET /proposals/autofill/:leadId
 * Pre-fills the proposal generator form using lead gaps & company services context.
 */
router.get('/autofill/:leadId', async (req, res) => {
    const { leadId } = req.params;
    try {
        // Fetch Lead details
        const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
        if (leadRes.rowCount === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        const lead = leadRes.rows[0];

        // Fetch Company details (the active service provider workspace)
        const companyRes = await pool.query('SELECT * FROM companies WHERE id = $1', [lead.company_id]);
        if (companyRes.rowCount === 0) {
            return res.status(404).json({ error: 'Workspace Company not found' });
        }
        const company = companyRes.rows[0];

        // Deterministic gap -> service catalog matching (no LLM, no invented prices).
        // Base prices are whatever's currently in the `services` table, so admin
        // edits via PATCH /services/:id are reflected immediately.
        const servicesRes = await pool.query('SELECT * FROM services WHERE is_active = TRUE ORDER BY category, sort_order');
        const recommended = recommendServices(lead, servicesRes.rows);
        const pricing = formatPricingSummary(recommended);
        const recommendedServiceNames = recommended.map((s) => s.name);

        // Construct analysis prompt — narrative fields only. Service selection and
        // pricing are decided above, deterministically, so the LLM can't drift
        // from the catalog or invent numbers.
        const prompt = `
You are a senior business solution consultant for ${company.name}.
Analyze this prospective lead and our workspace company, then generate recommended project brief details to pre-populate a business proposal form.

Prospective Lead:
- Business Name: ${lead.business_name}
- Website: ${lead.website || 'None'}
- Location: ${lead.location_normalized || 'Unknown'}
- Detected Gaps / Fit Pitch: ${lead.gap_pitch || 'No pitch details available'}
- Dominant Gap Pillar: ${lead.gap_pillar || 'Unknown'}
- Lead Fit Services: ${Array.isArray(lead.service_fit) ? lead.service_fit.join(', ') : (lead.service_fit || 'Unknown')}

Our Company Offerings & Growth Goals:
- Overview: ${company.overview || ''}
- Growth Directives: ${company.goal || ''}

Services Already Selected For This Lead (matched deterministically from detected gaps — ground your narrative in these, do not suggest others): ${recommendedServiceNames.length > 0 ? recommendedServiceNames.join(', ') : 'None matched — write generically about growth/automation needs'}

Based on this context, suggest the following details to pre-fill a business proposal.
Focus on outcomes, business value, removing operational stress, and automation efficiency.
DO NOT mention programming languages, APIs, or technical implementation details.

You must return a valid JSON object ONLY. Do not write any markdown wrappers or introductory text. The output must parse as JSON matching this schema:
{
  "project_name": "A short, professional project title, e.g. '${lead.business_name} Booking Automation' or '${lead.business_name} Growth System'",
  "industry": "Specific industry vertical, e.g. 'Fitness & Wellness' or 'Retail & Commerce'",
  "contact_person": "Contact person name (use '${lead.contact_name || ''}' if provided, otherwise default to 'Business Owner')",
  "problem": "Concise overview of the lead's specific operational problem, inefficiencies, and pain points based on their gaps.",
  "current_process": "Description of their current inefficient process (e.g. manual booking, no confirmation alerts, low visibility).",
  "desired_outcome": "Outcome-focused description of the future state (e.g. automated schedules, zero no-shows, live dashboard visibility).",
  "timeline": "e.g. '3 Weeks' or '4 Weeks'",
  "milestones": "Milestone payments, e.g. '50% Upfront, 50% on complete delivery'"
}
        `.trim();

        console.log(`[Proposal Writer] Autofilling details for Lead ID ${leadId} (${lead.business_name})...`);
        const responseText = await proposalLLM(prompt);
        const parsedData = parseLLMJson(responseText);

        res.json({
            ...parsedData,
            selected_services: recommendedServiceNames,
            recommended_services: recommended,
            pricing,
        });
    } catch (err) {
        console.error('Error in proposal autofill:', err.message);
        res.status(500).json({ error: 'Failed to generate proposal autofill: ' + err.message });
    }
});

/**
 * 2. POST /proposals/generate
 * Generates a structured consulting proposal based on user inputs.
 */
router.post('/generate', async (req, res) => {
    const {
        business_name,
        industry,
        contact_person,
        project_name,
        problem,
        current_process,
        desired_outcome,
        selected_services,
        notes,
        timeline,
        pricing,
        milestones,
        line_items,       // optional: [{ name, unit_price, monthly_price, quantity }] — enables deterministic pricing below
        milestone_split    // optional: [{ label, percentage }] — defaults to 50/50 when line_items is used
    } = req.body;

    if (!business_name || !project_name) {
        return res.status(400).json({ error: 'Business Name and Project Name are required.' });
    }

    // Deterministic pricing path: when the caller sends structured line items
    // (the Proposal Writer's catalog picker), the total and milestone amounts
    // are computed here — the LLM never touches numbers, only wording. Callers
    // that still send free-text `pricing`/`milestones` (legacy) are unaffected.
    const hasLineItems = Array.isArray(line_items) && line_items.length > 0;
    let finalPricing = pricing;
    let precomputedInvestment = null;

    if (hasLineItems) {
        const totals = computeLineItemTotals(line_items);
        finalPricing = formatTotals(totals.oneTime, totals.monthly);
        const splits = Array.isArray(milestone_split) && milestone_split.length > 0 ? milestone_split : DEFAULT_MILESTONE_SPLIT;
        precomputedInvestment = applyMilestoneSplit(totals.oneTime, splits);
    }

    const investmentSchema = hasLineItems
        ? `"investment": [
    {
      "milestone_name": "Milestone name for split #N (there are exactly ${precomputedInvestment.length} splits, in order), e.g. 'Project Initiation & Configuration' or 'Complete Delivery & Handoff'",
      "project_scope": "What is covered in this milestone, drawn from the selected services"
    }
  ],`
        : `"investment": [
    {
      "milestone_name": "Milestone name, e.g. 'Project Initiation & Configuration' or 'Complete Delivery & Handoff'",
      "project_scope": "What is covered in this milestone",
      "amount": "The amount or percentage, e.g. '50%' or pricing equivalent"
    }
  ],`;

    try {
        const prompt = `
You are an expert solution consultant and proposal writer for Revive Technology.
Your job is to generate a professional, concise, visually structured business proposal for a small or medium-sized business.

The proposal should NOT sound like an agency selling services.
The proposal should sound like a business consultant presenting a custom solution to a specific operational or growth problem.

Strict Proposal Writing Rules:
1. Focus on the business problem first.
2. Focus on outcomes, not technology.
3. Avoid technical jargon unless necessary.
4. Keep the proposal concise.
5. Use simple language that business owners understand.
6. Emphasize time savings, efficiency, revenue growth, accountability, automation, visibility, reporting, and operational improvements.
7. Do not mention programming languages, frameworks, databases, APIs, or technical implementation details.
8. Present the solution as something that removes stress, saves time, and improves operations.
9. Use confident but realistic language.
10. Never exaggerate results.
11. Write like a consultant, not a software developer, marketer, or AI.

Input Parameters:
- Business Name: ${business_name}
- Industry: ${industry || 'Unknown'}
- Contact Person: ${contact_person || 'Business Owner'}
- Project Name: ${project_name}
- Business Problem: ${problem || 'Manual operational bottlenecks'}
- Current Process: ${current_process || 'Manual workflows with lack of visibility'}
- Desired Outcome: ${desired_outcome || 'Streamlined operation and increased growth'}
- Selected Services: ${Array.isArray(selected_services) ? selected_services.join(', ') : (selected_services || 'Automation Services')}
- Custom Notes: ${notes || 'None'}
- Timeline: ${timeline || '4 Weeks'}
- Pricing: ${finalPricing || 'TBD'}
- Milestones: ${milestones || '50% upon commencement, 50% upon delivery'}

Respond ONLY with a valid JSON object. Do not include markdown tags, greeting notes, or preambles. The JSON must match the following schema:
{
  "cover_page": {
    "category_name": "e.g. 'Studio Automation Systems' or 'Healthcare Automation Systems' or 'Business Growth Systems' tailored to the project context",
    "project_name": "${project_name}",
    "headline": "A short, outcome-focused transformation headline, e.g. 'Eliminate Class No-Shows & Streamline Trainer Scheduling Instantly'"
  },
  "problem_overview": {
    "description": "A structured explanation of current challenges, pain points, inefficiencies, and risks of continuing the current process. Use business language, don't blame the customer, and create urgency without fear tactics."
  },
  "key_benefits": [
    {
      "value": "Metric value, e.g. '100%' or '₹0' or 'Automatic'",
      "label": "Metric label, e.g. 'Trainer Accountability' or 'Monthly Software Fees' or 'Owner Alerts'. Tailor to the project. Exactly 3 metrics."
    }
  ],
  "how_it_helps": [
    {
      "section_name": "e.g. 'The WhatsApp Assistant' or 'The Smart Booking System' or 'The Live Owner Dashboard'. Generate 2 to 4 sections.",
      "items": [
        {
          "feature": "Feature name, e.g. 'Automatic Confirmation'",
          "benefit": "Business benefit, e.g. 'The system automatically confirms trainer attendance before classes, reducing last-minute scheduling surprises.'"
        }
      ]
    }
  ],
  "deliverables": [
    "Clean list of deliverables (e.g. 'WhatsApp Automation', 'Attendance Tracking', 'Reporting Dashboard', etc.). List 4 to 6 items."
  ],
  "timeline": [
    {
      "phase": "Phase 1 - Planning & Setup",
      "description": "Brief description of planning, audit, and architecture alignment."
    },
    {
      "phase": "Phase 2 - Core Development",
      "description": "Brief description of building the core automation components."
    },
    {
      "phase": "Phase 3 - Testing & Refinement",
      "description": "Brief description of operational runs, safety tests, and final adjustments."
    },
    {
      "phase": "Phase 4 - Deployment & Training",
      "description": "Brief description of delivery, launch, and onboarding."
    }
  ],
  ${investmentSchema}
  "final_summary": {
    "total_investment": "${finalPricing}",
    "payment_structure": "${milestones || (hasLineItems ? precomputedInvestment.map(s => `${s.percentage}% ${s.label}`).join(', ') : '')}",
    "support_included": "e.g. '30 Days Post-Launch Optimization Support'",
    "expected_delivery": "${timeline}"
  }
}
        `.trim();

        console.log(`[Proposal Writer] Generating full proposal for ${business_name}...`);
        const responseText = await proposalLLM(prompt);
        const parsedProposal = parseLLMJson(responseText);

        // Merge in the deterministic amounts — the LLM only supplied names/scope text above.
        if (hasLineItems && Array.isArray(parsedProposal.investment)) {
            parsedProposal.investment = parsedProposal.investment.map((milestone, idx) => ({
                ...milestone,
                amount: precomputedInvestment[idx]?.amount ?? finalPricing,
            }));
            parsedProposal.final_summary = {
                ...parsedProposal.final_summary,
                total_investment: finalPricing,
            };
        }

        res.json(parsedProposal);
    } catch (err) {
        console.error('Error in proposal generation:', err.message);
        res.status(500).json({ error: 'Failed to generate proposal: ' + err.message });
    }
});

module.exports = router;
