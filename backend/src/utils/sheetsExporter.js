const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Google Sheets Engine - Sync Architecture
 */
class SheetsEngine {
    constructor() {
        if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is missing');
        }

        let rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (rawJson && (rawJson.startsWith("'") || rawJson.startsWith('"'))) {
            rawJson = rawJson.substring(1, rawJson.length - 1);
        }

        const credentials = JSON.parse(rawJson);
        this.clientEmail = credentials.client_email;
        this.projectId = credentials.project_id;

        console.log(`[SheetsEngine] 🛠️  Re-initializing Engine. Project: ${this.projectId}, Account: ${this.clientEmail}`);

        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }
        this.auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
        });
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        this.drive = google.drive({ version: 'v3', auth: this.auth });
        this.headers = [
            "Lead ID", "Business Name", "Phone", "Email", "Website",
            "Full Address", "Business Gap", "Source", "Intent Match %",
            "Warmth Tier", "Outreach Status", "Status", "Outreach Message", "Strategy Pitch", "Gap Pillar", "Vertical", "Last Synced At"
        ];
    }

    /**
     * Map internal intent keys to human-readable gaps
     */
    getBusinessGap(lead) {
        if (lead.gap_pitch) return lead.gap_pitch;

        const intentMap = {
            visibility: "Visibility Gap (Needs Online Exposure)",
            footfall: "Footfall Gap (Needs Local Traffic)",
            partnership: "Partnership Gap (Needs B2B/Community Connections)"
        };

        const baseGap = intentMap[lead.primary_intent] || "General Growth Opportunity";

        // Enhance with service_fit if available
        if (lead.service_fit && Array.isArray(lead.service_fit) && lead.service_fit.length > 0) {
            const needs = lead.service_fit.join(', ').replace(/_/g, ' ');
            return `${baseGap} | High Impact: ${needs}`;
        }

        return baseGap;
    }

    getOutreachStatus(lead) {
        const status = (lead.status || 'new').toLowerCase();
        if (status === 'rejected') return 'REJECTED';
        if (status === 'queued') return 'QUEUED';
        if (['messaged', 'contacted', 'replied', 'interested', 'not_interested', 'pricing', 'inquiry', 'unclear', 'closed', 'converted'].includes(status)) {
            return 'MESSAGED';
        }
        return 'NOT SENT';
    }

    async createSpreadsheet(companyName) {
        console.log(`[SheetsEngine] 📂 Creating NEW spreadsheet for "${companyName}"...`);
        try {
            const resource = { properties: { title: `Growth Engine - ${companyName}` } };
            const spreadsheet = await this.sheets.spreadsheets.create({ resource, fields: 'spreadsheetId' });
            const spreadsheetId = spreadsheet.data.spreadsheetId;
            console.log(`[SheetsEngine] ✅ Creation Success! ID: ${spreadsheetId}`);
            return spreadsheetId;
        } catch (error) {
            console.error('[SheetsEngine] ❌ NEW SPREADSHEET CREATION FAILED:', error.message);
            throw error;
        }
    }

    async syncCampaign(spreadsheetId, campaignName, leads) {
        console.log(`[SheetsEngine] 🔄 Syncing Campaign: "${campaignName}" to Spreadsheet ID: ${spreadsheetId}`);
        try {
            // STEP 1: Ensure the tab exists
            await this.ensureSheetExists(spreadsheetId, campaignName);

            // STEP 2: Clear existing content
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: `${campaignName}!A1:Z`,
            });

            // STEP 3: Write Headers
            await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${campaignName}!A1`,
                valueInputOption: 'RAW',
                requestBody: { values: [this.headers] }
            });

            // STEP 4: Write Data
            const rows = leads.map(lead => [
                lead.id,
                lead.business_name,
                lead.phone || '',
                lead.email_address || '',
                lead.website || '',
                lead.location_normalized || 'Not Found',
                this.getBusinessGap(lead),
                lead.source,
                `${lead.intent_score || 0}%`,
                (lead.tier || 'New').toUpperCase(),
                this.getOutreachStatus(lead),
                (lead.status || 'new').toUpperCase(),
                lead.outreach_draft || '',
                lead.gap_pitch || '',
                (lead.gap_pillar || '').toUpperCase(),
                lead.gap_vertical || '',
                new Date().toISOString().split('T')[0]
            ]);

            if (rows.length > 0) {
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: `${campaignName}!A2`,
                    valueInputOption: 'RAW',
                    requestBody: { values: rows }
                });
            }

            // STEP 5: Apply Auto-Wrapping to the entire sheet
            const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === campaignName);
            if (sheet) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                repeatCell: {
                                    range: { sheetId: sheet.properties.sheetId },
                                    cell: {
                                        userEnteredFormat: {
                                            wrapStrategy: 'WRAP',
                                            verticalAlignment: 'TOP'
                                        }
                                    },
                                    fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
                                }
                            }
                        ]
                    }
                });
            }

            console.log(`[SheetsEngine] 🎉 Sync Complete for "${campaignName}"!`);
            return {
                success: true,
                rowsSynced: rows.length,
                spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
            };

        } catch (error) {
            console.error(`[SheetsEngine] ❌ SYNC OPERATION FAILED for "${campaignName}":`, error.message);
            console.error(`[SheetsEngine] Debug Info: Spreadsheet=${spreadsheetId}, Tab=${campaignName}, Email=${this.clientEmail}`);

            if (error.message.includes('permission')) {
                console.error(`[SheetsEngine] 💡 PERMISSION ROOT CAUSE: Either Drive API is disabled OR the sheet is not shared with ${this.clientEmail}`);
            }
            throw new Error(`Google API Permission Denied: ${error.message}. Ensure Drive API is enabled and ${this.clientEmail} is an Editor.`);
        }
    }

    async ensureSheetExists(spreadsheetId, title) {
        try {
            const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
            const exists = spreadsheet.data.sheets.some(s => s.properties.title === title);

            if (!exists) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [{ addSheet: { properties: { title } } }]
                    }
                });
                console.log(`[SheetsEngine] ✅ Tab "${title}" created.`);

                // Fetch again to get the new sheetId
                const updatedSpreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
                const newSheet = updatedSpreadsheet.data.sheets.find(s => s.properties.title === title);
                const sheetId = newSheet.properties.sheetId;

                // Apply conditional formatting for Outreach Status column (Index 10 = Column K)
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addConditionalFormatRule: {
                                    rule: {
                                        ranges: [{ sheetId, startColumnIndex: 10, endColumnIndex: 11, startRowIndex: 1 }],
                                        booleanRule: {
                                            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'MESSAGED' }] },
                                            format: { backgroundColor: { red: 0.85, green: 0.93, blue: 0.83 } } // Light Green
                                        }
                                    },
                                    index: 0
                                }
                            },
                            {
                                addConditionalFormatRule: {
                                    rule: {
                                        ranges: [{ sheetId, startColumnIndex: 10, endColumnIndex: 11, startRowIndex: 1 }],
                                        booleanRule: {
                                            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'REJECTED' }] },
                                            format: { backgroundColor: { red: 0.96, green: 0.8, blue: 0.8 } } // Light Red
                                        }
                                    },
                                    index: 1
                                }
                            }
                        ]
                    }
                });
                console.log(`[SheetsEngine] 🎨 Conditional formatting applied to Outreach Status column.`);
            }
        } catch (error) {
            console.error(`[SheetsEngine] ❌ ensureSheetExists FAILED:`, error.message);
            throw error;
        }
    }
}

const engine = new SheetsEngine();

module.exports = {
    exportToSheets: (leads, spreadsheetId, sheetName) => engine.syncCampaign(spreadsheetId, sheetName, leads),
    createSpreadsheet: (companyName) => engine.createSpreadsheet(companyName)
};
