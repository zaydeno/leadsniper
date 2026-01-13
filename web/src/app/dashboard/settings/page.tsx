import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/settings/settings-form';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use admin client to bypass RLS for profile fetch
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="h-screen overflow-auto">
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-500 mb-8">Manage your account and notification preferences</p>
        
        <SettingsForm profile={profile} userEmail={user.email || ''} />
      </div>
    </div>
  );
}

