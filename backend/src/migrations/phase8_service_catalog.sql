-- Migration Phase 8: Service Catalog
-- Backs the Proposal Writer with a real, editable service catalog instead of
-- hardcoded strings + LLM-invented prices. Base prices here are defaults only —
-- every field stays editable per-proposal at generation time.
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,       -- 'tech' | 'marketing' | 'addon' | 'support'
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    base_price NUMERIC(12, 2),           -- one-time or starting price; NULL = custom quote only
    monthly_price NUMERIC(12, 2),        -- recurring component, if any
    price_type VARCHAR(30) NOT NULL DEFAULT 'one_time', -- 'one_time' | 'monthly' | 'one_time_plus_monthly' | 'custom_quote'
    gap_tags TEXT[] DEFAULT '{}',        -- gap_pillar / gap flag keys this service addresses, e.g. {presence, noWebsite}
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services (category);

-- Seed catalog from Revive Technology's current price sheet.
-- ON CONFLICT keeps this idempotent (safe to re-run) without clobbering price
-- edits made later through the admin UI — matches existing 'name' only on first insert.
INSERT INTO services (category, name, description, base_price, monthly_price, price_type, gap_tags, sort_order)
VALUES
    ('tech', 'Landing Page', '1-page custom-designed website with basic SEO, WhatsApp/phone/email contact options, domain + hosting (1 year), SSL, and live deployment.', 10000, NULL, 'one_time', '{presence,noWebsite}', 10),
    ('tech', 'Business Website', 'Up to 5 pages (Home, About, Services, Portfolio, Contact) with custom design, domain + hosting (1 year), SSL, contact options, basic SEO, and visitor tracking.', 20000, NULL, 'one_time', '{presence,noWebsite,brokenWebsite}', 20),
    ('tech', 'WhatsApp Business Platform', 'WhatsApp Business connected to a management dashboard with automated replies, customer tracking, notifications, and basic workflow automation.', 25000, NULL, 'one_time', '{automation,noWhatsApp}', 30),
    ('tech', 'E-Commerce Website', 'Full online store: product catalog, shopping cart, payment gateway, order management, mobile-friendly design, admin dashboard, and 1 year domain + hosting.', 30000, 1999, 'one_time_plus_monthly', '{presence,noWebsite,automation}', 40),
    ('tech', 'Custom Business Dashboard', 'Tailored dashboard with secure team login, data management, search/filters, visual reports/charts, custom workflows, and initial infrastructure setup.', 35000, 1999, 'one_time_plus_monthly', '{automation,noBookingSystem}', 50),
    ('tech', 'Business Process Automation', 'Automated workflows, system integrations, automated notifications, and data synchronization across systems to reduce manual work.', 50000, 1999, 'one_time_plus_monthly', '{automation,noBookingSystem,noEmailCapture,noLeadForm}', 60),
    ('tech', 'Custom AI Solutions', 'AI chatbot/assistant, AI-powered workflows, integration with business knowledge bases, custom AI interface, and system integrations.', 75000, 1999, 'one_time_plus_monthly', '{chatbot,noChat}', 70),

    ('marketing', 'Presence', '8 social media posts across Instagram/Facebook/LinkedIn, content planning, captions, hashtags, and a monthly performance update.', NULL, 10000, 'monthly', '{ads,inactiveSocial}', 80),
    ('marketing', 'Growth', '12 social media posts, 2 edited reels (from provided footage), content strategy & calendar, full day-to-day management, ad campaign setup/optimization, plus ₹5,000 initial ad spend.', NULL, 25000, 'monthly', '{ads,inactiveSocial}', 90),

    ('addon', 'Professional Photo & Video Shoot', 'Custom quote based on location, duration, and requirements (product, business, or social media shoots with editing).', NULL, NULL, 'custom_quote', '{}', 100),
    ('addon', 'Influencer Marketing', 'Custom quote based on target audience, follower range, platform, and campaign scope.', NULL, NULL, 'custom_quote', '{}', 110),
    ('addon', 'Additional Ad Budget', 'Flexible ad spend scaling for active campaigns as required.', NULL, NULL, 'custom_quote', '{}', 120),
    ('addon', 'Google Business Profile', 'Setup or optimization for Google Maps presence, photos, services, and business information.', 2000, NULL, 'one_time', '{reputation,fewReviews,lowRating,missingGBPFields}', 130),
    ('addon', 'Brand Identity & Design', 'Logo design, brand colors, fonts, basic guidelines, business cards, brochures, and menus.', 6000, NULL, 'one_time', '{}', 140),

    ('support', 'Support & Maintenance', 'Optional for websites, required for system-based services. Covers bug fixes, basic system monitoring, minor configuration changes, API/service support, and priority assistance (new features quoted separately).', NULL, 1999, 'monthly', '{}', 150)
ON CONFLICT (name) DO NOTHING;
