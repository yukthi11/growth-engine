const dns = require('dns/promises');

// List of disposable email providers to mark as "risky"
const DISPOSABLE_PROVIDERS = [
    'mailinator.com',
    'tempmail.com',
    'guerrillamail.com',
    'yopmail.com',
    'throwaway.email'
];

/**
 * Verifies if an email address is properly formatted and has a valid MX record.
 * Checks against a list of known disposable providers.
 * 
 * @param {string} email - The email address to verify.
 * @returns {Promise<object>} Verification result.
 */
async function verifyEmail(email) {
    const result = {
        email: email || '',
        formatValid: false,
        mxFound: false,
        status: "invalid",
        reason: ""
    };

    if (!email || typeof email !== 'string') {
        result.reason = "Email is missing or of incorrect type.";
        return result;
    }

    // 1. Format Validation using Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        result.status = "invalid";
        result.reason = "Invalid email format.";
        return result;
    }
    result.formatValid = true;

    // 2. DNS MX Record Lookup
    const domain = email.split('@')[1];
    try {
        const mxRecords = await dns.resolveMx(domain);
        if (mxRecords && mxRecords.length > 0) {
            result.mxFound = true;
        } else {
            result.status = "invalid";
            result.reason = "No MX records found for domain.";
            return result;
        }
    } catch (err) {
        result.status = "invalid";
        result.reason = `DNS MX lookup failed: ${err.message}`;
        return result;
    }

    // 3. Mark "Risky" for disposable providers
    if (DISPOSABLE_PROVIDERS.includes(domain.toLowerCase())) {
        result.status = "risky";
        result.reason = "Disposable email provider detected.";
    } else {
        result.status = "valid";
        result.reason = "Email passed format and MX validation.";
    }

    return result;
}

// Named export for the utility
module.exports = { verifyEmail };

/**
 * Main Test Block
 */
async function main() {
    const testEmails = [
        "hello@gmail.com",
        "bad@mailinator.com",
        "notanemail",
        "ceo@infosys.com",
        ""
    ];

    console.log("--- Email Verifier Test Run ---");
    for (const email of testEmails) {
        const result = await verifyEmail(email);
        console.log(`Input: "${email}"`);
        console.log(`Result:`, JSON.stringify(result, null, 2));
        console.log('-'.repeat(30));
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    main();
}
