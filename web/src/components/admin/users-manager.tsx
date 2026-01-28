'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile, Organization, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Shield, Building2, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UsersManagerProps {
  initialUsers: (Profile & { organization?: Organization })[];
  organizations: Organization[];
}

const roleColors: Record<UserRole, string> = {
  superadmin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  org_admin: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  sales: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const roleLabels: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  org_admin: 'Org Admin',
  sales: 'Sales Rep',
};

export function UsersManager({ initialUsers, organizations }: UsersManagerProps) {
  const [users, setUsers] = useState(initialUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>('all');

  const supabase = createClient();

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesOrg = filterOrg === 'all' || user.organization_id === filterOrg;
    
    return matchesSearch && matchesOrg;
  });

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.filter(u => u.id !== userId));
      toast.success('User deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  return (
    <div className="h-screen overflow-auto p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-500 mt-1">Manage all users across organizations</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#12121a] border-gray-800 text-white"
            />
          </div>
          <select
            value={filterOrg}
            onChange={(e) => setFilterOrg(e.target.value)}
            className="px-4 py-2 bg-[#12121a] border border-gray-800 rounded-lg text-white"
          >
            <option value="all">All Organizations</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#12121a] border-gray-800">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.filter(u => u.role === 'superadmin').length}
                </p>
                <p className="text-xs text-gray-500">Super Admins</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#12121a] border-gray-800">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.filter(u => u.role === 'org_admin').length}
                </p>
                <p className="text-xs text-gray-500">Org Admins</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#12121a] border-gray-800">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.filter(u => u.role === 'sales').length}
                </p>
                <p className="text-xs text-gray-500">Sales Reps</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card className="bg-[#12121a] border-gray-800">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-800">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No users found</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div key={user.id} className="p-4 flex items-center justify-between hover:bg-white/5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gray-800 text-white">
                          {user.full_name?.[0] || user.username?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-white">
                          {user.full_name || user.username || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          @{user.username} • Joined {format(new Date(user.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {user.organization && (
                        <Badge variant="outline" className="border-gray-700 text-gray-400">
                          {user.organization.name}
                        </Badge>
                      )}
                      <Badge className={roleColors[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                      {user.role !== 'superadmin' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}





