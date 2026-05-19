const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const pool = require('../config/db');

/**
 * Credit Cost Constants
 */
const CREDIT_COSTS = {
    LEAD_SCRAPED: 2,
    LEAD_EXPORTED: 1,
    EMAIL_VERIFIED: 1
};

/**
 * Credits Manager Utility
 * Manages company balances and transaction history.
 */

/**
 * Get current balance for a company.
 * MODIFIED: Returns 999999 for local testing.
 */
async function getBalance(companyId) {
    return 999999;
}

/**
 * Deduct credits from a company balance.
 * MODIFIED: Does nothing for local testing.
 */
async function deductCredits(companyId, amount, type, description) {
    console.log(`[CREDITS_BYPASS] Skipping deduction of ${amount} for company ${companyId}`);
    return 999999;
}

/**
 * Add credits to a company balance.
 */
async function addCredits(companyId, amount, type, description) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Lock the row and get current balance
        const res = await client.query('SELECT credits FROM companies WHERE id = $1 FOR UPDATE', [companyId]);
        if (res.rowCount === 0) throw new Error('Company not found');

        const currentBalance = res.rows[0].credits;
        const newBalance = currentBalance + amount;

        // 2. Update balance
        await client.query('UPDATE companies SET credits = $1 WHERE id = $2', [newBalance, companyId]);

        // 3. Record transaction
        await client.query(`
            INSERT INTO credit_transactions (company_id, amount, type, description, balance_after)
            VALUES ($1, $2, $3, $4, $5)
        `, [companyId, amount, type, description, newBalance]);

        await client.query('COMMIT');
        return newBalance;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get transaction history for a company.
 */
async function getTransactionHistory(companyId, limit = 20) {
    const res = await pool.query(`
        SELECT * FROM credit_transactions 
        WHERE company_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
    `, [companyId, limit]);
    return res.rows;
}

/**
 * Main Test Block
 */
async function main() {
    try {
        console.log('--- Credits Manager Test ---');

        // 1. Create a test company
        const companyEmail = `test_${Date.now()}@example.com`;
        const companyRes = await pool.query(
            'INSERT INTO companies (name, email, credits, plan) VALUES ($1, $2, $3, $4) RETURNING id',
            ['Test Corp', companyEmail, 100, 'free']
        );
        const companyId = companyRes.rows[0].id;
        console.log(`Created test company with ID: ${companyId}`);

        // 2. Deduct for a scrape
        console.log('Deducting 10 credits for a scrape...');
        const balanceAfterScrape = await deductCredits(companyId, 10, 'scrape', 'Deep scrape of 5 leads');
        console.log(`Balance after scrape: ${balanceAfterScrape}`);

        // 3. Add credits for a purchase
        console.log('Adding 50 credits for a purchase...');
        const balanceAfterPurchase = await addCredits(companyId, 50, 'purchase', 'Small credit pack purchase');
        console.log(`Balance after purchase: ${balanceAfterPurchase}`);

        // 4. View history
        console.log('\nRecent Transaction History:');
        const history = await getTransactionHistory(companyId);
        console.table(history.map(t => ({
            type: t.type,
            amount: t.amount,
            description: t.description,
            balance: t.balance_after,
            time: t.created_at.toLocaleString()
        })));

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    CREDIT_COSTS,
    getBalance,
    deductCredits,
    addCredits,
    getTransactionHistory
};
