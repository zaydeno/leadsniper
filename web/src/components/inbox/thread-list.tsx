'use client';

import { Thread } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { User, Car } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ThreadListProps {
  threads: Thread[];
  selectedThread: Thread | null;
  onSelectThread: (thread: Thread) => void;
}

export function ThreadList({ threads, selectedThread, onSelectThread }: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">No conversations yet</p>
          <p className="text-xs text-gray-600 mt-1">
            Messages will appear here when leads reply
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread)}
            className={cn(
              'w-full p-3 rounded-lg text-left transition-all duration-200 group',
              selectedThread?.id === thread.id
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'hover:bg-white/5 border border-transparent'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                selectedThread?.id === thread.id
                  ? 'bg-emerald-500/20'
                  : 'bg-gray-800'
              )}>
                <User className={cn(
                  'w-5 h-5',
                  selectedThread?.id === thread.id
                    ? 'text-emerald-400'
                    : 'text-gray-500'
                )} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'font-medium truncate block max-w-[140px]',
                    selectedThread?.id === thread.id
                      ? 'text-emerald-400'
                      : 'text-white'
                  )}>
                    {thread.contact_name || (thread.metadata?.seller_name as string) || formatPhoneNumber(thread.contact_phone)}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                    {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: false })}
                  </span>
                </div>

                {/* Vehicle model if available */}
                {thread.metadata?.vehicle_model && (
                  <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                    <Car className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-500 truncate block">
                      {thread.metadata.vehicle_model as string}
                    </span>
                  </div>
                )}

                {/* Last message preview */}
                <p className="text-sm text-gray-400 mt-1 line-clamp-1">
                  {thread.last_message_preview || 'No messages'}
                </p>
              </div>

              {/* Unread indicator */}
              {thread.unread_count > 0 && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-white">
                    {thread.unread_count > 9 ? '9+' : thread.unread_count}
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatPhoneNumber(phone: string): string {
  // Format +1234567890 to (123) 456-7890
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

