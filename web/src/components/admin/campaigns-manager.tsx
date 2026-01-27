'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Organization, Campaign, Profile } from '@/lib/types';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Megaphone, 
  Plus, 
  Upload, 
  FileText, 
  Play, 
  Pause, 
  StopCircle,
  Users,
  Shuffle,
  Car,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Eye,
  Terminal,
  AlertCircle,
  Info,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CampaignsManagerProps {
  initialCampaigns: Campaign[];
  organizations: Organization[];
  users: Profile[];
}

interface CSVLead {
  phone_number: string;
  name: string;
  make: string;
  model: string;
  kijiji_link: string;
}

interface CampaignLog {
  id: string;
  campaign_id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

// Default spintax message templates
const MAKE_CAMPAIGN_TEMPLATE = `{Hi|Hello|Hey|Hi there} [Customer Name]! {It's|This is} Hunter, {the|the lead} acquisition manager {at|from} Stony Plain Chrysler. {We're looking to|My team and I want to} {refresh|update} our {inventory|pre-owned stock} and {we need more [Make]'s on the lot, so yours is|your [Make] is} {at the top of our list|in high demand right now}. We {are offering|can offer} {wholesale value|top market value} + a $1000 {Bonus|Trade-In Credit} if you {would be|are} {willing to consider|open to} trading {it|your vehicle} in {to our dealership|to us}. I {can also|could also} {get|secure} you a {pretty good|fantastic} deal on {any|a} new or {certified pre-owned|CPO} vehicle {on our lot|in stock}. {Would you be interested in hearing|Are you open to seeing|Would you want to hear} what we {can offer you|have to offer}?`;

const MODEL_CAMPAIGN_TEMPLATE = `{Hi|Hello|Hey|Hi there} [Customer Name]! {It's|This is} Hunter, {the|the lead} acquisition manager {at|from} Stony Plain Chrysler. {We're looking to|My team and I want to} {refresh|update} our {inventory|pre-owned stock} and {[Model] is|the [Model] is} {at the top of our list|in high demand right now}. We {are offering|can offer} {wholesale value|top market value} + a $1000 {Bonus|Trade-In Credit} if you {would be|are} {willing to consider|open to} trading {it|your vehicle} in {to our dealership|to us}. I {can also|could also} {get|secure} you a {pretty good|fantastic} deal on {any|a} new or {certified pre-owned|CPO} vehicle {on our lot|in stock}. {Would you be interested in hearing|Are you open to seeing|Would you want to hear} what we {can offer you|have to offer}?`;

// Function to parse spintax and return a random variation
function parseSpintax(template: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  return template.replace(spintaxRegex, (match, group) => {
    const options = group.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });
}

// Function to replace placeholders with actual values (uses square brackets)
function replacePlaceholders(
  message: string, 
  lead: CSVLead, 
  vehicleMode: 'make' | 'model',
  useCustomerName: boolean = true
): string {
  let result = message;
  // When not using customer name, replace placeholder with empty string (template should already have generic greeting)
  // When using customer name, use the name or fallback to 'there'
  result = result.replace(/\[Customer Name\]/gi, useCustomerName ? (lead.name || 'there') : '');
  result = result.replace(/\[Make\]/gi, lead.make || '');
  result = result.replace(/\[Model\]/gi, lead.model || '');
  return result;
}

export function CampaignsManager({ initialCampaigns, organizations, users }: CampaignsManagerProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [csvLeads, setCsvLeads] = useState<CSVLead[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Log viewer state
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [campaignLogs, setCampaignLogs] = useState<Record<string, CampaignLog[]>>({});
  const [isLoadingLogs, setIsLoadingLogs] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // New campaign form state
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    organization_id: '',
    message_template: MODEL_CAMPAIGN_TEMPLATE,
    vehicle_reference_mode: 'model' as 'make' | 'model',
    assignment_mode: 'single_user' as 'single_user' | 'random_distribution',
    assigned_to: '',
    delay_seconds: 65,
    use_customer_name: true,
  });

  // Update template when vehicle reference mode changes
  const handleVehicleModeChange = (mode: 'make' | 'model') => {
    const defaultTemplate = mode === 'make' ? MAKE_CAMPAIGN_TEMPLATE : MODEL_CAMPAIGN_TEMPLATE;
    setNewCampaign({ 
      ...newCampaign, 
      vehicle_reference_mode: mode,
      message_template: defaultTemplate 
    });
  };

