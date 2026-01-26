import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

interface RouteParams {
  params: Promise<{ memberId: string }>;
}

// PUT /api/ups/team-members/[memberId] - Update a UPS team member
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params;
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

    // Only org_admin and superadmin can update team members
    if (!['superadmin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the existing team member
    const { data: existingMember, error: fetchError } = await adminClient
      .from('ups_team_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (fetchError || !existingMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Org admins can only update members in their organization
    if (profile.role === 'org_admin' && existingMember.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { name, phone_number, is_active, display_order } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    
    if (phone_number !== undefined) {
      updateData.phone_number = normalizePhoneNumber(phone_number);
    }
    
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }
    
    if (display_order !== undefined) {
      updateData.display_order = display_order;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update the team member
    const { data: member, error: updateError } = await adminClient
      .from('ups_team_members')
      .update(updateData)
      .eq('id', memberId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating UPS team member:', updateError);
      
      // Check for unique constraint violation
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'A team member with this phone number already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 });
    }

    return NextResponse.json({ member });

  } catch (error) {
    console.error('UPS team member PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/ups/team-members/[memberId] - Delete a UPS team member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { memberId } = await params;
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

    // Only org_admin and superadmin can delete team members
    if (!['superadmin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the existing team member
    const { data: existingMember, error: fetchError } = await adminClient
      .from('ups_team_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (fetchError || !existingMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Org admins can only delete members in their organization
    if (profile.role === 'org_admin' && existingMember.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the team member
    const { error: deleteError } = await adminClient
      .from('ups_team_members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      console.error('Error deleting UPS team member:', deleteError);
      return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('UPS team member DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
