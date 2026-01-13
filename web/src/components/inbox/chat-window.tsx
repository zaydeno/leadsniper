'use client';

import { useState, useRef, useEffect } from 'react';
import { Thread, Message, Profile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Send, Phone, User, Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface ChatWindowProps {
  thread: Thread;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => Promise<void>;
  userProfile: Profile | null;
}

export function ChatWindow({ 
  thread, 
  messages, 
  isLoading, 
  onSendMessage,
  userProfile 
}: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when thread changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [thread.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      await onSendMessage(content);
      toast.success('Message sent!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      setNewMessage(content); // Restore message on error
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800/50 bg-[#12121a]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">
              {thread.contact_name || formatPhoneNumber(thread.contact_phone)}
            </h2>
            <p className="text-xs text-gray-500">{thread.contact_phone}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10"
          onClick={() => window.open(`tel:${thread.contact_phone}`)}
        >
          <Phone className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No messages in this conversation</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isOutbound = message.direction === 'outbound';
              const showDate = index === 0 || 
                new Date(message.created_at).toDateString() !== 
                new Date(messages[index - 1].created_at).toDateString();

              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex items-center justify-center my-4">
                      <span className="px-3 py-1 text-xs text-gray-500 bg-gray-800/50 rounded-full">
                        {format(new Date(message.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <div className={cn(
                    'flex',
                    isOutbound ? 'justify-end' : 'justify-start'
                  )}>
                    <div className={cn(
                      'max-w-[70%] rounded-2xl px-4 py-2.5 relative group',
                      isOutbound
                        ? 'bg-emerald-500 text-white rounded-br-md'
                        : 'bg-gray-800 text-gray-100 rounded-bl-md'
                    )}>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <div className={cn(
                        'flex items-center gap-1 mt-1',
                        isOutbound ? 'justify-end' : 'justify-start'
                      )}>
                        <span className={cn(
                          'text-xs',
                          isOutbound ? 'text-emerald-100/70' : 'text-gray-500'
                        )}>
                          {format(new Date(message.created_at), 'h:mm a')}
                        </span>
                        {isOutbound && (
                          <MessageStatus status={message.status} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-gray-800/50 bg-[#12121a]">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-3 bg-[#1a1a24] border border-gray-800 rounded-xl text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <Button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="h-12 w-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function MessageStatus({ status }: { status: Message['status'] }) {
  switch (status) {
    case 'pending':
      return <Clock className="w-3 h-3 text-emerald-100/50" />;
    case 'sent':
      return <Check className="w-3 h-3 text-emerald-100/70" />;
    case 'received':
      return <CheckCheck className="w-3 h-3 text-emerald-100" />;
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-red-400" />;
    default:
      return null;
  }
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

