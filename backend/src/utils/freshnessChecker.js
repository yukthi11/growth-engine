const { parsePhoneNumberFromString } = require('libphonenumber-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const DISPOSABLE_DOMAINS = ['mailinator.com', 'tempmail.com', 'guerrillamail.com'];
const FRESHNESS_THRESHOLD_DAYS = 90;

/**
 * Lead Freshness Checker Utility
 */

/**
 * Determines if a lead is stale based on age, phone format, and email domain.
 * @param {Array} leads - Array of lead objects from DB
 * @returns {Array} Array of freshness results
 */
async function checkFreshness(leads) {
    const now = new Date();

    return leads.map(lead => {
        let isStale = false;
        let reason = null;
        let daysSinceEnriched = null;

        if (lead.enriched_at) {
            const enrichedDate = new Date(lead.enriched_at);
            daysSinceEnriched = Math.floor((now - enrichedDate) / (1000 * 60 * 60 * 24));

            if (daysSinceEnriched > FRESHNESS_THRESHOLD_DAYS) {
                isStale = true;
                reason = "enriched_over_90_days";
            }
        }

        if (!isStale && lead.last_verified_at) {
            const verifiedDate = new Date(lead.last_verified_at);
            const daysSinceVerified = Math.floor((now - verifiedDate) / (1000 * 60 * 60 * 24));
            if (daysSinceVerified > FRESHNESS_THRESHOLD_DAYS) {
                isStale = true;
                reason = "verification_expired";
            }
        }

        if (!isStale && lead.phone) {
            const phoneNumber = parsePhoneNumberFromString(lead.phone);
            // Check if it's explicitly E.164 and valid
            if (!phoneNumber || !phoneNumber.isValid() || lead.phone !== phoneNumber.format('E.164')) {
                isStale = true;
                reason = "phone_invalid";
            }
        }

        if (!isStale && lead.email_address) {
            const domain = lead.email_address.split('@')[1]?.toLowerCase();
            if (DISPOSABLE_DOMAINS.includes(domain)) {
                isStale = true;
                reason = "disposable_email";
            }
        }

        return {
            id: lead.id,
            isStale,
            reason,
            daysSinceEnriched
        };
    });
}

/**
 * Updates leads in the DB to mark them as stale.
 * @param {Object} pool - DB Pool
 * @param {Array} freshnessResults - Results from checkFreshness
 */
async function markStaleLeads(pool, freshnessResults) {
    const staleResults = freshnessResults.filter(r => r.isStale);
    if (staleResults.length === 0) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const res of staleResults) {
            await client.query(
                `UPDATE leads SET is_stale = true, stale_reason = $1 WHERE id = $2`,
                [res.reason, res.id]
            );
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Returns all stale leads for a company.
 * @param {Object} pool - DB Pool
 * @param {Number} companyId - Company ID
 */
async function getStaleLeads(pool, companyId) {
    const res = await pool.query(
        `SELECT * FROM leads WHERE company_id = $1 AND is_stale = true`,
        [companyId]
    );
    return res.rows;
}

/**
 * Main Test Block
 */
async function main() {
    const now = new Date();
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(now.getDate() - 100);

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const mockLeads = [
        { id: 1, business_name: 'Fresh Lead', enriched_at: yesterday, phone: '+12135550123', email_address: 'valid@gmail.com' },
        { id: 2, business_name: 'Stale by Age', enriched_at: hundredDaysAgo, phone: '+12135550124', email_address: 'valid2@gmail.com' },
        { id: 3, business_name: 'Stale by Phone', enriched_at: yesterday, phone: '555-0125', email_address: 'valid3@gmail.com' },
        { id: 4, business_name: 'Stale by Email', enriched_at: yesterday, phone: '+12135550126', email_address: 'test@mailinator.com' },
        { id: 5, business_name: 'Fresh No Enrichment', enriched_at: null, phone: '+12135550127', email_address: 'valid4@gmail.com' }
    ];

    console.log('--- Testing checkFreshness ---');
    const results = await checkFreshness(mockLeads);
    console.table(results);

    // Mock DB interaction (optional if actually running against DB, but for output we just print)
    console.log('\nCandidates for markStaleLeads:');
    console.log(results.filter(r => r.isStale));
}

if (require.main === module) {
    main();
}

module.exports = {
    checkFreshness,
    markStaleLeads,
    getStaleLeads
};
