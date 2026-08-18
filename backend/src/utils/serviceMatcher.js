/**
 * Deterministic gap -> service catalog matching. No LLM involved — a lead's
 * detected gaps (from gapMapper.js) are matched against each service's
 * gap_tags to auto-select relevant catalog items and compute pricing.
 * Shared by the Proposal Writer autofill route and the leads-table
 * "Generate Proposal" quick action so both stay in sync (DRY).
 */

function getActiveGapKeys(lead) {
    const details = lead.gap_details || {};
    const keys = Object.entries(details)
        .filter(([, isActive]) => isActive === true)
        .map(([gapKey]) => gapKey);

    if (lead.gap_pillar) keys.push(lead.gap_pillar);
    if (lead.gap_top) keys.push(...lead.gap_top);

    return new Set(keys);
}

/**
 * Ranks active catalog services by how many of their gap_tags overlap with
 * the lead's active gaps, and returns the top matches.
 */
function recommendServices(lead, services, { limit = 4 } = {}) {
    const activeGaps = getActiveGapKeys(lead);
    if (activeGaps.size === 0) return [];

    return services
        .map((service) => {
            const tags = service.gap_tags || [];
            const score = tags.filter((tag) => activeGaps.has(tag)).length;
            return { service, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.service.sort_order - b.service.sort_order)
        .slice(0, limit)
        .map(({ service }) => service);
}

function computeOneTimeTotal(services) {
    return services.reduce((sum, s) => sum + Number(s.base_price || 0), 0);
}

function computeMonthlyTotal(services) {
    return services.reduce((sum, s) => sum + Number(s.monthly_price || 0), 0);
}

function formatINR(amount) {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Builds a single human-readable string from a one-time/monthly total pair,
 * e.g. "₹45,000 + ₹1,999/month" or just "₹10,000" or "TBD" when both are 0.
 */
function formatTotals(oneTime, monthly) {
    if (oneTime === 0 && monthly === 0) return 'TBD';

    const parts = [];
    if (oneTime > 0) parts.push(formatINR(oneTime));
    if (monthly > 0) parts.push(`${formatINR(monthly)}/month`);

    return parts.join(' + ');
}

/**
 * Convenience wrapper over formatTotals() for a list of catalog services.
 */
function formatPricingSummary(services) {
    return formatTotals(computeOneTimeTotal(services), computeMonthlyTotal(services));
}

/**
 * Sums an arbitrary set of proposal line items (catalog-derived or custom,
 * with editable quantity/unit price overrides) into one-time + monthly totals.
 */
function computeLineItemTotals(lineItems = []) {
    return lineItems.reduce(
        (totals, item) => {
            const quantity = Number(item.quantity || 1);
            totals.oneTime += Number(item.unit_price || 0) * quantity;
            totals.monthly += Number(item.monthly_price || 0) * quantity;
            return totals;
        },
        { oneTime: 0, monthly: 0 }
    );
}

const DEFAULT_MILESTONE_SPLIT = [
    { label: 'Upfront', percentage: 50 },
    { label: 'On Completion', percentage: 50 },
];

/**
 * Applies a percentage-based milestone split to a computed one-time total.
 * The LLM never sees or invents these amounts — only the milestone
 * name/scope text, which gets merged with this deterministic amount.
 */
function applyMilestoneSplit(totalOneTime, splits = DEFAULT_MILESTONE_SPLIT) {
    return splits.map((split) => ({
        label: split.label,
        percentage: split.percentage,
        amount: formatINR(Math.round((split.percentage / 100) * totalOneTime)),
    }));
}

module.exports = {
    getActiveGapKeys,
    recommendServices,
    computeOneTimeTotal,
    computeMonthlyTotal,
    computeLineItemTotals,
    applyMilestoneSplit,
    formatINR,
    formatTotals,
    formatPricingSummary,
    DEFAULT_MILESTONE_SPLIT,
};
