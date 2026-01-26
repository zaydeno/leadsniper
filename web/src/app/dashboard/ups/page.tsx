import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { UpsAlertPanel } from '@/components/ups/ups-alert-panel';
import { UpsTeamMember, UpsLocation } from '@/lib/types';

export const metadata = {
  title: 'UPS Alert | LeadSniper',
  description: 'Send location alerts to your team',
};

export default async function UpsPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Verify authentication
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();

  // Only org_admin and superadmin can access UPS features
  if (!profile || !['superadmin', 'org_admin'].includes(profile.role)) {
    redirect('/dashboard');
  }

  // Fetch team members
  let teamMembersQuery = adminClient
    .from('ups_team_members')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (profile.role === 'org_admin') {
    teamMembersQuery = teamMembersQuery.eq('organization_id', profile.organization_id);
  }

  const { data: teamMembers } = await teamMembersQuery;

  // Fetch locations
  let locationsQuery = adminClient
    .from('ups_locations')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (profile.role === 'org_admin') {
    locationsQuery = locationsQuery.eq('organization_id', profile.organization_id);
  }

  const { data: locations } = await locationsQuery;

  return (
    <div className="h-full bg-[#0a0a0f] overflow-y-auto">
      <UpsAlertPanel
        initialTeamMembers={(teamMembers as UpsTeamMember[]) || []}
        initialLocations={(locations as UpsLocation[]) || []}
      />
    </div>
  );
}
