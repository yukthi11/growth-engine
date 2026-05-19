/**
 * Intent Scorer Utility
 * Calculates a lead's intent score and suggests relevant services.
 */

/**
 * Calculates intent score for a lead based on website analysis and lead data.
 * @param {Object} lead - Normalized lead data from Phase 1
 * @param {Object|null} websiteAnalysis - Result from websiteAnalyzer.js
 * @returns {Object}
 */
function scoreIntent(lead, websiteAnalysis) {
    let score = 0;
    const serviceFit = [];

    // 1. Website signals
    if (websiteAnalysis) {
        if (websiteAnalysis.isOutdated === true) {
            score += 25;
            serviceFit.push("website_redesign");
        }

        if (websiteAnalysis.mobileResponsive === false) {
            score += 20;
            serviceFit.push("mobile_optimization");
        }

        if (websiteAnalysis.hasContactForm === false) {
            score += 15;
            serviceFit.push("lead_capture_setup");
        }

        if (websiteAnalysis.hasWhatsapp === false) {
            score += 10;
            serviceFit.push("whatsapp_business_setup");
        }

        if (websiteAnalysis.techStack && websiteAnalysis.techStack.includes("wordpress")) {
            score += 5;
        }

        if (websiteAnalysis.hasSocialLinks) {
            if (websiteAnalysis.hasSocialLinks.length === 0) {
                score += 15;
                serviceFit.push("social_media_management");
            } else if (websiteAnalysis.hasSocialLinks.length === 1) {
                score += 8;
                serviceFit.push("social_media_management");
            }
        }
    } else {
        // Website unreachable or doesn't exist
        score += 30;
        serviceFit.push("website_creation");
    }

    // 2. Lead data signals
    if (lead.email && lead.email.status === "valid") {
        score -= 5;
    }

    if ((lead.phone && lead.phone.isValid === true) &&
        (lead.email && lead.email.status === "invalid")) {
        score += 10;
    }

    if (lead.sources) {
        if (lead.sources.length >= 3) {
            score -= 10;
        } else if (lead.sources.length === 1) {
            score += 10;
        }
    }

    // Clamp score between 0 and 100
    const finalScore = Math.max(0, Math.min(100, score));

    // Determine Tier
    let tier = "cold";
    if (finalScore >= 70) tier = "hot";
    else if (finalScore >= 40) tier = "warm";

    // Determine Primary Intent (Phase 6 Enhancement)
    let primaryIntent = 'visibility'; // default
    if (serviceFit.includes('website_creation') || serviceFit.includes('website_redesign')) {
        primaryIntent = 'visibility';
    } else if (serviceFit.includes('social_media_management') || serviceFit.length > 2) {
        primaryIntent = 'footfall';
    } else if (finalScore > 80) {
        primaryIntent = 'partnership';
    }

    return {
        intentScore: finalScore,
        tier: tier,
        primaryIntent: primaryIntent,
        serviceFit: [...new Set(serviceFit)], // Unique items
        scoredAt: new Date().toISOString()
    };
}

/**
 * Main test block
 */
function main() {
    console.log("--- Intent Scorer Test Scenarios ---");

    // Scenario 1: Outdated non-mobile site (Expect Hot)
    const lead1 = { email: { status: "invalid" }, phone: { isValid: true }, sources: ["justdial"] };
    const analysis1 = { isOutdated: true, mobileResponsive: false, hasContactForm: false, hasWhatsapp: false, hasSocialLinks: [], techStack: ["wordpress"] };
    console.log("\nScenario 1: Outdated, Non-Mobile, No Social");
    console.log(scoreIntent(lead1, analysis1));

    // Scenario 2: Modern site with social presence (Expect Cold/Warm)
    const lead2 = { email: { status: "valid" }, phone: { isValid: true }, sources: ["justdial", "maps", "indiamart"] };
    const analysis2 = { isOutdated: false, mobileResponsive: true, hasContactForm: true, hasWhatsapp: true, hasSocialLinks: ["facebook", "instagram"], techStack: ["react"] };
    console.log("\nScenario 2: Modern Site, Valid Credentials, High Presence");
    console.log(scoreIntent(lead2, analysis2));

    // Scenario 3: No website at all (Expect Hot)
    const lead3 = { email: { status: "invalid" }, phone: { isValid: true }, sources: ["justdial"] };
    const analysis3 = null;
    console.log("\nScenario 3: No Website, Phone Only");
    console.log(scoreIntent(lead3, analysis3));
}

if (require.main === module) {
    main();
}

module.exports = {
    scoreIntent
};
