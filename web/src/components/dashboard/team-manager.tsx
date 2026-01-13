'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole, SeatInfo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Link2, Copy, Check, UserPlus, AlertTriangle, MoreVertical, KeyRound, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TeamManagerProps {
  profile: Profile;
  teamMembers: Profile[];
}

const roleColors: Record<UserRole, string> = {
  superadmin: 'bg-purple-500/10 text-purple-400',
  org_admin: 'bg-blue-500/10 text-blue-400',
  sales: 'bg-emerald-500/10 text-emerald-400',
};

export function TeamManager({ profile, teamMembers: initialTeamMembers }: TeamManagerProps) {
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resetCopied, setResetCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [isLoadingSeats, setIsLoadingSeats] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const supabase = createClient();

  // Load seat info on mount
  useEffect(() => {
    const loadSeatInfo = async () => {
      if (!profile.organization_id) return;
      
      try {
        const { data, error } = await supabase.rpc('get_remaining_seats', {
          p_organization_id: profile.organization_id,
        });

        if (error) throw error;
        setSeatInfo(data as SeatInfo);
      } catch (error) {
        console.error('Failed to load seat info:', error);
      } finally {
        setIsLoadingSeats(false);
      }
    };

    loadSeatInfo();
  }, [profile.organization_id, supabase]);

  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    try {
      // Org admins can only create sales invites
      const { data, error } = await supabase.rpc('create_invite', {
        p_organization_id: profile.organization_id,
        p_role: 'sales',
        p_expires_in_days: 7,
      });

      if (error) throw error;

      const link = `${window.location.origin}/signup/${data}`;
      setInviteLink(link);
      
      // Update seat info after creating invite
      if (seatInfo && !seatInfo.unlimited) {
        setSeatInfo({
          ...seatInfo,
          pending_invites: seatInfo.pending_invites + 1,
          remaining: seatInfo.remaining !== null ? seatInfo.remaining - 1 : null,
        });
      }
      
      toast.success('Sales rep invite link generated!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate invite');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!');
  };

  const handleCopyResetLink = async () => {
    if (!resetLink) return;
    await navigator.clipboard.writeText(resetLink);
    setResetCopied(true);
    setTimeout(() => setResetCopied(false), 2000);
    toast.success('Reset link copied!');
  };

  const handleResetPassword = async (member: Profile) => {
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate reset link');
      }
      
      setResetLink(data.resetLink);
      toast.success(`Password reset link generated for ${member.username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate reset link');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/team/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      
      // Remove from local state
      setTeamMembers(prev => prev.filter(m => m.id !== deleteTarget.id));
      
      // Update seat info
      if (seatInfo && !seatInfo.unlimited) {
        setSeatInfo({
          ...seatInfo,
          used_seats: seatInfo.used_seats - 1,
          remaining: seatInfo.remaining !== null ? seatInfo.remaining + 1 : null,
        });
      }
      
      toast.success(`${deleteTarget.username} has been removed from the team`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const canInvite = seatInfo?.unlimited || (seatInfo?.remaining != null && seatInfo?.remaining > 0);

  return (
    <div className="h-screen overflow-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Team</h1>
            <p className="text-gray-500 mt-1">Manage your organization&apos;s sales team</p>
          </div>
          <Button 
            onClick={handleGenerateInvite}
            disabled={isGenerating || !canInvite}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Invite Sales Rep'}
          </Button>
        </div>

        {/* Invite Link */}
        {inviteLink && (
          <Card className="bg-emerald-500/10 border-emerald-500/20 mb-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Sales Rep Invite Link (expires in 7 days)</p>
                    <p className="text-xs text-gray-400 font-mono truncate max-w-md">{inviteLink}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleCopy}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Password Reset Link */}
        {resetLink && (
          <Card className="bg-cyan-500/10 border-cyan-500/20 mb-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-sm font-medium text-cyan-400">Password Reset Link (one-time use)</p>
                    <p className="text-xs text-gray-400 font-mono truncate max-w-md">{resetLink}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCopyResetLink}
                    className="bg-cyan-500 hover:bg-cyan-600"
                  >
                    {resetCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setResetLink(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seat Limit Warning */}
        {!isLoadingSeats && seatInfo && !seatInfo.unlimited && seatInfo.remaining === 0 && (
          <Card className="bg-amber-500/10 border-amber-500/20 mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-400">Seat Limit Reached</p>
                  <p className="text-xs text-gray-400">
                    Your organization has used all {seatInfo.max_seats} sales rep seats. 
                    Contact your administrator to increase the limit.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#12121a] border-gray-800">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {teamMembers.filter(m => m.role === 'org_admin').length}
                </p>
                <p className="text-xs text-gray-500">Admins</p>
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
                  {teamMembers.filter(m => m.role === 'sales').length}
                </p>
                <p className="text-xs text-gray-500">Sales Reps</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#12121a] border-gray-800">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                {isLoadingSeats ? (
                  <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                ) : seatInfo?.unlimited ? (
                  <>
                    <p className="text-2xl font-bold text-white">∞</p>
                    <p className="text-xs text-gray-500">Available Seats</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-white">
                      {seatInfo?.remaining ?? 0}
                      <span className="text-sm text-gray-500 font-normal">/{seatInfo?.max_seats}</span>
                    </p>
                    <p className="text-xs text-gray-500">Available Seats</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Invites Info */}
        {!isLoadingSeats && seatInfo && seatInfo.pending_invites > 0 && (
          <p className="text-xs text-gray-500 mb-4">
            Note: {seatInfo.pending_invites} pending invite{seatInfo.pending_invites > 1 ? 's' : ''} not yet used
          </p>
        )}

        {/* Team Members List */}
        <Card className="bg-[#12121a] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Team Members</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-800">
              {teamMembers.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No team members yet</p>
                  <p className="text-sm text-gray-600">Generate an invite link to add sales reps</p>
                </div>
              ) : (
                teamMembers.map((member) => (
                  <div key={member.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gray-800 text-white">
                          {member.full_name?.[0] || member.username?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-white">
                          {member.full_name || member.username}
                          {member.id === profile.id && (
                            <span className="text-xs text-gray-500 ml-2">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          @{member.username} • Joined {format(new Date(member.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={roleColors[member.role]}>
                        {member.role === 'org_admin' ? 'Admin' : 'Sales'}
                      </Badge>
                      {/* Actions dropdown for sales reps (not self, not other admins) */}
                      {member.role === 'sales' && member.id !== profile.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#1a1a24] border-gray-800">
                            <DropdownMenuItem 
                              onClick={() => handleResetPassword(member)}
                              className="text-gray-300 focus:text-white focus:bg-white/10 cursor-pointer"
                            >
                              <KeyRound className="w-4 h-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            <DropdownMenuItem 
                              onClick={() => setDeleteTarget(member)}
                              className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove from Team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[#12121a] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to remove <span className="text-white font-medium">{deleteTarget?.full_name || deleteTarget?.username}</span> from the team? 
              This action cannot be undone and will delete their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
