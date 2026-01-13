'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsFormProps {
  profile: Profile | null;
  userEmail: string;
}

export function SettingsForm({ profile, userEmail }: SettingsFormProps) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [notificationNumber, setNotificationNumber] = useState(profile?.notification_number || '');
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          notification_number: notificationNumber || null,
        })
        .eq('id', profile?.id);

      if (error) throw error;

      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="bg-[#12121a] border-gray-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-white">Profile</CardTitle>
              <CardDescription className="text-gray-500">
                Your personal information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-gray-400">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="bg-[#1a1a24] border-gray-800 text-white placeholder:text-gray-600 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input
              value={userEmail}
              disabled
              className="bg-[#1a1a24] border-gray-800 text-gray-500"
            />
            <p className="text-xs text-gray-600">Email cannot be changed</p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Shield className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Role:</span>
            <Badge className={
              profile?.role === 'superadmin'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                : profile?.role === 'org_admin'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }>
              {profile?.role === 'superadmin' ? 'Super Admin' : profile?.role === 'org_admin' ? 'Org Admin' : 'Sales Rep'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card className="bg-[#12121a] border-gray-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Phone className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-white">Notifications</CardTitle>
              <CardDescription className="text-gray-500">
                Configure SMS notifications for new leads
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notificationNumber" className="text-gray-400">
              Notification Phone Number
            </Label>
            <Input
              id="notificationNumber"
              value={notificationNumber}
              onChange={(e) => setNotificationNumber(e.target.value)}
              placeholder="+1234567890"
              className="bg-[#1a1a24] border-gray-800 text-white placeholder:text-gray-600 focus:border-emerald-500"
            />
            <p className="text-xs text-gray-600">
              Enter your phone number in E.164 format to receive SMS alerts for new messages
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-500/25"
      >
        {isSaving ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </>
        )}
      </Button>
    </div>
  );
}

