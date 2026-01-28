'use client';

import { useState } from 'react';
import { Thread, Organization } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Search, Building2, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AllMessagesViewProps {
  initialThreads: (Thread & { organization?: { name: string; slug: string } })[];
  organizations: Organization[];
}

export function AllMessagesView({ initialThreads, organizations }: AllMessagesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>('all');

  const filteredThreads = initialThreads.filter(thread => {
    const matchesSearch = 
      thread.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.contact_phone.includes(searchQuery) ||
      thread.last_message_preview?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesOrg = filterOrg === 'all' || thread.organization_id === filterOrg;
    
    return matchesSearch && matchesOrg;
  });

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800/50 bg-[#12121a]">
        <div>
          <h1 className="text-lg font-semibold text-white">All Messages</h1>
          <p className="text-xs text-gray-500">{filteredThreads.length} conversations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-800/50 bg-[#0f0f17] flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#12121a] border-gray-800 text-white"
          />
        </div>
        <select
          value={filterOrg}
          onChange={(e) => setFilterOrg(e.target.value)}
          className="px-4 py-2 bg-[#12121a] border border-gray-800 rounded-lg text-white text-sm"
        >
          <option value="all">All Organizations</option>
          {organizations.map(org => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      {/* Threads List */}
      <ScrollArea className="flex-1">
        {filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <MessageSquare className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-gray-400">No conversations found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {filteredThreads.map((thread) => (
              <div 
                key={thread.id} 
                className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white truncate">
                          {thread.contact_name || formatPhoneNumber(thread.contact_phone)}
                        </p>
                        {thread.unread_count > 0 && (
                          <Badge className="bg-emerald-500 text-white text-xs px-1.5 py-0">
                            {thread.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {thread.last_message_preview || 'No messages'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                    </div>
                    {thread.organization && (
                      <Badge variant="outline" className="border-gray-700 text-gray-500 text-xs">
                        <Building2 className="w-3 h-3 mr-1" />
                        {thread.organization.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}