  const supabase = createClient();

  // Fetch logs for a campaign
  const fetchLogs = async (campaignId: string, since?: string) => {
    try {
      const url = since 
        ? `/api/admin/campaigns/${campaignId}/logs?since=${encodeURIComponent(since)}`
        : `/api/admin/campaigns/${campaignId}/logs`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return data.logs as CampaignLog[];
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
    return [];
  };

  // Toggle log viewer
  const toggleLogs = async (campaignId: string) => {
    if (expandedLogs === campaignId) {
      setExpandedLogs(null);
      return;
    }

    setExpandedLogs(campaignId);
    setIsLoadingLogs(campaignId);
    
    const logs = await fetchLogs(campaignId);
    setCampaignLogs(prev => ({ ...prev, [campaignId]: logs }));
    setIsLoadingLogs(null);
  };

  // Poll for new logs and campaign updates when a campaign is running
  useEffect(() => {
    if (!expandedLogs) return;

    const campaign = campaigns.find(c => c.id === expandedLogs);
    if (!campaign || campaign.status !== 'running') return;

    const interval = setInterval(async () => {
      // Fetch new logs
      const existingLogs = campaignLogs[expandedLogs] || [];
      const lastLog = existingLogs[existingLogs.length - 1];
      const newLogs = await fetchLogs(expandedLogs, lastLog?.created_at);
      
      if (newLogs.length > 0) {
        setCampaignLogs(prev => ({
          ...prev,
          [expandedLogs]: [...(prev[expandedLogs] || []), ...newLogs]
        }));
      }

      // Also refresh campaign data
      const response = await fetch(`/api/admin/campaigns/${expandedLogs}`);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(prev => prev.map(c => c.id === expandedLogs ? data.campaign : c));
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [expandedLogs, campaigns, campaignLogs]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [campaignLogs, expandedLogs]);

  // Get users for selected organization
  const orgUsers = users.filter(u => u.organization_id === newCampaign.organization_id);

  // Update preview when template or leads change
  useEffect(() => {
    if (csvLeads.length > 0 && newCampaign.message_template) {
      const sampleLead = csvLeads[0];
      const parsed = parseSpintax(newCampaign.message_template);
      const preview = replacePlaceholders(parsed, sampleLead, newCampaign.vehicle_reference_mode, newCampaign.use_customer_name);
      setPreviewMessage(preview);
    }
  }, [newCampaign.message_template, newCampaign.vehicle_reference_mode, newCampaign.use_customer_name, csvLeads]);

  // Parse CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV file must have headers and at least one data row');
        return;
      }

      // Parse headers (case-insensitive mapping)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Map headers to expected fields
      const headerMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        if (h.includes('phone')) headerMap.phone_number = i;
        else if (h === 'name') headerMap.name = i;
        else if (h === 'make') headerMap.make = i;
        else if (h === 'model') headerMap.model = i;
        else if (h.includes('kijiji') || h.includes('link')) headerMap.kijiji_link = i;
      });

      if (headerMap.phone_number === undefined) {
        toast.error('CSV must have a phone number column');
        return;
      }

      // Parse data rows
      const leads: CSVLead[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values[headerMap.phone_number]) {
          leads.push({
            phone_number: values[headerMap.phone_number] || '',
            name: headerMap.name !== undefined ? values[headerMap.name] || '' : '',
            make: headerMap.make !== undefined ? values[headerMap.make] || '' : '',
            model: headerMap.model !== undefined ? values[headerMap.model] || '' : '',
            kijiji_link: headerMap.kijiji_link !== undefined ? values[headerMap.kijiji_link] || '' : '',
          });
        }
      }

