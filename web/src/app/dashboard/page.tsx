import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { InboxView } from '@/components/inbox/inbox-view';

export default async function DashboardPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Fetch threads ordered by last message
  const { data: threads } = await adminClient
    .from('threads')
    .select('*')
    .order('last_message_at', { ascending: false });

  // Fetch user profile for role-based features
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single();

  return (
    <InboxView 
      initialThreads={threads || []} 
      userProfile={profile}
    />
  );
}

