import { createClient } from '@/lib/supabase/server';
import { OrganizationsManager } from '@/components/admin/organizations-manager';

export default async function OrganizationsPage() {
  const supabase = await createClient();

  const { data: organizations } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });

  return <OrganizationsManager initialOrganizations={organizations || []} />;
}