      setCsvLeads(leads);
      toast.success(`Loaded ${leads.length} leads from CSV`);
    };

    reader.readAsText(file);
  };

  // Create campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (csvLeads.length === 0) {
      toast.error('Please upload a CSV file with leads');
      return;
    }

    if (!newCampaign.organization_id) {
      toast.error('Please select an organization');
      return;
    }

    if (newCampaign.assignment_mode === 'single_user' && !newCampaign.assigned_to) {
      toast.error('Please select a user to assign leads to');
      return;
    }

    setIsCreating(true);

    try {
      // Create campaign via API
      const response = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCampaign,
          leads: csvLeads,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      setCampaigns([data.campaign, ...campaigns]);
      setIsDialogOpen(false);
      resetForm();
      toast.success('Campaign created! It will start sending messages shortly.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create campaign');
    } finally {
      setIsCreating(false);
    }
  };

  // Start/Pause/Cancel campaign
  const handleCampaignAction = async (campaignId: string, action: 'start' | 'pause' | 'cancel') => {
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} campaign`);
      }

      setCampaigns(campaigns.map(c => c.id === campaignId ? data.campaign : c));
      toast.success(`Campaign ${action === 'start' ? 'started' : action === 'pause' ? 'paused' : 'cancelled'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} campaign`);
    }
  };

  // Delete campaign
  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete campaign');
      }

      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      toast.success('Campaign deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete campaign');
    }
  };

  const resetForm = () => {
    setNewCampaign({
      name: '',
      organization_id: '',
      message_template: MODEL_CAMPAIGN_TEMPLATE,
      vehicle_reference_mode: 'model',
      assignment_mode: 'single_user',
      assigned_to: '',
      delay_seconds: 65,
      use_customer_name: true,
    });
    setCsvLeads([]);
    setCsvFileName(null);
    setPreviewMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">Draft</Badge>;
      case 'running':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse">Running</Badge>;
      case 'paused':
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Paused</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="h-screen overflow-auto p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Campaigns</h1>
            <p className="text-gray-500 mt-1">Create and manage mass text campaigns</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#12121a] border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-purple-400" />
                  Create Campaign
                </DialogTitle>
                <DialogDescription className="text-gray-500">
                  Upload a CSV and configure your mass text campaign
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateCampaign} className="space-y-6 mt-4">
                {/* Campaign Name */}
                <div className="space-y-2">
                  <Label className="text-gray-400">Campaign Name</Label>
                  <Input
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    placeholder="January Outreach"
                    className="bg-[#1a1a24] border-gray-800 text-white"
                    required
                  />
                </div>

                {/* Organization Selection */}
                <div className="space-y-2">
                  <Label className="text-gray-400">Organization</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        type="button"
                        variant="outline" 
                        className="w-full justify-between bg-[#1a1a24] border-gray-800 text-white hover:bg-[#252532]"
                      >
                        {newCampaign.organization_id 
                          ? organizations.find(o => o.id === newCampaign.organization_id)?.name 
                          : 'Select organization'}
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[#1a1a24] border-gray-800 w-full">
                      {organizations.map((org) => (
                        <DropdownMenuItem
                          key={org.id}
                          onClick={() => setNewCampaign({ ...newCampaign, organization_id: org.id, assigned_to: '' })}
                          className="cursor-pointer hover:bg-purple-500/10"
                        >
                          {org.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* CSV Upload */}
                <div className="space-y-2">
                  <Label className="text-gray-400">Upload Leads CSV</Label>
                  <div 
                    className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-purple-500/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {csvFileName ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-400" />
                        <span className="text-emerald-400">{csvFileName}</span>
                        <Badge className="bg-emerald-500/10 text-emerald-400">
                          {csvLeads.length} leads
                        </Badge>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Click to upload CSV file</p>
                        <p className="text-xs text-gray-600 mt-1">Headers: Phone number, Name, Make, Model, Kijiji Link</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Assignment Mode */}
                <div className="space-y-2">
                  <Label className="text-gray-400">Lead Assignment</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewCampaign({ ...newCampaign, assignment_mode: 'single_user' })}
                      className={`p-3 rounded-xl border transition-all ${
                        newCampaign.assignment_mode === 'single_user'
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <Users className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                      <p className="text-sm text-white">Single User</p>
                      <p className="text-xs text-gray-500">Assign all to one person</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCampaign({ ...newCampaign, assignment_mode: 'random_distribution' })}
                      className={`p-3 rounded-xl border transition-all ${
                        newCampaign.assignment_mode === 'random_distribution'
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <Shuffle className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                      <p className="text-sm text-white">Random Distribution</p>
                      <p className="text-xs text-gray-500">Distribute fairly among team</p>
                    </button>
                  </div>
                </div>

                {/* User Selection (for single user mode) */}
                {newCampaign.assignment_mode === 'single_user' && newCampaign.organization_id && (
                  <div className="space-y-2">
                    <Label className="text-gray-400">Assign To</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          type="button"
                          variant="outline" 
                          className="w-full justify-between bg-[#1a1a24] border-gray-800 text-white hover:bg-[#252532]"
                        >
                          {newCampaign.assigned_to 
                            ? orgUsers.find(u => u.id === newCampaign.assigned_to)?.full_name || orgUsers.find(u => u.id === newCampaign.assigned_to)?.email
                            : 'Select user'}
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-[#1a1a24] border-gray-800">
                        {orgUsers.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">No users in this organization</div>
                        ) : (
                          orgUsers.map((user) => (
                            <DropdownMenuItem
                              key={user.id}
                              onClick={() => setNewCampaign({ ...newCampaign, assigned_to: user.id })}
                              className="cursor-pointer hover:bg-purple-500/10"
                            >
                              <div>
                                <p className="text-white">{user.full_name || user.email}</p>
                                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                              </div>
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                {/* Vehicle Reference Mode */}
                <div className="space-y-2">
                  <Label className="text-gray-400">Vehicle Reference in Message</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleVehicleModeChange('model')}
                      className={`p-3 rounded-xl border transition-all ${
                        newCampaign.vehicle_reference_mode === 'model'
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <Car className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                      <p className="text-sm text-white">Use Model</p>
                      <p className="text-xs text-gray-500">e.g. "2023 Dodge Charger"</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVehicleModeChange('make')}
                      className={`p-3 rounded-xl border transition-all ${
                        newCampaign.vehicle_reference_mode === 'make'
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <Car className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                      <p className="text-sm text-white">Use Make</p>
                      <p className="text-xs text-gray-500">e.g. "Dodge"</p>
                    </button>
                  </div>
                </div>

                {/* Customer Name Toggle */}
                <div className="space-y-2">
                  <Label className="text-gray-400">Use Customer Name</Label>
                  <button
                    type="button"
                    onClick={() => setNewCampaign({ ...newCampaign, use_customer_name: !newCampaign.use_customer_name })}
                    className={`w-full p-3 rounded-xl border transition-all flex items-center justify-between ${
                      newCampaign.use_customer_name
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-6 rounded-full transition-all relative ${
                        newCampaign.use_customer_name ? 'bg-emerald-500' : 'bg-gray-700'
                      }`}>
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                          newCampaign.use_customer_name ? 'right-1' : 'left-1'
                        }`} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-white">
                          {newCampaign.use_customer_name ? 'Personalized' : 'Generic'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {newCampaign.use_customer_name 
                            ? 'e.g. "Hey Brett,"' 
                            : 'e.g. "Hey there,"'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Message Template */}
                <div className="space-y-2">
                  <Label className="text-gray-400">Message Template (Spintax)</Label>
                  <textarea
                    value={newCampaign.message_template}
                    onChange={(e) => setNewCampaign({ ...newCampaign, message_template: e.target.value })}
                    placeholder="Enter your message with spintax..."
                    className="w-full h-32 px-4 py-3 bg-[#1a1a24] border border-gray-800 rounded-xl text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-purple-500/50"
                    required
                  />
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong>Placeholders:</strong> [Customer Name], [Make], [Model]</p>
                    <p><strong>Spintax:</strong> Use {'{option1|option2|option3}'} for random variations</p>
                  </div>
                </div>

                {/* Preview */}
                {previewMessage && (
                  <div className="space-y-2">
                    <Label className="text-gray-400">Message Preview</Label>
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <p className="text-sm text-white">{previewMessage}</p>
                    </div>
                  </div>
                )}

                {/* Delay Setting */}
                <div className="space-y-2">
                  <Label className="text-gray-400">Delay Between Messages (seconds)</Label>
                  <Input
                    type="number"
                    min="60"
                    max="120"
                    value={newCampaign.delay_seconds}
                    onChange={(e) => setNewCampaign({ ...newCampaign, delay_seconds: parseInt(e.target.value) || 65 })}
                    className="bg-[#1a1a24] border-gray-800 text-white"
                  />
                  <p className="text-xs text-gray-500">Recommended: 60-70 seconds to avoid spam filters</p>
                </div>

                {/* Submit */}
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
                    disabled={isCreating || csvLeads.length === 0}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Megaphone className="w-4 h-4 mr-2" />
                        Create & Start Campaign
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Campaigns List */}
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <Card className="bg-[#12121a] border-gray-800">
              <CardContent className="py-12 text-center">
                <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-400">No campaigns yet</h3>
                <p className="text-sm text-gray-600 mt-1">Create your first mass text campaign</p>
              </CardContent>
            </Card>
          ) : (
            campaigns.map((campaign) => (
              <Card key={campaign.id} className="bg-[#12121a] border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      campaign.status === 'running' 
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                        : 'bg-purple-500/10'
                    }`}>
                      <Megaphone className={`w-5 h-5 ${campaign.status === 'running' ? 'text-white' : 'text-purple-400'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-white">{campaign.name}</CardTitle>
                      <p className="text-xs text-gray-500">
                        {organizations.find(o => o.id === campaign.organization_id)?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(campaign.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-white">{campaign.sent_count} / {campaign.total_leads}</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${campaign.total_leads > 0 ? (campaign.sent_count / campaign.total_leads) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-2 bg-[#0a0a0f] rounded-lg">
                      <p className="text-lg font-bold text-white">{campaign.total_leads}</p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                    <div className="text-center p-2 bg-[#0a0a0f] rounded-lg">
                      <p className="text-lg font-bold text-emerald-400">{campaign.sent_count}</p>
                      <p className="text-xs text-gray-500">Sent</p>
                    </div>
                    <div className="text-center p-2 bg-[#0a0a0f] rounded-lg">
                      <p className="text-lg font-bold text-red-400">{campaign.failed_count}</p>
                      <p className="text-xs text-gray-500">Failed</p>
                    </div>
                    <div className="text-center p-2 bg-[#0a0a0f] rounded-lg">
                      <p className="text-lg font-bold text-gray-400">{campaign.total_leads - campaign.sent_count - campaign.failed_count}</p>
                      <p className="text-xs text-gray-500">Pending</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Created {format(new Date(campaign.created_at), 'MMM d, yyyy h:mm a')}
                      {campaign.started_at && (
                        <span className="ml-2">• Started {format(new Date(campaign.started_at), 'h:mm a')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Log Viewer Toggle */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleLogs(campaign.id)}
                        className="border-gray-700 text-gray-400 hover:bg-gray-800"
                      >
                        <Terminal className="w-4 h-4 mr-1" />
                        Logs
                        {expandedLogs === campaign.id ? (
                          <ChevronUp className="w-4 h-4 ml-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 ml-1" />
                        )}
                      </Button>
                      
                      {campaign.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => handleCampaignAction(campaign.id, 'start')}
                          className="bg-emerald-500 hover:bg-emerald-600"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                      )}
                      {campaign.status === 'running' && (
                        <Button
                          size="sm"
                          onClick={() => handleCampaignAction(campaign.id, 'pause')}
                          className="bg-amber-500 hover:bg-amber-600"
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleCampaignAction(campaign.id, 'start')}
                            className="bg-emerald-500 hover:bg-emerald-600"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Resume
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCampaignAction(campaign.id, 'cancel')}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            <StopCircle className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {(campaign.status === 'completed' || campaign.status === 'cancelled') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Log Viewer */}
                  {expandedLogs === campaign.id && (
                    <div className="mt-4 bg-[#0a0a0f] rounded-xl border border-gray-800 overflow-hidden">
                      <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-400">Campaign Logs</span>
                        {campaign.status === 'running' && (
                          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            Live
                          </span>
                        )}
                      </div>
                      <div className="h-64 overflow-y-auto p-3 font-mono text-xs space-y-1">
                        {isLoadingLogs === campaign.id ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                          </div>
                        ) : (campaignLogs[campaign.id] || []).length === 0 ? (
                          <div className="flex items-center justify-center h-full text-gray-600">
                            No logs yet...
                          </div>
                        ) : (
                          <>
                            {(campaignLogs[campaign.id] || []).map((log) => (
                              <div key={log.id} className="flex items-start gap-2">
                                <span className="text-gray-600 shrink-0">
                                  {format(new Date(log.created_at), 'HH:mm:ss')}
                                </span>
                                {log.level === 'error' && <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />}
                                {log.level === 'warning' && <AlertCircle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />}
                                {log.level === 'success' && <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />}
                                {log.level === 'info' && <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />}
                                <span className={`
                                  ${log.level === 'error' ? 'text-red-400' : ''}
                                  ${log.level === 'warning' ? 'text-amber-400' : ''}
                                  ${log.level === 'success' ? 'text-emerald-400' : ''}
                                  ${log.level === 'info' ? 'text-gray-300' : ''}
                                `}>
                                  {log.message}
                                </span>
                              </div>
                            ))}
                            <div ref={logsEndRef} />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

