import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, MessageSquare, Phone } from 'lucide-react';

export default async function AdminDashboard() {
  // Use admin client to bypass RLS
  const adminClient = createAdminClient();

  // Fetch stats
  const [orgsResult, usersResult, messagesResult, callsResult] = await Promise.all([
    adminClient.from('organizations').select('id', { count: 'exact' }),
    adminClient.from('profiles').select('id', { count: 'exact' }),
    adminClient.from('messages').select('id', { count: 'exact' }),
    adminClient.from('missed_calls').select('id', { count: 'exact' }).eq('acknowledged', false),
  ]);

  const stats = [
    {
      name: 'Organizations',
      value: orgsResult.count || 0,
      icon: Building2,
      color: 'purple',
    },
    {
      name: 'Total Users',
      value: usersResult.count || 0,
      icon: Users,
      color: 'blue',
    },
    {
      name: 'Total Messages',
      value: messagesResult.count || 0,
      icon: MessageSquare,
      color: 'emerald',
    },
    {
      name: 'Pending Calls',
      value: callsResult.count || 0,
      icon: Phone,
      color: 'orange',
    },
  ];

  const colorClasses = {
    purple: 'from-purple-400 to-purple-600 shadow-purple-500/20 bg-purple-500/10 text-purple-400',
    blue: 'from-blue-400 to-blue-600 shadow-blue-500/20 bg-blue-500/10 text-blue-400',
    emerald: 'from-emerald-400 to-emerald-600 shadow-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    orange: 'from-orange-400 to-orange-600 shadow-orange-500/20 bg-orange-500/10 text-orange-400',
  };

  return (
    <div className="h-screen overflow-auto p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of all organizations and activity</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const colors = colorClasses[stat.color as keyof typeof colorClasses];
            return (
              <Card key={stat.name} className="bg-[#12121a] border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {stat.name}
                  </CardTitle>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.split(' ').slice(0, 2).join(' ')} flex items-center justify-center shadow-lg ${colors.split(' ')[2]}`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card className="bg-[#12121a] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/admin/organizations"
              className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
            >
              <Building2 className="w-6 h-6 text-purple-400 mb-2" />
              <h3 className="font-medium text-white">Manage Organizations</h3>
              <p className="text-sm text-gray-500 mt-1">Create and configure organizations</p>
            </a>
            <a
              href="/admin/users"
              className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
            >
              <Users className="w-6 h-6 text-blue-400 mb-2" />
              <h3 className="font-medium text-white">Manage Users</h3>
              <p className="text-sm text-gray-500 mt-1">View and manage all users</p>
            </a>
            <a
              href="/admin/messages"
              className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              <MessageSquare className="w-6 h-6 text-emerald-400 mb-2" />
              <h3 className="font-medium text-white">View All Messages</h3>
              <p className="text-sm text-gray-500 mt-1">Monitor all organization messages</p>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

