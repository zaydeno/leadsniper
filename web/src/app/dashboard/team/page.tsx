import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { TeamManager } from '@/components/dashboard/team-manager';

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Use admin client to bypass RLS for profile fetch
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*, organization:organizations(*)')
    .eq('id', user.id)
    .single();

  // Only org_admin can access this page
  if (!profile || profile.role !== 'org_admin') {
    redirect('/dashboard');
  }

  // Get team members
  const { data: teamMembers } = await adminClient
    .from('profiles')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });

  return (
    <TeamManager 
      profile={profile}
      teamMembers={teamMembers || []}
    />
  );
}

