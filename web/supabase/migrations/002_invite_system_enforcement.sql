-- =============================================
-- Migration: Invite System Enforcement
-- Adds seat limits and enforces invite creation rules
-- =============================================

-- Add max_sales_seats to organizations (NULL = unlimited)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS max_sales_seats INTEGER DEFAULT NULL;

-- Drop the old create_invite function
DROP FUNCTION IF EXISTS create_invite(UUID, user_role, INTEGER);

-- Create new invite function with role enforcement
CREATE OR REPLACE FUNCTION create_invite(
    p_organization_id UUID,
    p_role user_role DEFAULT 'sales',
    p_expires_in_days INTEGER DEFAULT 7
)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_caller_role user_role;
    v_caller_org UUID;
    v_current_sales_count INTEGER;
    v_max_seats INTEGER;
    v_pending_invites INTEGER;
BEGIN
    -- Get caller's role and organization
    SELECT role, organization_id INTO v_caller_role, v_caller_org
    FROM profiles WHERE id = auth.uid();

    -- Superadmin rules:
    -- Can ONLY create org_admin invites (not sales, not superadmin)
    IF v_caller_role = 'superadmin' THEN
        IF p_role != 'org_admin' THEN
            RAISE EXCEPTION 'Superadmins can only create org_admin invites. Use the organization admin to invite sales reps.';
        END IF;
        IF p_organization_id IS NULL THEN
            RAISE EXCEPTION 'Organization ID is required for org_admin invites';
        END IF;
    
    -- Org admin rules:
    -- Can ONLY create sales invites for their own organization
    ELSIF v_caller_role = 'org_admin' THEN
        IF p_role != 'sales' THEN
            RAISE EXCEPTION 'Organization admins can only invite sales reps';
        END IF;
        IF p_organization_id != v_caller_org THEN
            RAISE EXCEPTION 'You can only invite users to your own organization';
        END IF;
        
        -- Check seat limits
        SELECT max_sales_seats INTO v_max_seats
        FROM organizations WHERE id = p_organization_id;
        
        IF v_max_seats IS NOT NULL THEN
            -- Count current sales reps
            SELECT COUNT(*) INTO v_current_sales_count
            FROM profiles 
            WHERE organization_id = p_organization_id AND role = 'sales';
            
            -- Count pending (unused) sales invites
            SELECT COUNT(*) INTO v_pending_invites
            FROM invite_tokens 
            WHERE organization_id = p_organization_id 
              AND role = 'sales'
              AND used_by IS NULL 
              AND expires_at > NOW();
            
            IF (v_current_sales_count + v_pending_invites) >= v_max_seats THEN
                RAISE EXCEPTION 'Sales seat limit reached (% of % seats used, % pending invites)', 
                    v_current_sales_count, v_max_seats, v_pending_invites;
            END IF;
        END IF;
    
    -- Sales reps cannot create invites
    ELSE
        RAISE EXCEPTION 'You do not have permission to create invites';
    END IF;

    -- Generate the token
    v_token := replace(replace(generate_invite_token(), '/', '_'), '+', '-');
    
    -- Insert the invite
    INSERT INTO invite_tokens (token, organization_id, role, created_by, expires_at)
    VALUES (v_token, p_organization_id, p_role, auth.uid(), NOW() + (p_expires_in_days || ' days')::INTERVAL);
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get remaining seats for an organization
CREATE OR REPLACE FUNCTION get_remaining_seats(p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_max_seats INTEGER;
    v_current_sales INTEGER;
    v_pending_invites INTEGER;
BEGIN
    SELECT max_sales_seats INTO v_max_seats
    FROM organizations WHERE id = p_organization_id;
    
    IF v_max_seats IS NULL THEN
        RETURN jsonb_build_object(
            'unlimited', true,
            'max_seats', NULL,
            'used_seats', 0,
            'pending_invites', 0,
            'remaining', NULL
        );
    END IF;
    
    SELECT COUNT(*) INTO v_current_sales
    FROM profiles 
    WHERE organization_id = p_organization_id AND role = 'sales';
    
    SELECT COUNT(*) INTO v_pending_invites
    FROM invite_tokens 
    WHERE organization_id = p_organization_id 
      AND role = 'sales'
      AND used_by IS NULL 
      AND expires_at > NOW();
    
    RETURN jsonb_build_object(
        'unlimited', false,
        'max_seats', v_max_seats,
        'used_seats', v_current_sales,
        'pending_invites', v_pending_invites,
        'remaining', GREATEST(0, v_max_seats - v_current_sales - v_pending_invites)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update seat limit (superadmin only)
CREATE OR REPLACE FUNCTION update_org_seat_limit(
    p_organization_id UUID,
    p_max_seats INTEGER
)
RETURNS VOID AS $$
BEGIN
    IF get_user_role() != 'superadmin' THEN
        RAISE EXCEPTION 'Only superadmins can update seat limits';
    END IF;
    
    UPDATE organizations 
    SET max_sales_seats = p_max_seats,
        updated_at = NOW()
    WHERE id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Special bootstrap function for creating superadmin invite
-- This can only be called if there are NO superadmins in the system
CREATE OR REPLACE FUNCTION create_superadmin_bootstrap_invite()
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_superadmin_count INTEGER;
BEGIN
    -- Check if any superadmins exist
    SELECT COUNT(*) INTO v_superadmin_count
    FROM profiles WHERE role = 'superadmin';
    
    IF v_superadmin_count > 0 THEN
        RAISE EXCEPTION 'Bootstrap invite cannot be created - superadmin already exists';
    END IF;
    
    -- Generate token
    v_token := replace(replace(generate_invite_token(), '/', '_'), '+', '-');
    
    -- Create invite for superadmin role with no organization
    INSERT INTO invite_tokens (token, organization_id, role, created_by, expires_at)
    VALUES (v_token, NULL, 'superadmin', NULL, NOW() + INTERVAL '24 hours');
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

