'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Profile } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import {
  Building2,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  Shield,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminSidebarProps {
  user: User;
  profile: Profile | null;
}

const navigation = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2 },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'All Messages', href: '/admin/messages', icon: MessageSquare },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AdminSidebar({ user, profile }: AdminSidebarProps) {
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
    : profile?.username?.[0].toUpperCase() || 'A';

  return (
    <aside className="w-64 bg-[#12121a] border-r border-gray-800/50 flex flex-col">
      {/* Logo */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-gray-800/50">
        <div className="w-9 h-9 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-lg font-semibold text-white">Admin</span>
          <p className="text-xs text-gray-500">Super Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = item.href === '/admin' 
            ? pathname === '/admin'
            : pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <item.icon className={cn(
                'w-5 h-5 transition-colors',
                isActive ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-300'
              )} />
              {item.name}
              {isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-purple-400" />
              )}
            </Link>
          );
        })}

        {/* Link back to regular dashboard */}
        <div className="pt-4 mt-4 border-t border-gray-800/50">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
          >
            <MessageSquare className="w-5 h-5" />
            Back to Inbox
          </Link>
        </div>
      </nav>

      {/* User menu */}
      <div className="p-3 border-t border-gray-800/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
              <Avatar className="h-8 w-8 ring-2 ring-purple-500/30">
                <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name || profile?.username}
                </p>
                <p className="text-xs text-purple-400">
                  Super Admin
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-56 bg-[#1a1a24] border-gray-800 text-white"
          >
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

