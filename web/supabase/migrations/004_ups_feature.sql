-- =============================================
-- UPS SMS Alert Feature Migration
-- Creates tables for team members, locations, and alert logs
-- =============================================

-- =============================================
-- UPS_TEAM_MEMBERS TABLE
-- Sales team members who can receive UP alerts
-- =============================================
CREATE TABLE ups_team_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    display_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure unique phone per organization
    UNIQUE(organization_id, phone_number)
);

-- =============================================
-- UPS_LOCATIONS TABLE
-- Location presets for alerts
-- =============================================
CREATE TABLE ups_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    display_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure unique location name per organization
    UNIQUE(organization_id, name)
);

-- =============================================
-- UPS_ALERT_LOGS TABLE
-- Audit trail for sent alerts
-- =============================================
CREATE TABLE ups_alert_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID REFERENCES ups_locations(id) ON DELETE SET NULL,
    location_name TEXT NOT NULL,
    sent_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    recipient_count INTEGER NOT NULL,
    recipients JSONB NOT NULL,
    message_content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_ups_team_members_org ON ups_team_members(organization_id);
CREATE INDEX idx_ups_team_members_active ON ups_team_members(organization_id, is_active);

CREATE INDEX idx_ups_locations_org ON ups_locations(organization_id);
CREATE INDEX idx_ups_locations_active ON ups_locations(organization_id, is_active);

CREATE INDEX idx_ups_alert_logs_org ON ups_alert_logs(organization_id);
CREATE INDEX idx_ups_alert_logs_created ON ups_alert_logs(created_at DESC);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE ups_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ups_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ups_alert_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
CREATE TRIGGER update_ups_team_members_updated_at
    BEFORE UPDATE ON ups_team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ups_locations_updated_at
    BEFORE UPDATE ON ups_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS POLICIES - UPS_TEAM_MEMBERS
-- =============================================
CREATE POLICY "Superadmins can manage all ups_team_members" ON ups_team_members
    FOR ALL USING (get_user_role() = 'superadmin');

CREATE POLICY "Org admins can manage their ups_team_members" ON ups_team_members
    FOR ALL USING (
        get_user_role() = 'org_admin' 
        AND organization_id = get_user_organization()
    );

-- =============================================
-- RLS POLICIES - UPS_LOCATIONS
-- =============================================
CREATE POLICY "Superadmins can manage all ups_locations" ON ups_locations
    FOR ALL USING (get_user_role() = 'superadmin');

CREATE POLICY "Org admins can manage their ups_locations" ON ups_locations
    FOR ALL USING (
        get_user_role() = 'org_admin' 
        AND organization_id = get_user_organization()
    );

-- =============================================
-- RLS POLICIES - UPS_ALERT_LOGS
-- =============================================
CREATE POLICY "Superadmins can view all ups_alert_logs" ON ups_alert_logs
    FOR SELECT USING (get_user_role() = 'superadmin');

CREATE POLICY "Org admins can view their ups_alert_logs" ON ups_alert_logs
    FOR SELECT USING (
        get_user_role() = 'org_admin' 
        AND organization_id = get_user_organization()
    );

CREATE POLICY "Admins can insert ups_alert_logs" ON ups_alert_logs
    FOR INSERT WITH CHECK (
        get_user_role() IN ('superadmin', 'org_admin')
        AND (get_user_role() = 'superadmin' OR organization_id = get_user_organization())
    );

-- =============================================
-- DEFAULT LOCATIONS SEEDING FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION seed_default_ups_locations(org_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ups_locations (organization_id, name, display_order) VALUES
        (org_id, 'Used Lot', 1),
        (org_id, 'New Lot', 2),
        (org_id, 'Service Drive', 3),
        (org_id, 'Showroom', 4)
    ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGER TO AUTO-SEED LOCATIONS ON ORG CREATE
-- =============================================
CREATE OR REPLACE FUNCTION trigger_seed_default_ups_locations()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM seed_default_ups_locations(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organization_created_seed_ups_locations
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_seed_default_ups_locations();

-- =============================================
-- SEED DEFAULT LOCATIONS FOR EXISTING ORGS
-- =============================================
DO $$
DECLARE
    org_record RECORD;
BEGIN
    FOR org_record IN SELECT id FROM organizations LOOP
        PERFORM seed_default_ups_locations(org_record.id);
    END LOOP;
END $$;
