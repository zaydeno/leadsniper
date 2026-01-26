import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

// GET /api/ups/team-members - Get all UPS team members for the organization
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile and verify role
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only org_admin and superadmin can access UPS features
    if (!['superadmin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build query based on role
    let query = adminClient
      .from('ups_team_members')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (profile.role === 'org_admin') {
      // Org admins can only see their organization's team members
      query = query.eq('organization_id', profile.organization_id);
    }
    // Superadmins see all team members

    const { data: members, error: membersError } = await query;

    if (membersError) {
      console.error('Error fetching UPS team members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
    }

    return NextResponse.json({ members: members || [] });

  } catch (error) {
    console.error('UPS team members GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/ups/team-members - Add a new UPS team member
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile and verify role
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only org_admin and superadmin can add team members
    if (!['superadmin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { name, phone_number, organization_id } = body;

    // Validate required fields
    if (!name || !phone_number) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone_number' },
        { status: 400 }
      );
    }

    // Determine which organization to add the member to
    let targetOrgId = profile.organization_id;
    
    if (profile.role === 'superadmin' && organization_id) {
      // Superadmins can specify an organization
      targetOrgId = organization_id;
    }

    if (!targetOrgId) {
      return NextResponse.json(
        { error: 'No organization specified' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone_number);

    // Get the next display order
    const { data: maxOrderResult } = await adminClient
      .from('ups_team_members')
      .select('display_order')
      .eq('organization_id', targetOrgId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextDisplayOrder = (maxOrderResult?.display_order || 0) + 1;

    // Insert the new team member
    const { data: member, error: insertError } = await adminClient
      .from('ups_team_members')
      .insert({
        organization_id: targetOrgId,
        name: name.trim(),
        phone_number: normalizedPhone,
        display_order: nextDisplayOrder,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating UPS team member:', insertError);
      
      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A team member with this phone number already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 });
    }

    return NextResponse.json({ member }, { status: 201 });

  } catch (error) {
    console.error('UPS team members POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
