const pool = require('../config/db');
const { fastPrompt } = require('../scrapers/llmExtractor'); // Tier 2: phi3 — classification task

/**
 * AI Classification Service
 * Categorizes businesses into Revive, Bliss, or World Trek campaigns.
 * Uses phi3 (local, Tier 2) — falls back to rule-based if model is unavailable.
 */
class ClassificationService {

    /**
     * Classifies a business based on its metadata.
     * @param {object} lead - { business_name, website, description, details }
     * @returns {Promise<number>} campaign_id (1, 2, or 3)
     */
    async classifyLead(lead) {
        try {
            const prompt = `
                You are a lead classification agent. Classify the following business into one of these three campaigns:
                1. Revive Bangalore: Publication/Ads. Fits: Restaurants, Spas, Salons, Cafes, Bars, Events, Lifestyle.
                2. Bliss Pop Up: Events & Vendors. Fits: Homegrown brands, Clothing, Jewelry, Handicrafts, Boutique stores, Small makers.
                3. World Trek: Travel. Fits: Resorts, Hotels, Travel gear, Adventure sports, Trekking, Tourism.

                Business Name: ${lead.business_name}
                Website: ${lead.website || 'N/A'}
                
                Respond with ONLY the campaign number (1, 2, or 3). No explanation.
            `.trim();

            const choice = await fastPrompt(prompt);
            const campaignId = parseInt(choice.trim());

            if ([1, 2, 3].includes(campaignId)) return campaignId;

            // If model returned something unparseable, fall back
            return this.ruleBasedClassification(lead);

        } catch (err) {
            console.warn('[Classification] phi3 unavailable, using rule-based fallback:', err.message);
            return this.ruleBasedClassification(lead);
        }
    }

    /**
     * Fallback rule-based classification — pure Tier 1, no LLM.
     */
    ruleBasedClassification(lead) {
        const name    = (lead.business_name || '').toLowerCase();
        const website = (lead.website || '').toLowerCase();
        const combined = `${name} ${website}`;

        // World Trek keywords (Travel, Adventure, Outdoors)
        const trekKeywords = ['trek', 'adventure', 'mountain', 'expedition', 'himalaya', 'travel', 'resort', 'hotel', 'outdoor', 'camping', 'safari', 'tour', 'journey'];
        if (trekKeywords.some(k => combined.includes(k))) return 3;

        // Bliss Pop Up keywords (Makers, Small Brands, Vendors)
        const blissKeywords = ['store', 'jewelry', 'boutique', 'clothing', 'handicraft', 'handmade', 'artisan', 'maker', 'flea', 'market', 'lifestyle', 'decor'];
        if (blissKeywords.some(k => combined.includes(k))) return 2;

        // Default: Revive Bangalore
        return 1;
    }
}

module.exports = new ClassificationService();
