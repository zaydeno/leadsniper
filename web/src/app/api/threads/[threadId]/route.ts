import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ThreadFlag } from '@/lib/types';

const VALID_FLAGS: ThreadFlag[] = ['no_response', 'active', 'booked', 'dead'];

// PATCH /api/threads/[threadId] - Update thread flag
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const body = await request.json();
    const { flag } = body;

    // Validate flag
    if (!flag || !VALID_FLAGS.includes(flag)) {
      return NextResponse.json(
        { error: 'Invalid flag. Must be one of: no_response, active, booked, dead' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get the thread to verify access
    const { data: thread, error: threadError } = await adminClient
      .from('threads')
      .select('id, organization_id, assigned_to')
      .eq('id', threadId)
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Access control:
    // - Superadmin can change any thread
    // - Org admin can change any thread in their org
    // - Sales can only change threads assigned to them
    const isSuperadmin = profile.role === 'superadmin';
    const isOrgAdmin = profile.role === 'org_admin';
    const isOwnThread = thread.assigned_to === user.id;
    const isSameOrg = thread.organization_id === profile.organization_id;

    if (!isSuperadmin && !isOrgAdmin && !isOwnThread) {
      return NextResponse.json(
        { error: 'You can only change the flag on threads assigned to you' },
        { status: 403 }
      );
    }

    if (!isSuperadmin && !isSameOrg) {
      return NextResponse.json(
        { error: 'Cannot modify thread outside your organization' },
        { status: 403 }
      );
    }

    // Update the thread flag
    const { data: updatedThread, error: updateError } = await adminClient
      .from('threads')
      .update({ 
        flag,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating thread flag:', updateError);
      return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 });
    }

    return NextResponse.json({ success: true, thread: updatedThread });

  } catch (error) {
    console.error('Update thread flag error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/threads/[threadId] - Delete a thread and all its messages
export async function DELETE(
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

    // Get user's profile to check org
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get the thread to verify access
    const { data: thread, error: threadError } = await adminClient
      .from('threads')
      .select('id, organization_id')
      .eq('id', threadId)
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // For non-superadmin, verify org membership
    if (profile.role !== 'superadmin' && thread.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Cannot delete thread outside your organization' }, { status: 403 });
    }

    // Delete all messages in the thread first
    const { error: messagesError } = await adminClient
      .from('messages')
      .delete()
      .eq('thread_id', threadId);

    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
      return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
    }

    // Delete the thread
    const { error: deleteError } = await adminClient
      .from('threads')
      .delete()
      .eq('id', threadId);

    if (deleteError) {
      console.error('Error deleting thread:', deleteError);
      return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete thread error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}




