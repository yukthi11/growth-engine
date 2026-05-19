-- Migration: Add Discovery Queue and Auto-Draft Status
CREATE TABLE IF NOT EXISTS discovery_queue (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    leads_found INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Track which leads have already been drafted by the Auto-Drafter
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_auto_drafted BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS auto_draft_error TEXT;

-- Create an index to speed up the Auto-Drafter's search
CREATE INDEX IF NOT EXISTS idx_leads_needs_draft ON leads (id) WHERE tier = 'A' AND is_auto_drafted = FALSE;
