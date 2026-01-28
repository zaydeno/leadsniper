-- =============================================
-- LeadSniper Full Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE user_role AS ENUM ('superadmin', 'org_admin', 'sales');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_status AS ENUM ('sent', 'received', 'failed', 'pending');

-- =============================================
-- ORGANIZATIONS TABLE
-- =============================================
CREATE TABLE organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    httpsms_api_key TEXT,
    httpsms_from_number TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- PROFILES TABLE (extends Supabase Auth)
-- =============================================
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    role user_role DEFAULT 'sales' NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    notification_number TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INVITE TOKENS TABLE
-- =============================================
CREATE TABLE invite_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role user_role DEFAULT 'sales' NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- THREADS TABLE
-- =============================================
CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    contact_name TEXT,
    contact_phone TEXT NOT NULL,
    last_message_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_message_preview TEXT,
    unread_count INTEGER DEFAULT 0 NOT NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- MESSAGES TABLE
-- =============================================
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    content TEXT NOT NULL,
    direction message_direction NOT NULL,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    status message_status DEFAULT 'pending' NOT NULL,
    httpsms_id TEXT,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- MISSED CALLS TABLE
-- =============================================
CREATE TABLE missed_calls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
    acknowledged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_profiles_organization ON profiles(organization_id);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_organization ON messages(organization_id);
CREATE INDEX idx_threads_last_message_at ON threads(last_message_at DESC);
CREATE INDEX idx_threads_organization ON threads(organization_id);
CREATE INDEX idx_missed_calls_created_at ON missed_calls(created_at DESC);
CREATE INDEX idx_missed_calls_organization ON missed_calls(organization_id);
CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE missed_calls ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Get current user's organization
CREATE OR REPLACE FUNCTION get_user_organization()
RETURNS UUID AS $$
    SELECT organization_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, username, full_name, role, organization_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'sales'),
        (NEW.raw_user_meta_data->>'organization_id')::UUID
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update thread on new message
CREATE OR REPLACE FUNCTION update_thread_on_message()
RETURNS TRIGGER AS $$
DECLARE
    contact_num TEXT;
BEGIN
    IF NEW.direction = 'inbound' THEN
        contact_num := NEW.from_number;
    ELSE
        contact_num := NEW.to_number;
    END IF;
    
    INSERT INTO threads (id, contact_phone, last_message_at, last_message_preview, unread_count, organization_id)
    VALUES (
        NEW.thread_id,
        contact_num,
        NEW.created_at,
        LEFT(NEW.content, 100),
        CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END,
        NEW.organization_id
    )
    ON CONFLICT (id) DO UPDATE SET
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        unread_count = CASE 
            WHEN NEW.direction = 'inbound' THEN threads.unread_count + 1 
            ELSE threads.unread_count 
        END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate invite token
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT AS $$
    SELECT encode(gen_random_bytes(24), 'base64');
$$ LANGUAGE sql;

-- Create an invite
CREATE OR REPLACE FUNCTION create_invite(
    p_organization_id UUID,
    p_role user_role DEFAULT 'sales',
    p_expires_in_days INTEGER DEFAULT 7
)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
BEGIN
    v_token := replace(replace(generate_invite_token(), '/', '_'), '+', '-');
    
    INSERT INTO invite_tokens (token, organization_id, role, created_by, expires_at)
    VALUES (v_token, p_organization_id, p_role, auth.uid(), NOW() + (p_expires_in_days || ' days')::INTERVAL);
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_on_message();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS POLICIES
-- =============================================

-- ORGANIZATIONS
CREATE POLICY "Superadmins can manage all organizations" ON organizations
    FOR ALL USING (get_user_role() = 'superadmin');

CREATE POLICY "Users can view their organization" ON organizations
    FOR SELECT USING (id = get_user_organization());

-- PROFILES
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Superadmins can view all profiles" ON profiles
    FOR SELECT USING (get_user_role() = 'superadmin');

CREATE POLICY "Superadmins can manage all profiles" ON profiles
    FOR ALL USING (get_user_role() = 'superadmin');

CREATE POLICY "Org admins can view org profiles" ON profiles
    FOR SELECT USING (
        get_user_role() = 'org_admin' 
        AND organization_id = get_user_organization()
    );

-- MESSAGES
CREATE POLICY "Superadmins can view all messages" ON messages
    FOR SELECT USING (get_user_role() = 'superadmin');

CREATE POLICY "Org admins can view org messages" ON messages
    FOR SELECT USING (
        get_user_role() = 'org_admin' 
        AND organization_id = get_user_organization()
    );

CREATE POLICY "Sales can view org messages" ON messages
    FOR SELECT USING (
        get_user_role() = 'sales' 
        AND organization_id = get_user_organization()
    );

CREATE POLICY "Users can insert org messages" ON messages
    FOR INSERT WITH CHECK (
        organization_id = get_user_organization()
        OR get_user_role() = 'superadmin'
    );

CREATE POLICY "Users can update org messages" ON messages
    FOR UPDATE USING (
        organization_id = get_user_organization()
        OR get_user_role() = 'superadmin'
    );

-- THREADS
CREATE POLICY "Superadmins can view all threads" ON threads
    FOR SELECT USING (get_user_role() = 'superadmin');

CREATE POLICY "Org users can view org threads" ON threads
    FOR SELECT USING (organization_id = get_user_organization());

CREATE POLICY "Users can manage org threads" ON threads
    FOR ALL USING (
        organization_id = get_user_organization()
        OR get_user_role() = 'superadmin'
    );

-- MISSED CALLS
CREATE POLICY "Superadmins can view all missed calls" ON missed_calls
    FOR SELECT USING (get_user_role() = 'superadmin');

CREATE POLICY "Org users can view org missed calls" ON missed_calls
    FOR SELECT USING (organization_id = get_user_organization());

CREATE POLICY "Users can manage org missed calls" ON missed_calls
    FOR ALL USING (
        organization_id = get_user_organization()
        OR get_user_role() = 'superadmin'
    );

-- INVITE TOKENS
CREATE POLICY "Superadmins can manage all invites" ON invite_tokens
    FOR ALL USING (get_user_role() = 'superadmin');

CREATE POLICY "Org admins can manage org invites" ON invite_tokens
    FOR ALL USING (
        get_user_role() = 'org_admin' 
        AND organization_id = get_user_organization()
    );

CREATE POLICY "Anyone can validate invite tokens" ON invite_tokens
    FOR SELECT USING (
        used_by IS NULL 
        AND expires_at > NOW()
    );

-- =============================================
-- ENABLE REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE threads;
ALTER PUBLICATION supabase_realtime ADD TABLE missed_calls;

-- =============================================
-- CREATE SYSTEM ORGANIZATION
-- =============================================
INSERT INTO organizations (id, name, slug) 
VALUES ('00000000-0000-0000-0000-000000000000', 'System', 'system')
ON CONFLICT (slug) DO NOTHING;





