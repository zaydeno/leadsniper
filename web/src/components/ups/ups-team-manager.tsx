'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, User, Phone, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UpsTeamMember } from '@/lib/types';
import { cn } from '@/lib/utils';

interface UpsTeamManagerProps {
  teamMembers: UpsTeamMember[];
  onUpdate: () => void;
}

export function UpsTeamManager({ teamMembers, onUpdate }: UpsTeamManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Sort by display_order
  const sortedMembers = [...teamMembers].sort((a, b) => a.display_order - b.display_order);

  const resetForm = () => {
    setName('');
    setPhoneNumber('');
    setIsAdding(false);
    setEditingId(null);
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(formatPhoneNumber(value));
  };

  const handleAdd = async () => {
    if (!name.trim() || !phoneNumber.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/ups/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone_number: phoneNumber.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add team member');
      }

      toast.success('Team member added');
      resetForm();
      onUpdate();
    } catch (error) {
      toast.error('Failed to add team member', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (member: UpsTeamMember) => {
    if (!name.trim() || !phoneNumber.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/ups/team-members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone_number: phoneNumber.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update team member');
      }

      toast.success('Team member updated');
      resetForm();
      onUpdate();
    } catch (error) {
      toast.error('Failed to update team member', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (member: UpsTeamMember) => {
    if (!confirm(`Are you sure you want to delete ${member.name}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/ups/team-members/${member.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete team member');
      }

      toast.success('Team member deleted');
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete team member', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (member: UpsTeamMember) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/ups/team-members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !member.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update team member');
      }

      toast.success(member.is_active ? 'Team member deactivated' : 'Team member activated');
      onUpdate();
    } catch (error) {
      toast.error('Failed to update team member', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (member: UpsTeamMember) => {
    setEditingId(member.id);
    setName(member.name);
    setPhoneNumber(member.phone_number);
    setIsAdding(false);
  };

  return (
    <div className="space-y-4 py-4">
      {/* Add New Button */}
      {!isAdding && !editingId && (
        <Button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
          }}
          className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Team Member
        </Button>
      )}

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="bg-[#1a1a24] rounded-xl p-4 border border-gray-700 space-y-4">
          <h3 className="font-medium text-white">
            {isAdding ? 'Add New Team Member' : 'Edit Team Member'}
          </h3>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="name" className="text-gray-400">Name</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Smith"
                  className="pl-10 bg-[#12121a] border-gray-700 text-white h-12 text-lg"
                  autoFocus
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="phone" className="text-gray-400">Phone Number</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="pl-10 bg-[#12121a] border-gray-700 text-white h-12 text-lg"
                  type="tel"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (editingId) {
                  const member = teamMembers.find(m => m.id === editingId);
                  if (member) handleEdit(member);
                } else {
                  handleAdd();
                }
              }}
              disabled={isLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {isAdding ? 'Add' : 'Save'}
                </>
              )}
            </Button>
            <Button
              onClick={resetForm}
              variant="outline"
              className="bg-transparent border-gray-700 hover:bg-[#252530] h-12"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Team Members List */}
      <div className="space-y-2">
        {sortedMembers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No team members yet</p>
            <p className="text-sm">Add your first team member above</p>
          </div>
        ) : (
          sortedMembers.map((member) => (
            <div
              key={member.id}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border transition-colors',
                member.is_active
                  ? 'bg-[#1a1a24] border-gray-700'
                  : 'bg-[#1a1a24]/50 border-gray-800 opacity-60'
              )}
            >
              {/* Active Toggle */}
              <button
                onClick={() => handleToggleActive(member)}
                disabled={isLoading}
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  'active:scale-95 touch-manipulation',
                  member.is_active
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'bg-gray-700/50 text-gray-500'
                )}
              >
                <Check className="w-5 h-5" />
              </button>

              {/* Member Info */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-medium truncate',
                  member.is_active ? 'text-white' : 'text-gray-500'
                )}>
                  {member.name}
                </p>
                <p className="text-sm text-gray-500 truncate">
                  {member.phone_number}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => startEditing(member)}
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-white hover:bg-[#252530]"
                  disabled={isLoading}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(member)}
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                  disabled={isLoading}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
