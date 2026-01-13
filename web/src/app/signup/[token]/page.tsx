'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, User, Lock, ArrowRight, Building2, AlertCircle } from 'lucide-react';
import { InviteToken } from '@/lib/types';

export default function SignupPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteToken | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  // Validate token on load
  useEffect(() => {
    const validateToken = async () => {
      setIsValidating(true);
      
      const { data, error } = await supabase
        .from('invite_tokens')
        .select('*, organization:organizations(*)')
        .eq('token', token)
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        setError('This invite link is invalid or has expired.');
        setInvite(null);
      } else {
        setInvite(data as InviteToken);
        setError(null);
      }
      
      setIsValidating(false);
    };

    validateToken();
  }, [token, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!invite) {
      setError('Invalid invite token');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call the signup API (uses admin client to bypass RLS)
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.toLowerCase(),
          password,
          fullName,
          token,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Signup failed');
      }

      // Sign in with the new account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });

      if (signInError) throw signInError;

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
        <Card className="w-full max-w-md bg-[#12121a]/80 backdrop-blur-xl border-red-500/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Invalid Invite</h2>
              <p className="text-gray-500 mb-6">{error}</p>
              <Button
                onClick={() => router.push('/login')}
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-white/5"
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleLabel = invite.role === 'superadmin' ? 'Super Admin' : invite.role === 'org_admin' ? 'Organization Admin' : 'Sales Rep';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-cyan-500/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <Card className="w-full max-w-md bg-[#12121a]/80 backdrop-blur-xl border-emerald-500/20 shadow-2xl shadow-emerald-500/5 relative z-10">
        <CardHeader className="space-y-4 text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Create Account
            </CardTitle>
            <CardDescription className="text-gray-500 mt-1">
              You&apos;ve been invited to join LeadSniper
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Organization info */}
          <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 text-emerald-400">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">
                {invite.organization ? (invite.organization as { name: string }).name : 'System'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Role: {roleLabel}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-gray-400 text-sm font-medium">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-[#1a1a24] border-gray-800 text-white placeholder:text-gray-600 focus:border-emerald-500 h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-400 text-sm font-medium">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="pl-10 bg-[#1a1a24] border-gray-800 text-white placeholder:text-gray-600 focus:border-emerald-500 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-400 text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-[#1a1a24] border-gray-800 text-white placeholder:text-gray-600 focus:border-emerald-500 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-400 text-sm font-medium">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-[#1a1a24] border-gray-800 text-white placeholder:text-gray-600 focus:border-emerald-500 h-11"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-sm p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium shadow-lg shadow-emerald-500/25 group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
