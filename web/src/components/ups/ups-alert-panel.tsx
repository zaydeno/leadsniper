'use client';

import { useState, useCallback } from 'react';
import { Settings, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UpsTeamMember, UpsLocation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { UpsTeamManager } from './ups-team-manager';
import { UpsLocationManager } from './ups-location-manager';

interface UpsAlertPanelProps {
  initialTeamMembers: UpsTeamMember[];
  initialLocations: UpsLocation[];
}

export function UpsAlertPanel({ initialTeamMembers, initialLocations }: UpsAlertPanelProps) {
  const [teamMembers, setTeamMembers] = useState<UpsTeamMember[]>(initialTeamMembers);
  const [locations, setLocations] = useState<UpsLocation[]>(initialLocations);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(initialTeamMembers.filter(m => m.is_active).map(m => m.id))
  );
  const [isSending, setIsSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'team' | 'locations'>('team');

  // Filter active members and locations
  const activeMembers = teamMembers.filter(m => m.is_active);
  const activeLocations = locations.filter(l => l.is_active);

  // Toggle member selection
  const toggleMember = useCallback((memberId: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }, []);

  // Toggle all members
  const toggleAllMembers = useCallback(() => {
    if (selectedMembers.size === activeMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(activeMembers.map(m => m.id)));
    }
  }, [activeMembers, selectedMembers.size]);

  // Send alert
  const sendAlert = async () => {
    if (!selectedLocation) {
      toast.error('Please select a location');
      return;
    }

    if (selectedMembers.size === 0) {
      toast.error('Please select at least one team member');
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/ups/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: selectedLocation,
          recipient_ids: Array.from(selectedMembers),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send alert');
      }

      toast.success(`Alert sent to ${selectedMembers.size} team member${selectedMembers.size > 1 ? 's' : ''}!`, {
        description: `Location: ${activeLocations.find(l => l.id === selectedLocation)?.name}`,
      });

      // Reset location selection after successful send
      setSelectedLocation(null);
    } catch (error) {
      toast.error('Failed to send alert', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Refresh data after settings changes
  const refreshData = async () => {
    try {
      const [teamRes, locRes] = await Promise.all([
        fetch('/api/ups/team-members'),
        fetch('/api/ups/locations'),
      ]);

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeamMembers(teamData.members || []);
        // Update selected members to only include active ones
        setSelectedMembers(prev => {
          const activeIds = new Set((teamData.members || []).filter((m: UpsTeamMember) => m.is_active).map((m: UpsTeamMember) => m.id));
          return new Set([...prev].filter(id => activeIds.has(id)));
        });
      }

      if (locRes.ok) {
        const locData = await locRes.json();
        setLocations(locData.locations || []);
        // Clear selected location if it's no longer active
        if (selectedLocation) {
          const stillActive = (locData.locations || []).some((l: UpsLocation) => l.id === selectedLocation && l.is_active);
          if (!stillActive) {
            setSelectedLocation(null);
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  const selectedLocationName = activeLocations.find(l => l.id === selectedLocation)?.name;
  const allSelected = selectedMembers.size === activeMembers.length && activeMembers.length > 0;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header with Settings */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">UPS Alert</h1>
          <p className="text-gray-400 text-sm mt-1">Send location alerts to your team</p>
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              className="bg-[#1a1a24] border-gray-700 hover:bg-[#252530] hover:border-gray-600"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#12121a] border-gray-800 max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Settings Tabs */}
            <div className="flex gap-2 border-b border-gray-800 pb-4">
              <Button
                variant={settingsTab === 'team' ? 'default' : 'ghost'}
                onClick={() => setSettingsTab('team')}
                className={cn(
                  settingsTab === 'team' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'text-gray-400 hover:text-white'
                )}
              >
                Team Members
              </Button>
              <Button
                variant={settingsTab === 'locations' ? 'default' : 'ghost'}
                onClick={() => setSettingsTab('locations')}
                className={cn(
                  settingsTab === 'locations' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'text-gray-400 hover:text-white'
                )}
              >
                Locations
              </Button>
            </div>
            
            {/* Settings Content */}
            <div className="flex-1 overflow-y-auto">
              {settingsTab === 'team' ? (
                <UpsTeamManager 
                  teamMembers={teamMembers} 
                  onUpdate={refreshData} 
                />
              ) : (
                <UpsLocationManager 
                  locations={locations} 
                  onUpdate={refreshData} 
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Location Selection */}
      <Card className="bg-[#12121a] border-gray-800 mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <span className="text-2xl">📍</span>
            Select Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeLocations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No locations configured</p>
              <Button
                variant="link"
                className="text-emerald-400 mt-2"
                onClick={() => {
                  setSettingsTab('locations');
                  setSettingsOpen(true);
                }}
              >
                Add locations in settings
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {activeLocations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => setSelectedLocation(location.id)}
                  className={cn(
                    'p-4 md:p-6 rounded-xl border-2 transition-all duration-200 text-center font-medium text-lg',
                    'active:scale-95 touch-manipulation',
                    selectedLocation === location.id
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'bg-[#1a1a24] border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-[#252530]'
                  )}
                >
                  {location.name}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Selection */}
      <Card className="bg-[#12121a] border-gray-800 mb-6 flex-1 overflow-hidden flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <span className="text-2xl">👥</span>
              Select Team
            </CardTitle>
            {activeMembers.length > 0 && (
              <button
                onClick={toggleAllMembers}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium',
                  'active:scale-95 touch-manipulation',
                  allSelected
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'bg-[#1a1a24] text-gray-400 hover:text-white'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                  allSelected
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-gray-600'
                )}>
                  {allSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                Select All
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {activeMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No team members configured</p>
              <Button
                variant="link"
                className="text-emerald-400 mt-2"
                onClick={() => {
                  setSettingsTab('team');
                  setSettingsOpen(true);
                }}
              >
                Add team members in settings
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {activeMembers.map((member) => {
                const isSelected = selectedMembers.has(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all duration-200 text-left',
                      'active:scale-95 touch-manipulation',
                      isSelected
                        ? 'bg-emerald-600/20 border-emerald-500 shadow-lg shadow-emerald-500/20'
                        : 'bg-[#1a1a24] border-gray-700 hover:border-gray-600 hover:bg-[#252530]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-gray-600'
                      )}>
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          'font-medium truncate',
                          isSelected ? 'text-emerald-400' : 'text-gray-300'
                        )}>
                          {member.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {member.phone_number}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Alert Button */}
      <Button
        onClick={sendAlert}
        disabled={isSending || !selectedLocation || selectedMembers.size === 0}
        className={cn(
          'w-full py-8 text-xl font-bold rounded-xl transition-all duration-200',
          'active:scale-[0.98] touch-manipulation',
          'bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500',
          'shadow-lg shadow-emerald-500/30 disabled:shadow-none'
        )}
      >
        {isSending ? (
          <>
            <Loader2 className="w-6 h-6 mr-3 animate-spin" />
            Sending Alert...
          </>
        ) : (
          <>
            <AlertTriangle className="w-6 h-6 mr-3" />
            🚨 SEND ALERT
            {selectedMembers.size > 0 && (
              <span className="ml-2 text-base font-normal opacity-80">
                ({selectedMembers.size} {selectedMembers.size === 1 ? 'person' : 'people'} will be notified)
              </span>
            )}
          </>
        )}
      </Button>

      {/* Status indicator */}
      {selectedLocation && selectedMembers.size > 0 && (
        <p className="text-center text-gray-500 text-sm mt-4">
          Ready to alert <span className="text-emerald-400">{selectedMembers.size}</span> team member{selectedMembers.size > 1 ? 's' : ''} about{' '}
          <span className="text-emerald-400">{selectedLocationName}</span>
        </p>
      )}
    </div>
  );
}
