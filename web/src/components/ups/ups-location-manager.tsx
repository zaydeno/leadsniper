'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, MapPin, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UpsLocation } from '@/lib/types';
import { cn } from '@/lib/utils';

interface UpsLocationManagerProps {
  locations: UpsLocation[];
  onUpdate: () => void;
}

export function UpsLocationManager({ locations, onUpdate }: UpsLocationManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState('');

  // Sort by display_order
  const sortedLocations = [...locations].sort((a, b) => a.display_order - b.display_order);

  const resetForm = () => {
    setName('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Please enter a location name');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/ups/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add location');
      }

      toast.success('Location added');
      resetForm();
      onUpdate();
    } catch (error) {
      toast.error('Failed to add location', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (location: UpsLocation) => {
    if (!name.trim()) {
      toast.error('Please enter a location name');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/ups/locations/${location.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update location');
      }

      toast.success('Location updated');
      resetForm();
      onUpdate();
    } catch (error) {
      toast.error('Failed to update location', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (location: UpsLocation) => {
    if (!confirm(`Are you sure you want to delete "${location.name}"?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/ups/locations/${location.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete location');
      }

      toast.success('Location deleted');
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete location', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (location: UpsLocation) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/ups/locations/${location.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !location.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update location');
      }

      toast.success(location.is_active ? 'Location deactivated' : 'Location activated');
      onUpdate();
    } catch (error) {
      toast.error('Failed to update location', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (location: UpsLocation) => {
    setEditingId(location.id);
    setName(location.name);
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
          Add Location
        </Button>
      )}

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="bg-[#1a1a24] rounded-xl p-4 border border-gray-700 space-y-4">
          <h3 className="font-medium text-white">
            {isAdding ? 'Add New Location' : 'Edit Location'}
          </h3>
          
          <div>
            <Label htmlFor="location-name" className="text-gray-400">Location Name</Label>
            <div className="relative mt-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                id="location-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Used Lot, Service Drive, Showroom"
                className="pl-10 bg-[#12121a] border-gray-700 text-white h-12 text-lg"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingId) {
                      const location = locations.find(l => l.id === editingId);
                      if (location) handleEdit(location);
                    } else {
                      handleAdd();
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (editingId) {
                  const location = locations.find(l => l.id === editingId);
                  if (location) handleEdit(location);
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

      {/* Locations List */}
      <div className="space-y-2">
        {sortedLocations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No locations yet</p>
            <p className="text-sm">Add your first location above</p>
          </div>
        ) : (
          sortedLocations.map((location) => (
            <div
              key={location.id}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border transition-colors',
                location.is_active
                  ? 'bg-[#1a1a24] border-gray-700'
                  : 'bg-[#1a1a24]/50 border-gray-800 opacity-60'
              )}
            >
              {/* Active Toggle */}
              <button
                onClick={() => handleToggleActive(location)}
                disabled={isLoading}
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  'active:scale-95 touch-manipulation',
                  location.is_active
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'bg-gray-700/50 text-gray-500'
                )}
              >
                <Check className="w-5 h-5" />
              </button>

              {/* Location Info */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <MapPin className={cn(
                  'w-4 h-4 flex-shrink-0',
                  location.is_active ? 'text-emerald-400' : 'text-gray-500'
                )} />
                <p className={cn(
                  'font-medium truncate text-lg',
                  location.is_active ? 'text-white' : 'text-gray-500'
                )}>
                  {location.name}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => startEditing(location)}
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-white hover:bg-[#252530]"
                  disabled={isLoading}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(location)}
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

      {/* Quick Add Suggestions */}
      {sortedLocations.length === 0 && !isAdding && (
        <div className="pt-4 border-t border-gray-800">
          <p className="text-sm text-gray-500 mb-3">Quick add common locations:</p>
          <div className="flex flex-wrap gap-2">
            {['Used Lot', 'New Lot', 'Service Drive', 'Showroom', 'Parts Counter'].map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const response = await fetch('/api/ups/locations', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: suggestion }),
                    });
                    if (response.ok) {
                      toast.success(`Added "${suggestion}"`);
                      onUpdate();
                    }
                  } catch {
                    toast.error('Failed to add location');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="bg-transparent border-gray-700 hover:bg-[#252530] text-gray-400 hover:text-white"
              >
                <Plus className="w-3 h-3 mr-1" />
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
