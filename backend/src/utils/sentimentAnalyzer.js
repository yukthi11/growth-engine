const { generalPrompt } = require("../scrapers/llmExtractor");
require('dotenv').config();

// Same fix as proposals.js/intelligencePipeline.js: the shared default GROQ_MODEL
// (a reasoning model) burns 2-4x the tokens/latency of a non-reasoning model on
// this trivial 1-field classification, and this runs on every inbound reply.
const SENTIMENT_LLM_MODEL = process.env.SENTIMENT_LLM_MODEL || 'openai/gpt-oss-20b';
const SENTIMENT_LLM_MAX_TOKENS = 100;

/**
 * Analyzes a lead's reply to determine if they are interested or want to stop.
 * @param {string} messageText 
 * @returns {Promise<{category: "STOP" | "INTERESTED" | "NEUTRAL"}>}
 */
async function analyzeReply(messageText) {
    const prompt = `
        Analyze this lead reply to an outreach message. 
        Categorize the response into one of three categories:
        - STOP: The user is asking to be removed, unsubscribed, or showing anger/disinterest in any further contact.
        - INTERESTED: The user is showing interest, asking for a meeting, or looking for more info.
        - NEUTRAL: The user didn't give a clear answer (e.g., "Out of office" or "Tell me more" without clear intent).

        Return ONLY a JSON object with the format: { "category": "STOP" | "INTERESTED" | "NEUTRAL" }

        Reply text: "${messageText}"
    `;

    try {
        const text = await generalPrompt(prompt, { model: SENTIMENT_LLM_MODEL, maxTokens: SENTIMENT_LLM_MAX_TOKENS });
        const categoryData = JSON.parse(text);
        return categoryData;
    } catch (error) {
        console.error('[AI Sentiment] Error analyzing reply:', error.message);
        return { category: 'NEUTRAL' }; // Default to neutral on AI failure
    }
}

module.exports = { analyzeReply };
