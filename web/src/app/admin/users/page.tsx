import { createAdminClient } from '@/lib/supabase/admin';
import { UsersManager } from '@/components/admin/users-manager';

export default async function UsersPage() {
  // Use admin client to bypass RLS
  const adminClient = createAdminClient();

  const { data: users } = await adminClient
    .from('profiles')
    .select('*, organization:organizations(*)')
    .order('created_at', { ascending: false });

  const { data: organizations } = await adminClient
    .from('organizations')
    .select('*')
    .order('name');

  return (
    <UsersManager 
      initialUsers={users || []} 
      organizations={organizations || []}
    />
  );
}

