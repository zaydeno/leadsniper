'use client';

import { useState, useRef, useEffect } from 'react';
import { Thread, Message, Profile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  Send, 
  User, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle,
  Car,
  ExternalLink,
  UserCircle,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Loader2,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TeamMember {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string;
  role: string;
}

interface ChatWindowProps {
  thread: Thread;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => Promise<void>;
  onReassign?: (userId: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  userProfile: Profile | null;
}

export function ChatWindow({ 
  thread, 
  messages, 
  isLoading, 
  onSendMessage,
  onReassign,
  onDelete,
  userProfile 
}: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check if user can reassign (org_admin or superadmin)
  const canReassign = userProfile?.role === 'superadmin' || userProfile?.role === 'org_admin';

  // Fetch team members when dropdown opens
  const fetchTeamMembers = async () => {
    if (teamMembers.length > 0 || isLoadingTeam) return;
    
    setIsLoadingTeam(true);
    try {
      const response = await fetch('/api/team/members');
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  // Handle reassignment
  const handleReassign = async (userId: string) => {
    if (!onReassign || isReassigning) return;
    
    setIsReassigning(true);
    try {
      await onReassign(userId);
      const member = teamMembers.find(m => m.id === userId);
      toast.success(`Conversation reassigned to ${member?.full_name || member?.username || 'team member'}`);
    } catch (error) {
      toast.error('Failed to reassign conversation');
    } finally {
      setIsReassigning(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    
    setIsDeleting(true);
    try {
      await onDelete();
      toast.success('Conversation deleted');
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to delete conversation');
    } finally {
      setIsDeleting(false);
    }
  };

  // Extract metadata with proper typing
  const metadata = (thread.metadata || {}) as {
    seller_name?: string;
    vehicle_model?: string;
    vehicle_make?: string;
    listing_url?: string;
    initiated_by_name?: string;
    initiated_at?: string;
    campaign_name?: string;
    source?: string;
  };
  const hasMetadata = metadata.seller_name || metadata.vehicle_model || metadata.vehicle_make || metadata.listing_url || metadata.initiated_by_name || metadata.campaign_name;

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800/50 bg-[#12121a] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">
                {thread.contact_name || metadata.seller_name || formatPhoneNumber(thread.contact_phone)}
              </h2>
              <p className="text-xs text-gray-500">{thread.contact_phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMetadata && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 text-xs"
                onClick={() => setShowDetails(!showDetails)}
              >
                Details
                {showDetails ? (
                  <ChevronUp className="w-4 h-4 ml-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-1" />
                )}
              </Button>
            )}
            
            {/* Reassign Dropdown - Only for org_admin and superadmin */}
            {canReassign && onReassign && (
              <DropdownMenu onOpenChange={(open) => open && fetchTeamMembers()}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 text-xs"
                    disabled={isReassigning}
                  >
                    {isReassigning ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-1" />
                    )}
                    Reassign
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56 bg-[#1a1a24] border-gray-800"
                >
                  <DropdownMenuLabel className="text-gray-400">
                    Assign to Team Member
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  
                  {isLoadingTeam ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="py-4 text-center text-sm text-gray-500">
                      No team members found
                    </div>
                  ) : (
                    teamMembers.map((member) => (
                      <DropdownMenuItem
                        key={member.id}
                        onClick={() => handleReassign(member.id)}
                        className="cursor-pointer hover:bg-emerald-500/10 focus:bg-emerald-500/10"
                        disabled={member.id === thread.assigned_to}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <User className="w-3 h-3 text-emerald-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-white">
                              {member.full_name || member.username || member.email}
                            </span>
                            <span className="text-xs text-gray-500 capitalize">
                              {member.role.replace('_', ' ')}
                            </span>
                          </div>
                          {member.id === thread.assigned_to && (
                            <span className="ml-auto text-xs text-emerald-400">
                              Current
                            </span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Delete Button */}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-xs"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in slide-in-from-top-2">
            <p className="text-sm text-white mb-3">
              Are you sure you want to delete this conversation? This will permanently remove all messages.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Lead Details Panel */}
        {showDetails && hasMetadata && (
          <div className="mt-4 p-4 bg-[#0a0a0f] rounded-xl border border-gray-800/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lead Details</h3>
              {metadata.campaign_name && (
                <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">
                  Campaign: {metadata.campaign_name}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {metadata.seller_name && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Seller Name</p>
                    <p className="text-sm text-white">{metadata.seller_name}</p>
                  </div>
                </div>
              )}

              {(metadata.vehicle_model || metadata.vehicle_make) && (
                <div className="flex items-start gap-2">
                  <Car className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Vehicle</p>
                    <p className="text-sm text-white">
                      {metadata.vehicle_model || metadata.vehicle_make}
                      {metadata.vehicle_model && metadata.vehicle_make && metadata.vehicle_model !== metadata.vehicle_make && (
                        <span className="text-gray-500 ml-1">({metadata.vehicle_make})</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {(metadata.initiated_by_name || metadata.source === 'campaign') && (
                <div className="flex items-start gap-2">
                  <UserCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Started By</p>
                    <p className="text-sm text-white">
                      {metadata.source === 'campaign' ? 'Admin' : metadata.initiated_by_name}
                    </p>
                    {metadata.initiated_at && (
                      <p className="text-xs text-gray-500">
                        {format(new Date(metadata.initiated_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {metadata.source && metadata.source !== 'campaign' && (
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Source</p>
                    <p className="text-sm text-white capitalize">{metadata.source}</p>
                  </div>
                </div>
              )}
            </div>

            {metadata.listing_url && (
              <a
                href={metadata.listing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full p-3 mt-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/20 transition-colors group"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
                <span className="text-sm text-emerald-400 group-hover:text-emerald-300 truncate">
                  {metadata.source === 'campaign' ? 'View Kijiji Listing' : 'View Original Listing'}
                </span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
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
              const msgMeta = (message.metadata || {}) as {
                is_initial_outreach?: boolean;
                sent_by_name?: string;
                source?: string;
              };

              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex items-center justify-center my-4">
                      <span className="px-3 py-1 text-xs text-gray-500 bg-gray-800/50 rounded-full">
                        {format(new Date(message.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  
                  {/* Show initial outreach badge */}
                  {msgMeta.is_initial_outreach && isOutbound && (
                    <div className="flex justify-end mb-1">
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Initial Outreach
                        {msgMeta.sent_by_name && ` • ${msgMeta.sent_by_name}`}
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
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800/50 bg-[#12121a] flex-shrink-0">
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
    case 'delivered':
      return <CheckCheck className="w-3 h-3 text-emerald-100" />;
    case 'received':
      return <CheckCheck className="w-3 h-3 text-emerald-100" />;
    case 'failed':
    case 'expired':
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
