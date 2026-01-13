import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { InboxView } from '@/components/inbox/inbox-view';
import { Thread } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Fetch user profile for role-based features
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*, organization:organizations(*)')
    .eq('id', user?.id)
    .single();

  // Fetch threads based on user role
  let threads: Thread[] = [];

  if (profile?.role === 'superadmin') {
    // Superadmin sees ALL threads
    const { data } = await adminClient
      .from('threads')
      .select('*')
      .order('last_message_at', { ascending: false });
    threads = data || [];
  } else if (profile?.role === 'org_admin') {
    // Org Admin sees all threads for their organization
    const { data } = await adminClient
      .from('threads')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('last_message_at', { ascending: false });
    threads = data || [];
  } else {
    // Sales Rep sees only threads assigned to them
    // First get messages assigned to this user, then get their threads
    const { data: userMessages } = await adminClient
      .from('messages')
      .select('thread_id')
      .eq('assigned_to', user?.id);
    
    const threadIds = [...new Set((userMessages || []).map(m => m.thread_id))];
    
    if (threadIds.length > 0) {
      const { data } = await adminClient
        .from('threads')
        .select('*')
        .in('id', threadIds)
        .order('last_message_at', { ascending: false });
      threads = data || [];
    }
  }

  return (
    <InboxView 
      initialThreads={threads} 
      userProfile={profile}
    />
  );
}
