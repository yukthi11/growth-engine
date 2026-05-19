const { fastPrompt } = require('../scrapers/llmExtractor'); // Tier 2: phi3 — classification task
require('dotenv').config();

/**
 * Classifies a WhatsApp reply using Gemini 1.5 Flash.
 * @param {string} messageText 
 * @returns {Promise<{intent: string, sentiment: string, confidence: number}>}
 */
async function classifyReply(messageText) {
  const prompt = `
    Classify this WhatsApp reply from a small Bangalore business owner.
    Reply: '${messageText}'
    Return JSON only: { 
      "intent": "interested"|"not_interested"|"inquiry"|"pricing"|"unclear", 
      "sentiment": "positive"|"neutral"|"negative", 
      "confidence": 0-1 
    }
  `;

  try {
    const text = await fastPrompt(prompt);
    // generalPrompt already uses cleanTextResponse, so we just need to parse
    const data = JSON.parse(text);
    return { 
      intent: data.intent || 'unclear', 
      sentiment: data.sentiment || 'neutral', 
      confidence: data.confidence || 0 
    };
  } catch (err) {
    console.error('[Reply Classifier] Classification error:', err.message);
    return { 
      intent: 'unclear', 
      sentiment: 'neutral', 
      confidence: 0 
    };
  }
}

module.exports = { classifyReply };
