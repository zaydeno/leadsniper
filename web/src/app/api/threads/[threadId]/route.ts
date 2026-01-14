import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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


