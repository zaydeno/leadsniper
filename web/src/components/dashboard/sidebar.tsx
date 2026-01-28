'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Profile } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import {
  MessageSquare,
  Phone,
  Settings,
  LogOut,
  Zap,
  ChevronRight,
  Shield,
  Users,
  Building2,
  BarChart3,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SidebarProps {
  user: User;
  profile: Profile | null;
}

export function Sidebar({ user, profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : profile?.username?.[0].toUpperCase() || 'U';

  const navigation = [
    { name: 'Inbox', href: '/dashboard', icon: MessageSquare },
    { name: 'Stats', href: '/dashboard/stats', icon: BarChart3 },
    { name: 'Missed Calls', href: '/dashboard/calls', icon: Phone },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  // Add org admin features
  if (profile?.role === 'org_admin') {
    navigation.splice(3, 0, { name: 'Team', href: '/dashboard/team', icon: Users });
  }

  const roleLabels = {
    superadmin: 'Super Admin',
    org_admin: 'Org Admin',
    sales: 'Sales Rep',
  };

  return (
    <aside className="w-64 bg-[#12121a] border-r border-gray-800/50 flex flex-col">
      {/* Logo */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-gray-800/50">
        <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-lg font-semibold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            LeadSniper
          </span>
          {profile?.organization && (
            <p className="text-xs text-gray-500 truncate max-w-[140px]">
              {(profile.organization as { name: string }).name}
            </p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = item.href === '/dashboard' 
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <item.icon className={cn(
                'w-5 h-5 transition-colors',
                isActive ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'
              )} />
              {item.name}
              {isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-emerald-400" />
              )}
            </Link>
          );
        })}

        {/* Super Admin Link */}
        {profile?.role === 'superadmin' && (
          <div className="pt-4 mt-4 border-t border-gray-800/50">
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                pathname.startsWith('/admin')
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'text-gray-500 hover:text-purple-400 hover:bg-purple-500/10'
              )}
            >
              <Shield className="w-5 h-5" />
              Admin Panel
            </Link>
          </div>
        )}
      </nav>

      {/* User menu */}
      <div className="p-3 border-t border-gray-800/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group">
              <Avatar className="h-8 w-8 ring-2 ring-gray-800">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name || profile?.username}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {roleLabels[profile?.role || 'sales']}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-56 bg-[#1a1a24] border-gray-800 text-white"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile?.full_name || profile?.username}</p>
              <p className="text-xs text-gray-500 truncate">@{profile?.username}</p>
            </div>
            <DropdownMenuSeparator className="bg-gray-800" />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            {profile?.role === 'superadmin' && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer">
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Panel
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-gray-800" />
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
