import { createAdminClient } from '@/lib/supabase/admin';
import { CampaignsManager } from '@/components/admin/campaigns-manager';

export default async function CampaignsPage() {
  const adminClient = createAdminClient();

  // Fetch campaigns with organization info
  const { data: campaigns } = await adminClient
    .from('campaigns')
    .select('*, organization:organizations(name)')
    .order('created_at', { ascending: false });

  // Fetch all organizations
  const { data: organizations } = await adminClient
    .from('organizations')
    .select('*')
    .eq('is_active', true)
    .order('name');

  // Fetch all users (for assignment)
  const { data: users } = await adminClient
    .from('profiles')
    .select('*')
    .order('full_name');

  return (
    <CampaignsManager 
      initialCampaigns={campaigns || []} 
      organizations={organizations || []}
      users={users || []}
    />
  );
}

