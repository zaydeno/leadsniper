import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, Webhook } from 'lucide-react';

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Use admin client to bypass RLS
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single();

  return (
    <div className="h-screen overflow-auto p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Settings</h1>
        <p className="text-gray-500 mb-8">System configuration and information</p>

        {/* Admin Info */}
        <Card className="bg-[#12121a] border-gray-800 mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-white">Super Admin Account</CardTitle>
                <CardDescription className="text-gray-500">
                  Your administrator credentials
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Username</span>
              <span className="text-white font-mono">{profile?.username}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Full Name</span>
              <span className="text-white">{profile?.full_name || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Role</span>
              <Badge className="bg-purple-500/10 text-purple-400">Super Admin</Badge>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="bg-[#12121a] border-gray-800 mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-white">System Information</CardTitle>
                <CardDescription className="text-gray-500">
                  Database and environment details
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Database</span>
              <Badge className="bg-emerald-500/10 text-emerald-400">Supabase PostgreSQL</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Auth Provider</span>
              <span className="text-white">Supabase Auth</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">SMS Provider</span>
              <span className="text-white">httpsms.com</span>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Info */}
        <Card className="bg-[#12121a] border-gray-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Webhook className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-white">Webhook Configuration</CardTitle>
                <CardDescription className="text-gray-500">
                  Configure these in your httpsms dashboard
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-3 rounded-lg bg-gray-800/50 font-mono text-sm text-gray-300 break-all">
              {typeof window !== 'undefined' 
                ? `${window.location.origin}/api/webhooks/httpsms`
                : 'https://your-domain.com/api/webhooks/httpsms'
              }
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Events: message.phone.received, message.phone.sent, call.missed
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

