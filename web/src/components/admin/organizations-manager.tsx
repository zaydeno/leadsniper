'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Organization } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Building2, Plus, Users, Link2, Copy, Check, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OrganizationsManagerProps {
  initialOrganizations: Organization[];
}

export function OrganizationsManager({ initialOrganizations }: OrganizationsManagerProps) {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [seatDialogOpen, setSeatDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [seatLimit, setSeatLimit] = useState<string>('');
  const [newOrg, setNewOrg] = useState({
    name: '',
    slug: '',
    httpsms_api_key: '',
    httpsms_from_number: '',
    max_sales_seats: '',
  });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const supabase = createClient();

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: newOrg.name,
          slug: newOrg.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          httpsms_api_key: newOrg.httpsms_api_key || null,
          httpsms_from_number: newOrg.httpsms_from_number || null,
          max_sales_seats: newOrg.max_sales_seats ? parseInt(newOrg.max_sales_seats) : null,
        })
        .select()
        .single();

      if (error) throw error;

      setOrganizations([data, ...organizations]);
      setNewOrg({ name: '', slug: '', httpsms_api_key: '', httpsms_from_number: '', max_sales_seats: '' });
      setIsDialogOpen(false);
      toast.success('Organization created!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create organization');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateInvite = async (orgId: string) => {
    try {
      // Superadmins can only create org_admin invites
      const { data, error } = await supabase.rpc('create_invite', {
        p_organization_id: orgId,
        p_role: 'org_admin',
        p_expires_in_days: 7,
      });

      if (error) throw error;

      const link = `${window.location.origin}/signup/${data}`;
      setInviteLink(link);
      toast.success('Org Admin invite link generated!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate invite');
    }
  };

  const handleCopyLink = async (link: string, id: string) => {
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard!');
  };

  const handleDeleteOrg = async (orgId: string) => {
    if (!confirm('Are you sure? This will delete all organization data.')) return;

    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);

      if (error) throw error;

      setOrganizations(organizations.filter(o => o.id !== orgId));
      toast.success('Organization deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete');
    }
  };

  const handleOpenSeatDialog = (org: Organization) => {
    setSelectedOrg(org);
    setSeatLimit(org.max_sales_seats?.toString() || '');
    setSeatDialogOpen(true);
  };

  const handleUpdateSeatLimit = async () => {
    if (!selectedOrg) return;

    try {
      const newLimit = seatLimit === '' ? null : parseInt(seatLimit);
      
      const { error } = await supabase.rpc('update_org_seat_limit', {
        p_organization_id: selectedOrg.id,
        p_max_seats: newLimit,
      });

      if (error) throw error;

      setOrganizations(organizations.map(org => 
        org.id === selectedOrg.id 
          ? { ...org, max_sales_seats: newLimit }
          : org
      ));
      setSeatDialogOpen(false);
      toast.success('Seat limit updated!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update seat limit');
    }
  };

  return (
    <div className="h-screen overflow-auto p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Organizations</h1>
            <p className="text-gray-500 mt-1">Manage organizations and invite org admins</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-500 hover:bg-purple-600">
                <Plus className="w-4 h-4 mr-2" />
                New Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#12121a] border-gray-800 text-white">
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
                <DialogDescription className="text-gray-500">
                  Set up a new organization. The org admin will manage their own team.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateOrg} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-gray-400">Organization Name</Label>
                  <Input
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                    placeholder="Acme Motors"
                    className="bg-[#1a1a24] border-gray-800 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">Slug (URL identifier)</Label>
                  <Input
                    value={newOrg.slug}
                    onChange={(e) => setNewOrg({ ...newOrg, slug: e.target.value })}
                    placeholder="acme-motors"
                    className="bg-[#1a1a24] border-gray-800 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">Max Sales Rep Seats</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newOrg.max_sales_seats}
                    onChange={(e) => setNewOrg({ ...newOrg, max_sales_seats: e.target.value })}
                    placeholder="Leave empty for unlimited"
                    className="bg-[#1a1a24] border-gray-800 text-white"
                  />
                  <p className="text-xs text-gray-500">
                    Limit how many sales reps the org admin can invite
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">httpsms API Key (optional)</Label>
                  <Input
                    value={newOrg.httpsms_api_key}
                    onChange={(e) => setNewOrg({ ...newOrg, httpsms_api_key: e.target.value })}
                    placeholder="Enter API key"
                    className="bg-[#1a1a24] border-gray-800 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">From Number (optional)</Label>
                  <Input
                    value={newOrg.httpsms_from_number}
                    onChange={(e) => setNewOrg({ ...newOrg, httpsms_from_number: e.target.value })}
                    placeholder="+1234567890"
                    className="bg-[#1a1a24] border-gray-800 text-white"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDialogOpen(false)}
                    className="text-gray-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="bg-purple-500 hover:bg-purple-600"
                  >
                    {isCreating ? 'Creating...' : 'Create Organization'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Invite Link Display */}
        {inviteLink && (
          <Card className="bg-blue-500/10 border-blue-500/20 mb-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link2 className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-blue-400">Org Admin Invite Link Generated</p>
                    <p className="text-xs text-gray-400 font-mono truncate max-w-md">{inviteLink}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleCopyLink(inviteLink, 'invite')}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  {copiedId === 'invite' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seat Limit Dialog */}
        <Dialog open={seatDialogOpen} onOpenChange={setSeatDialogOpen}>
          <DialogContent className="bg-[#12121a] border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Update Seat Limit</DialogTitle>
              <DialogDescription className="text-gray-500">
                Set the maximum number of sales reps for {selectedOrg?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-gray-400">Max Sales Rep Seats</Label>
                <Input
                  type="number"
                  min="1"
                  value={seatLimit}
                  onChange={(e) => setSeatLimit(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className="bg-[#1a1a24] border-gray-800 text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSeatDialogOpen(false)}
                  className="text-gray-400"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateSeatLimit}
                  className="bg-purple-500 hover:bg-purple-600"
                >
                  Update Limit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Organizations List */}
        <div className="space-y-4">
          {organizations.length === 0 ? (
            <Card className="bg-[#12121a] border-gray-800">
              <CardContent className="py-12 text-center">
                <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-400">No organizations yet</h3>
                <p className="text-sm text-gray-600 mt-1">Create your first organization to get started</p>
              </CardContent>
            </Card>
          ) : (
            organizations.map((org) => (
              <Card key={org.id} className="bg-[#12121a] border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-white">{org.name}</CardTitle>
                      <p className="text-xs text-gray-500 font-mono">/{org.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {org.max_sales_seats !== null && (
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                        {org.max_sales_seats} seats
                      </Badge>
                    )}
                    <Badge className={org.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}>
                      {org.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Created {format(new Date(org.created_at), 'MMM d, yyyy')}
                      {org.httpsms_from_number && (
                        <span className="ml-3">• {org.httpsms_from_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenSeatDialog(org)}
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Seats
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateInvite(org.id)}
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Invite Admin
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteOrg(org.id)}
                        className="text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
