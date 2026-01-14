import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/threads/[threadId]/reassign - Reassign a thread to a different user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only org_admin and superadmin can reassign
    if (profile.role !== 'superadmin' && profile.role !== 'org_admin') {
      return NextResponse.json({ error: 'Unauthorized to reassign' }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify the target user exists and is in the same org (for org_admin)
    const { data: targetUser, error: targetError } = await adminClient
      .from('profiles')
      .select('id, organization_id, full_name')
      .eq('id', userId)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Org admins can only reassign to their own org members
    if (profile.role === 'org_admin' && targetUser.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Cannot reassign to user outside your organization' }, { status: 403 });
    }

    // Get the thread to verify org access
    const { data: thread, error: threadError } = await adminClient
      .from('threads')
      .select('id, organization_id')
      .eq('id', threadId)
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Org admins can only reassign threads in their org
    if (profile.role === 'org_admin' && thread.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Cannot reassign thread outside your organization' }, { status: 403 });
    }

    // Update the thread assignment
    const { error: updateError } = await adminClient
      .from('threads')
      .update({ 
        assigned_to: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);

    if (updateError) {
      console.error('Error reassigning thread:', updateError);
      return NextResponse.json({ error: 'Failed to reassign thread' }, { status: 500 });
    }

    // Also update all messages in the thread to be assigned to the new user
    await adminClient
      .from('messages')
      .update({ assigned_to: userId })
      .eq('thread_id', threadId);

    return NextResponse.json({ 
      success: true,
      assigned_to: userId,
      assigned_to_name: targetUser.full_name
    });

  } catch (error) {
    console.error('Reassign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


