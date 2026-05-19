const { generateBlockingKeys } = require('./dedupeBlocker');
const { scoreLeadPair } = require('./dedupeScorer');
const { assembleGoldenRecord } = require('./goldenRecord');

/**
 * Union-Find Data Structure for transitive grouping.
 * Allows us to group leads that are connected via merge decisions.
 */
class UnionFind {
    constructor(size) {
        this.parent = Array.from({ length: size }, (_, i) => i);
    }

    find(i) {
        if (this.parent[i] === i) return i;
        return this.parent[i] = this.find(this.parent[i]);
    }

    union(i, j) {
        const rootI = this.find(i);
        const rootJ = this.find(j);
        if (rootI !== rootJ) {
            this.parent[rootI] = rootJ;
        }
    }

    getGroups() {
        const groups = new Map();
        for (let i = 0; i < this.parent.length; i++) {
            const root = this.find(i);
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root).push(i);
        }
        return Array.from(groups.values());
    }
}

/**
 * runDeduplication - Orchestrates the full deduplication pipeline.
 * 
 * @param {object[]} leads - Array of normalized lead objects.
 * @returns {Promise<object>} Result object with goldenRecords and stats.
 */
async function runDeduplication(leads) {
    if (!leads || leads.length === 0) {
        return { goldenRecords: [], stats: { inputCount: 0, duplicatesFound: 0, outputCount: 0, reviewQueue: [] } };
    }

    // --- Step 1: Build block index ---
    const blockIndex = new Map();
    leads.forEach((lead, index) => {
        const keys = generateBlockingKeys(lead);
        keys.forEach(key => {
            if (!blockIndex.has(key)) blockIndex.set(key, []);
            blockIndex.get(key).push(index);
        });
    });

    // --- Step 2: Score pairs within each block ---
    const uf = new UnionFind(leads.length);
    const reviewQueue = [];
    const processedPairs = new Set();

    for (const [key, indices] of blockIndex) {
        for (let i = 0; i < indices.length; i++) {
            for (let j = i + 1; j < indices.length; j++) {
                const idxA = indices[i];
                const idxB = indices[j];
                const pairKey = [idxA, idxB].sort().join(',');

                if (processedPairs.has(pairKey)) continue;
                processedPairs.add(pairKey);

                const scoreResult = scoreLeadPair(leads[idxA], leads[idxB]);

                if (scoreResult.decision === 'auto_merge') {
                    uf.union(idxA, idxB);
                } else if (scoreResult.decision === 'review') {
                    reviewQueue.push({
                        leadA: leads[idxA],
                        leadB: leads[idxB],
                        result: scoreResult
                    });
                }
            }
        }
    }

    // --- Step 3 & 4: Build merge groups and Assemble Golden Records ---
    const groups = uf.getGroups();
    const goldenRecords = [];
    let duplicatesFound = 0;

    for (const indices of groups) {
        if (indices.length > 1) {
            duplicatesFound += (indices.length - 1);
            const groupLeads = indices.map(i => leads[i]);
            goldenRecords.push(assembleGoldenRecord(groupLeads));
        } else {
            // Pass through unique lead as a simplified Golden Record
            const lead = leads[indices[0]];
            goldenRecords.push({
                ...lead,
                sources: [lead.source],
                mergedAt: null
            });
        }
    }

    // --- Step 5: Return result object ---
    return {
        goldenRecords,
        stats: {
            inputCount: leads.length,
            duplicatesFound,
            outputCount: goldenRecords.length,
            reviewQueue
        }
    };
}

module.exports = { runDeduplication };

/**
 * Main Test Block
 */
async function main() {
    const leads = [
        // Group 1: Clear Duplicates (auto_merge)
        {
            businessName: "ABC Traders",
            phone: { e164: "+919876543210", isValid: true, score: 1.0 },
            email: { address: "contact@abctraders.com", status: "valid", score: 0.9 },
            location: { normalized: "koramangala, bangalore" },
            source: "justdial"
        },
        {
            businessName: "ABC Traders Pvt Ltd",
            phone: { e164: "+919876543210", isValid: true, score: 0.95 },
            email: { address: "info@abctraders.com", status: "valid", score: 0.9 },
            location: { normalized: "koramangala, bangalore" },
            source: "facebook"
        },
        // Group 2: Possible Duplicates (review) - Same name/area, different phone
        {
            businessName: "Unique Interior",
            phone: { e164: "+911234567890", isValid: true, score: 0.9 },
            email: { address: "hello@unique.com", status: "valid", score: 0.8 },
            location: { normalized: "whitefield, bangalore" },
            source: "maps"
        },
        {
            businessName: "Unique Interior Design",
            phone: { e164: "+910000000000", isValid: true, score: 0.8 },
            email: { address: "sales@unique.com", status: "valid", score: 0.8 },
            location: { normalized: "whitefield, bangalore" },
            source: "instagram"
        },
        // Unique Leads
        {
            businessName: "Standalone Shop",
            phone: { e164: "+915555555555", isValid: true, score: 0.9 },
            email: { address: "shop@gmail.com", status: "valid", score: 0.9 },
            location: { normalized: "mumbai" },
            source: "justdial"
        },
        {
            businessName: "Other Business",
            phone: { e164: "+917777777777", isValid: true, score: 0.9 },
            email: { address: "info@other.in", status: "valid", score: 0.9 },
            location: { normalized: "delhi" },
            source: "google"
        }
    ];

    console.log("--- Dedupe Engine Integration Test ---");
    const result = await runDeduplication(leads);

    console.log(`Input Count: ${result.stats.inputCount}`);
    console.log(`Duplicates Found: ${result.stats.duplicatesFound}`);
    console.log(`Output Count: ${result.stats.outputCount}`);
    console.log(`Review Flags: ${result.stats.reviewQueue.length}`);

    console.log("\n--- Final Golden Records ---");
    result.goldenRecords.forEach((gr, i) => {
        console.log(`[${i + 1}] ${gr.businessName} (${gr.sources.join(', ')}) - Merged: ${!!gr.mergedAt}`);
    });

    console.log("\n--- Review Queue Details ---");
    result.stats.reviewQueue.forEach((item, i) => {
        console.log(`[${i + 1}] ${item.leadA.businessName} vs ${item.leadB.businessName} | Score: ${item.result.totalScore}`);
    });
}

if (require.main === module) {
    main().catch(console.error);
}
