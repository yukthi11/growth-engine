/**
 * Confidence Scorer Utility
 * 
 * Calculates a reliability score for extracted lead data based on 
 * source reputation, extraction complexity, and format validity.
 */

const SCORES = {
    extraction: {
        "regex": 1.0,
        "llm_layer2": 0.85,
        "llm_layer3": 0.5
    },
    multiplier: {
        "maps": 1.0,
        "justdial": 1.0,
        "indiamart": 0.9,
        "facebook": 0.85,
        "instagram": 0.8,
        "google": 0.95
    }
};

const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Calculates a confidence score for a specific data field.
 * 
 * @param {object} fieldObject - { value, source, extractionMethod }
 * @returns {object} { value, score, source, extractionMethod }
 */
function scoreField(fieldObject) {
    const { value, source, extractionMethod } = fieldObject;

    // 1. Get Base Score
    let baseScore = SCORES.extraction[extractionMethod] || 0.5;

    // 2. Apply Source Multiplier
    const multiplier = SCORES.multiplier[source] || 0.7; // Default penalty for unknown sources
    let score = baseScore * multiplier;

    // 3. Format Validity Bonus
    if (typeof value === 'string') {
        const isPhone = PHONE_REGEX.test(value);
        const isEmail = EMAIL_REGEX.test(value);
        if (isPhone || isEmail) {
            score += 0.05;
        }
    }

    // 4. Clamp and Round
    score = Math.min(1.0, Math.max(0.0, score));
    score = Math.round(score * 100) / 100;

    return {
        value,
        score,
        source,
        extractionMethod
    };
}

module.exports = { scoreField };

/**
 * Main Test Block
 */
function main() {
    const testCases = [
        {
            value: "+919876543210",
            source: "justdial",
            extractionMethod: "regex"
        },
        {
            value: "hello@design.com",
            source: "facebook",
            extractionMethod: "llm_layer2"
        },
        {
            value: "Raw snippet text...",
            source: "instagram",
            extractionMethod: "llm_layer3"
        },
        {
            value: "9988776655", // Not E.164
            source: "google",
            extractionMethod: "llm_layer2"
        }
    ];

    console.log("--- Confidence Scorer Test Run ---");
    testCases.forEach(test => {
        const result = scoreField(test);
        console.log(`Input: ${JSON.stringify(test)}`);
        console.log(`Result: ${JSON.stringify(result, null, 2)}`);
        console.log("-".repeat(30));
    });
}

if (require.main === module) {
    main();
}
