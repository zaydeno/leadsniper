import { createClient } from '@/lib/supabase/server';
import { MissedCallsView } from '@/components/calls/missed-calls-view';

export default async function CallsPage() {
  const supabase = await createClient();

  const { data: missedCalls } = await supabase
    .from('missed_calls')
    .select('*')
    .order('created_at', { ascending: false });

  return <MissedCallsView initialCalls={missedCalls || []} />;
}


