import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Toaster } from '@/components/ui/sonner';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user profile with admin client (bypasses RLS)
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*, organization:organizations(*)')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'superadmin') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <AdminSidebar user={user} profile={profile} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      <Toaster position="top-right" theme="dark" />
    </div>
  );
}

