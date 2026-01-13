-- =============================================
-- Webhook Enhancements Migration
-- Adds support for all httpSMS webhook events
-- =============================================

-- Add new status values to message_status enum
ALTER TYPE message_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE message_status ADD VALUE IF NOT EXISTS 'expired';

-- =============================================
-- PHONE STATUS TABLE
-- Track httpSMS phone heartbeat status
-- =============================================
CREATE TABLE IF NOT EXISTS phone_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT TRUE NOT NULL,
    last_heartbeat_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    went_offline_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for phone status lookups
CREATE INDEX IF NOT EXISTS idx_phone_status_phone_number ON phone_status(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_status_organization ON phone_status(organization_id);

-- Enable RLS
ALTER TABLE phone_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for phone_status
CREATE POLICY "Superadmins can view all phone status" ON phone_status
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY "Org members can view their phone status" ON phone_status
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

-- =============================================
-- WEBHOOK SIGNING KEYS TABLE
-- Store signing keys per organization for JWT verification
-- =============================================
CREATE TABLE IF NOT EXISTS webhook_signing_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    signing_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for signing key lookups
CREATE INDEX IF NOT EXISTS idx_webhook_signing_keys_org ON webhook_signing_keys(organization_id);

-- Enable RLS
ALTER TABLE webhook_signing_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook_signing_keys
CREATE POLICY "Superadmins can manage all signing keys" ON webhook_signing_keys
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

CREATE POLICY "Org admins can manage their signing keys" ON webhook_signing_keys
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('superadmin', 'org_admin')
        )
    );

-- =============================================
-- ADD httpsms_webhook_signing_key TO ORGANIZATIONS
-- For simpler setup, store signing key directly on org
-- =============================================
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS httpsms_webhook_signing_key TEXT;

