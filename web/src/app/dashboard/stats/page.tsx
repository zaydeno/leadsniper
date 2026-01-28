'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  MessageSquare, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Building2,
  UserCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Period = 'daily' | 'weekly' | 'monthly';

interface FlagBreakdown {
  no_response: number;
  active: number;
  booked: number;
  dead: number;
}

interface PerSalesperson {
  [key: string]: {
    name: string;
    leadsReceived: number;
    messagesReceived: number;
    messagesSent: number;
  };
}

interface PerOrganization {
  [key: string]: {
    name: string;
    leadsReceived: number;
    messagesReceived: number;
    messagesSent: number;
    totalThreads: number;
  };
}

interface Stats {
  leadsReceived: number;
  messagesReceived: number;
  messagesSent: number;
  totalThreads: number;
  flagBreakdown: FlagBreakdown;
  perSalesperson?: PerSalesperson;
  perOrganization?: PerOrganization;
}

interface StatsResponse {
  stats: Stats;
  period: Period;
  role: 'sales' | 'org_admin' | 'superadmin';
}

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>('daily');
  const [stats, setStats] = useState<Stats | null>(null);
  const [role, setRole] = useState<string>('sales');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stats?period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data: StatsResponse = await response.json();
      setStats(data.stats);
      setRole(data.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const periodLabels = {
    daily: 'Today',
    weekly: 'This Week',
    monthly: 'This Month',
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <button 
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#0a0a0f]">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Statistics</h1>
            <p className="text-gray-500 mt-1">
              {role === 'superadmin' ? 'All Organizations' : 
               role === 'org_admin' ? 'Your Organization' : 'Your Performance'}
            </p>
          </div>
          
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-[#12121a] rounded-lg p-1 border border-gray-800/50">
            {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-all',
                  period === p
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Leads Received"
            value={stats?.leadsReceived || 0}
            period={periodLabels[period]}
            icon={Users}
            color="emerald"
          />
          <StatCard
            title="Messages Received"
            value={stats?.messagesReceived || 0}
            period={periodLabels[period]}
            icon={MessageSquare}
            color="cyan"
          />
          <StatCard
            title="Messages Sent"
            value={stats?.messagesSent || 0}
            period={periodLabels[period]}
            icon={TrendingUp}
            color="purple"
          />
        </div>

        {/* Flag Breakdown */}
        {stats?.flagBreakdown && (
          <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Lead Status Breakdown
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FlagCard 
                label="No Response" 
                value={stats.flagBreakdown.no_response} 
                total={stats.totalThreads}
                color="gray"
              />
              <FlagCard 
                label="Active" 
                value={stats.flagBreakdown.active} 
                total={stats.totalThreads}
                color="emerald"
              />
              <FlagCard 
                label="Booked" 
                value={stats.flagBreakdown.booked} 
                total={stats.totalThreads}
                color="blue"
              />
              <FlagCard 
                label="Dead" 
                value={stats.flagBreakdown.dead} 
                total={stats.totalThreads}
                color="red"
              />
            </div>
            
            {/* Visual Bar Chart */}
            <div className="mt-6 space-y-3">
              {stats.totalThreads > 0 && (
                <>
                  <FlagBar label="No Response" value={stats.flagBreakdown.no_response} total={stats.totalThreads} color="bg-gray-500" />
                  <FlagBar label="Active" value={stats.flagBreakdown.active} total={stats.totalThreads} color="bg-emerald-500" />
                  <FlagBar label="Booked" value={stats.flagBreakdown.booked} total={stats.totalThreads} color="bg-blue-500" />
                  <FlagBar label="Dead" value={stats.flagBreakdown.dead} total={stats.totalThreads} color="bg-red-500" />
                </>
              )}
            </div>
          </div>
        )}

        {/* Per Salesperson Breakdown (Org Admin) */}
        {role === 'org_admin' && stats?.perSalesperson && (
          <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-cyan-400" />
              Team Performance ({periodLabels[period]})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-500 text-sm border-b border-gray-800">
                    <th className="pb-3 font-medium">Team Member</th>
                    <th className="pb-3 font-medium text-right">Leads</th>
                    <th className="pb-3 font-medium text-right">Received</th>
                    <th className="pb-3 font-medium text-right">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.perSalesperson).map(([id, data]) => (
                    <tr key={id} className="border-b border-gray-800/50 hover:bg-white/5">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                            <span className="text-xs font-medium text-white">
                              {data.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-white font-medium">{data.name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right text-gray-300">{data.leadsReceived}</td>
                      <td className="py-4 text-right text-gray-300">{data.messagesReceived}</td>
                      <td className="py-4 text-right text-gray-300">{data.messagesSent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {Object.keys(stats.perSalesperson).length === 0 && (
                <p className="text-center text-gray-500 py-8">No team members found</p>
              )}
            </div>
          </div>
        )}

        {/* Per Organization Breakdown (Super Admin) */}
        {role === 'superadmin' && stats?.perOrganization && (
          <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              Organization Performance ({periodLabels[period]})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-500 text-sm border-b border-gray-800">
                    <th className="pb-3 font-medium">Organization</th>
                    <th className="pb-3 font-medium text-right">Total Threads</th>
                    <th className="pb-3 font-medium text-right">Leads</th>
                    <th className="pb-3 font-medium text-right">Received</th>
                    <th className="pb-3 font-medium text-right">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.perOrganization).map(([id, data]) => (
                    <tr key={id} className="border-b border-gray-800/50 hover:bg-white/5">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-white font-medium">{data.name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right text-gray-300">{data.totalThreads}</td>
                      <td className="py-4 text-right text-gray-300">{data.leadsReceived}</td>
                      <td className="py-4 text-right text-gray-300">{data.messagesReceived}</td>
                      <td className="py-4 text-right text-gray-300">{data.messagesSent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {Object.keys(stats.perOrganization).length === 0 && (
                <p className="text-center text-gray-500 py-8">No organizations found</p>
              )}
            </div>
          </div>
        )}

        {/* Total Threads Card */}
        <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Conversations</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.totalThreads || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  period, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: number; 
  period: string;
  icon: React.ElementType; 
  color: 'emerald' | 'cyan' | 'purple';
}) {
  const colors = {
    emerald: 'from-emerald-400 to-emerald-600 bg-emerald-500/10 text-emerald-400',
    cyan: 'from-cyan-400 to-cyan-600 bg-cyan-500/10 text-cyan-400',
    purple: 'from-purple-400 to-purple-600 bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          <p className="text-xs text-gray-600 mt-2">{period}</p>
        </div>
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          colors[color].split(' ')[2]
        )}>
          <Icon className={cn('w-6 h-6', colors[color].split(' ')[3])} />
        </div>
      </div>
    </div>
  );
}

function FlagCard({ 
  label, 
  value, 
  total,
  color 
}: { 
  label: string; 
  value: number; 
  total: number;
  color: 'gray' | 'emerald' | 'blue' | 'red';
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  const colors = {
    gray: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className={cn(
      'rounded-xl border p-4 text-center',
      colors[color]
    )}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
      <p className="text-xs mt-2 opacity-60">{percentage}%</p>
    </div>
  );
}

function FlagBar({ 
  label, 
  value, 
  total, 
  color 
}: { 
  label: string; 
  value: number; 
  total: number; 
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-400 w-24">{label}</span>
      <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-gray-400 w-12 text-right">{value}</span>
    </div>
  );
}

