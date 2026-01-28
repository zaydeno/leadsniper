'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Thread, Message, Profile, ThreadFlag } from '@/lib/types';
import { ThreadList } from './thread-list';
import { ChatWindow } from './chat-window';
import { MessageSquare } from 'lucide-react';

interface InboxViewProps {
  initialThreads: Thread[];
  userProfile: Profile | null;
}

export function InboxView({ initialThreads, userProfile }: InboxViewProps) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const supabase = createClient();

  // Load messages when thread is selected
  useEffect(() => {
    if (!selectedThread) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', selectedThread.id)
        .order('created_at', { ascending: true });

      setMessages(data || []);
      setIsLoadingMessages(false);

      // Mark thread as read
      if (selectedThread.unread_count > 0) {
        await supabase
          .from('threads')
          .update({ unread_count: 0 })
          .eq('id', selectedThread.id);

        setThreads(prev =>
          prev.map(t =>
            t.id === selectedThread.id ? { ...t, unread_count: 0 } : t
          )
        );
      }
    };

    loadMessages();
  }, [selectedThread, supabase]);

  // Real-time subscriptions
  useEffect(() => {
    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as Message;
          
          // Add to messages if current thread
          if (selectedThread && newMessage.thread_id === selectedThread.id) {
            setMessages(prev => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    // Subscribe to thread updates
    const threadsChannel = supabase
      .channel('threads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'threads',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setThreads(prev => [payload.new as Thread, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setThreads(prev =>
              prev.map(t =>
                t.id === (payload.new as Thread).id ? (payload.new as Thread) : t
              ).sort((a, b) => 
                new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(threadsChannel);
    };
  }, [supabase, selectedThread]);

  const handleSendMessage = async (content: string) => {
    if (!selectedThread) return;

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedThread.contact_phone,
          content,
          // Pass organization_id for proper routing
          organization_id: selectedThread.organization_id || userProfile?.organization_id,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Optimistically add message to UI
      // The real-time subscription will update with the actual data
    } catch (error) {
      console.error('Send error:', error);
      throw error;
    }
  };

  const handleReassign = async (userId: string) => {
    if (!selectedThread) return;

    const response = await fetch(`/api/threads/${selectedThread.id}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reassign');
    }

    // Update thread locally
    setThreads(prev =>
      prev.map(t =>
        t.id === selectedThread.id 
          ? { ...t, assigned_to: userId }
          : t
      )
    );

    // Update selected thread
    setSelectedThread(prev => 
      prev ? { ...prev, assigned_to: userId } : null
    );
  };

  const handleDelete = async () => {
    if (!selectedThread) return;

    const response = await fetch(`/api/threads/${selectedThread.id}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete');
    }

    // Remove thread from list
    setThreads(prev => prev.filter(t => t.id !== selectedThread.id));
    
    // Clear selection
    setSelectedThread(null);
    setMessages([]);
  };

  const handleFlagChange = async (flag: ThreadFlag) => {
    if (!selectedThread) return;

    const response = await fetch(`/api/threads/${selectedThread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update flag');
    }

    // Update thread locally
    setThreads(prev =>
      prev.map(t =>
        t.id === selectedThread.id 
          ? { ...t, flag }
          : t
      )
    );

    // Update selected thread
    setSelectedThread(prev => 
      prev ? { ...prev, flag } : null
    );
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Thread list */}
      <div className="w-80 border-r border-gray-800/50 flex flex-col bg-[#0f0f17] overflow-hidden">
        <div className="h-16 px-4 flex items-center border-b border-gray-800/50 flex-shrink-0">
          <h1 className="text-lg font-semibold text-white">Inbox</h1>
          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-full">
            {threads.length}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ThreadList
            threads={threads}
            selectedThread={selectedThread}
            onSelectThread={setSelectedThread}
          />
        </div>
      </div>

      {/* Chat window */}
      <div className="flex-1 flex flex-col bg-[#0a0a0f] overflow-hidden">
        {selectedThread ? (
          <ChatWindow
            thread={selectedThread}
            messages={messages}
            isLoading={isLoadingMessages}
            onSendMessage={handleSendMessage}
            onReassign={handleReassign}
            onDelete={handleDelete}
            onFlagChange={handleFlagChange}
            userProfile={userProfile}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800/50 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-400">Select a conversation</h3>
              <p className="text-sm text-gray-600 mt-1">
                Choose a thread from the list to view messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

