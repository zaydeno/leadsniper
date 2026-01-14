import { createClient } from '@/lib/supabase/server';
import { AllMessagesView } from '@/components/admin/all-messages-view';

export default async function AdminMessagesPage() {
  const supabase = await createClient();

  const { data: threads } = await supabase
    .from('threads')
    .select('*, organization:organizations(name, slug)')
    .order('last_message_at', { ascending: false })
    .limit(100);

  const { data: organizations } = await supabase
    .from('organizations')
    .select('*')
    .order('name');

  return (
    <AllMessagesView 
      initialThreads={threads || []} 
      organizations={organizations || []}
    />
  );
}


