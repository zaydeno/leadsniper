import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// DELETE /api/team/[userId] - Delete a team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get caller's profile
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'org_admin') {
      return NextResponse.json({ error: 'Only org admins can delete team members' }, { status: 403 });
    }

    // Get target user's profile
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', userId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ensure target is in same org
    if (targetProfile.organization_id !== callerProfile.organization_id) {
      return NextResponse.json({ error: 'User not in your organization' }, { status: 403 });
    }

    // Can't delete yourself
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    // Can only delete sales reps (not other admins)
    if (targetProfile.role !== 'sales') {
      return NextResponse.json({ error: 'Can only delete sales reps' }, { status: 403 });
    }

    // Delete the profile first (due to foreign key)
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Profile delete error:', profileError);
      return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
    }

    // Delete from auth.users
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Auth delete error:', authError);
      // Profile already deleted, log error but return success
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/team/[userId]/reset-password - Generate password reset link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get caller's profile
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'org_admin') {
      return NextResponse.json({ error: 'Only org admins can reset passwords' }, { status: 403 });
    }

    // Get target user's profile and email
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role, organization_id, email')
      .eq('id', userId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ensure target is in same org
    if (targetProfile.organization_id !== callerProfile.organization_id) {
      return NextResponse.json({ error: 'User not in your organization' }, { status: 403 });
    }

    // Can only reset sales reps (not other admins)
    if (targetProfile.role !== 'sales') {
      return NextResponse.json({ error: 'Can only reset passwords for sales reps' }, { status: 403 });
    }

    // Generate password reset link using admin API
    // Get the origin from the request headers for the redirect
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: targetProfile.email,
      options: {
        redirectTo: `${origin}/reset-password`,
      },
    });

    if (error) {
      console.error('Generate link error:', error);
      return NextResponse.json({ error: 'Failed to generate reset link' }, { status: 500 });
    }

    // Return the action link
    return NextResponse.json({ 
      resetLink: data.properties.action_link,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

