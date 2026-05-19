-- ============================================================
-- Growth Engine - Complete Database Schema
-- Auto-applied by Docker on first startup (via initdb.d)
-- Safe to re-run: uses IF NOT EXISTS / DO blocks throughout
-- ============================================================

-- 1. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL DEFAULT 'admin@growth-engine.com',
    credits INTEGER DEFAULT 1000,
    plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed default company if not present
INSERT INTO companies (id, name, email, credits, plan)
VALUES (1, 'Growth Engine', 'admin@growth-engine.com', 1000, 'pro')
ON CONFLICT (id) DO NOTHING;

-- 2. CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. LEADS TABLE (fully consolidated schema)
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    business_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email_address VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(500),
    location_normalized VARCHAR(500),
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'new',
    sources TEXT[] DEFAULT '{}',
    merged_at TIMESTAMP WITH TIME ZONE,

    -- Intelligence columns
    intent_score INTEGER,
    tier VARCHAR(10),
    service_fit TEXT[],
    outreach_draft TEXT,
    enriched_at TIMESTAMP,

    -- Freshness columns
    last_verified_at TIMESTAMP,
    is_stale BOOLEAN DEFAULT FALSE,
    stale_reason VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint on business_name for upsert logic
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_business_name_key') THEN
        ALTER TABLE leads ADD CONSTRAINT leads_business_name_key UNIQUE (business_name);
    END IF;
END $$;

-- Composite index for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_location
ON leads (email_address, location_normalized)
WHERE email_address IS NOT NULL;

-- 4. LEADS REVIEW TABLE
CREATE TABLE IF NOT EXISTS leads_review (
    id SERIAL PRIMARY KEY,
    lead_a JSONB NOT NULL,
    lead_b JSONB NOT NULL,
    score INTEGER,
    breakdown JSONB,
    needs_review BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE NULL
);

-- 5. CREDIT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    amount INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Done
SELECT 'Schema applied successfully' AS status;
