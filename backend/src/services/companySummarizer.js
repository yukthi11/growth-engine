const { fastPrompt } = require('../scrapers/llmExtractor'); // Tier 2: phi3 — summarization task
const pool = require('../config/db');

/**
 * Company Summarizer Service
 * 
 * Uses AI to compress long company profiles into high-efficiency 
 * tokens (summaries) that save outreach costs in the long run.
 */
async function generateSummaries(companyId) {
    try {
        const res = await pool.query('SELECT name, overview, goal FROM companies WHERE id = $1', [companyId]);
        if (res.rowCount === 0) return null;

        const { name, overview, goal } = res.rows[0];

        // 1. Summarize Bio
        const bioPrompt = `
            Compress this company overview into a high-density, 25-word summary.
            Keep only the absolute essentials: what they do, their key USP, and their main audience.
            Company Name: ${name}
            Full Overview: ${overview}
            Return only the summarized 25-word text.
        `.trim();

        // 2. Summarize Goal
        const goalPrompt = `
            Summarize this growth goal into a 20-word directive.
            Focus on: what the company hopes to achieve and the desired tone of outreach.
            Full Goal Statement: ${goal}
            Return only the summarized 20-word text.
        `.trim();

        console.log(`[Summarizer] Generating AI summaries for Company ${companyId}...`);
        
        const [bioSummary, goalSummary] = await Promise.all([
            fastPrompt(bioPrompt),
            fastPrompt(goalPrompt)
        ]);

        if (bioSummary && goalSummary) {
            await pool.query(
                'UPDATE companies SET bio_summary = $1, goal_summary = $2 WHERE id = $3',
                [bioSummary, goalSummary, companyId]
            );
            console.log(`✅ [Summarizer] Compaction Complete. Bio: ${bioSummary.length} chars | Goal: ${goalSummary.length} chars`);
            return { bioSummary, goalSummary };
        }
        
        return null;

    } catch (err) {
        console.error('[Summarizer] Failed to generate company summaries:', err.message);
        return null;
    }
}

module.exports = { generateSummaries };
