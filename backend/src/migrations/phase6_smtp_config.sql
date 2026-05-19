-- Migration Phase 6: Per-Workspace SMTP Configuration
-- Add smtp_password to support Gmail App Passwords and other SMTP senders
ALTER TABLE companies ADD COLUMN IF NOT EXISTS smtp_password VARCHAR(500);
