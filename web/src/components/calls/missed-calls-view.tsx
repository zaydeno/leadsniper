'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MissedCall } from '@/lib/types';
import { formatDistanceToNow, format } from 'date-fns';
import { Phone, PhoneOff, Check, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MissedCallsViewProps {
  initialCalls: MissedCall[];
}

export function MissedCallsView({ initialCalls }: MissedCallsViewProps) {
  const [calls, setCalls] = useState<MissedCall[]>(initialCalls);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('missed-calls-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'missed_calls',
        },
        (payload) => {
          setCalls(prev => [payload.new as MissedCall, ...prev]);
          toast.info('New missed call!', {
            description: `From ${formatPhoneNumber((payload.new as MissedCall).from_number)}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleAcknowledge = async (callId: string) => {
    const { error } = await supabase
      .from('missed_calls')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', callId);

    if (error) {
      toast.error('Failed to acknowledge call');
      return;
    }

    setCalls(prev =>
      prev.map(call =>
        call.id === callId
          ? { ...call, acknowledged: true, acknowledged_at: new Date().toISOString() }
          : call
      )
    );
    toast.success('Call acknowledged');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const { data } = await supabase
      .from('missed_calls')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setCalls(data);
    }
    setIsRefreshing(false);
  };

  const unacknowledgedCount = calls.filter(c => !c.acknowledged).length;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800/50 bg-[#12121a]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">Missed Calls</h1>
          {unacknowledgedCount > 0 && (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
              {unacknowledgedCount} new
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
              <PhoneOff className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-400">No missed calls</h3>
            <p className="text-sm text-gray-600 mt-1">
              Missed calls will appear here
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {calls.map((call) => (
              <div
                key={call.id}
                className={cn(
                  'p-4 rounded-xl border transition-all',
                  call.acknowledged
                    ? 'bg-[#12121a] border-gray-800/50'
                    : 'bg-red-500/5 border-red-500/20'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      call.acknowledged ? 'bg-gray-800' : 'bg-red-500/10'
                    )}>
                      <Phone className={cn(
                        'w-5 h-5',
                        call.acknowledged ? 'text-gray-500' : 'text-red-400'
                      )} />
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {formatPhoneNumber(call.from_number)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                        </span>
                        <span className="text-xs text-gray-600">
                          ({format(new Date(call.created_at), 'MMM d, h:mm a')})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      onClick={() => window.open(`tel:${call.from_number}`)}
                    >
                      <Phone className="w-4 h-4 mr-1" />
                      Call Back
                    </Button>
                    {!call.acknowledged && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white"
                        onClick={() => handleAcknowledge(call.id)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Acknowledge
                      </Button>
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





