const GAP_WEIGHTS = {
    noWebsite: 20,
    brokenWebsite: 18,
    noWhatsApp: 8,
    noBookingSystem: 8,
    fewReviews: 7,
    lowRating: 7,
    slowWebsite: 6,
    noSSL: 6,
    inactiveSocial: 5,
    noEmailCapture: 4,
    noLeadForm: 4,
    noSchema: 3,
    noChat: 3,
    missingGBPFields: 2
};

const PILLAR_MAPPING = {
    noWebsite: 'presence',
    brokenWebsite: 'presence',
    slowWebsite: 'presence',
    noSSL: 'presence',
    noSchema: 'presence',
    missingGBPFields: 'presence',
    
    noWhatsApp: 'automation',
    noBookingSystem: 'automation',
    noEmailCapture: 'automation',
    noLeadForm: 'automation',

    fewReviews: 'reputation',
    lowRating: 'reputation',

    inactiveSocial: 'ads', // or presence, but let's use ads/social
    noChat: 'chatbot'
};

/**
 * Processes raw AI output into a structured gap intelligence object.
 * @param {Object} aiOutput - The raw JSON output from the AI
 * @returns {Object} Mapped gap intelligence
 */
function processGapIntelligence(aiOutput) {
    if (!aiOutput) return null;

    const gaps = aiOutput.gaps || {};
    
    // 1. Calculate intent_score from gap weights
    let totalPenalty = 0;
    const activeGaps = [];

    for (const [gapKey, hasGap] of Object.entries(gaps)) {
        if (hasGap && GAP_WEIGHTS[gapKey]) {
            totalPenalty += GAP_WEIGHTS[gapKey];
            activeGaps.push({ key: gapKey, weight: GAP_WEIGHTS[gapKey], pillar: PILLAR_MAPPING[gapKey] || 'other' });
        }
    }

    // lower = more gaps. E.g., 100 - penalty
    const calculatedScore = Math.max(0, 100 - totalPenalty);

    // 1.5 Determine Tier based on score (consistent with legacy logic)
    let determinedTier = 'cold';
    if (calculatedScore >= 70) determinedTier = 'hot';
    else if (calculatedScore >= 40) determinedTier = 'warm';

    // 2. Extract top 3 gaps by weight
    activeGaps.sort((a, b) => b.weight - a.weight);
    const topGaps = activeGaps.slice(0, 3).map(g => g.key);

    // 3. Determine dominant pillar from top gaps
    const pillarCounts = {};
    for (const gap of activeGaps.slice(0, 3)) { // dominant from top gaps
        if (!pillarCounts[gap.pillar]) pillarCounts[gap.pillar] = 0;
        pillarCounts[gap.pillar] += gap.weight;
    }

    let dominantPillar = aiOutput.pillar || 'presence';
    let maxWeight = -1;
    for (const [pillar, weight] of Object.entries(pillarCounts)) {
        if (weight > maxWeight) {
            maxWeight = weight;
            dominantPillar = pillar;
        }
    }

    return {
        intent_score: calculatedScore,
        tier: determinedTier,
        gap_vertical: aiOutput.vertical || 'other',
        service_fit: aiOutput.service_fit || '',
        gap_pitch: aiOutput.gap_pitch || '',
        gap_pillar: dominantPillar,
        gap_top: topGaps,
        gap_details: gaps,
    };
}

module.exports = {
    processGapIntelligence,
    GAP_WEIGHTS,
    PILLAR_MAPPING
};
