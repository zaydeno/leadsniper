import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/stats - Get statistics based on user role
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get time period from query params
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      default: // daily
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    const startDateStr = startDate.toISOString();

    // Build stats based on role
    let stats: Record<string, unknown> = {};

    if (profile.role === 'sales') {
      stats = await getSalesRepStats(adminClient, user.id, startDateStr);
    } else if (profile.role === 'org_admin') {
      stats = await getOrgAdminStats(adminClient, profile.organization_id!, startDateStr);
    } else if (profile.role === 'superadmin') {
      stats = await getSuperAdminStats(adminClient, startDateStr);
    }

    return NextResponse.json({ stats, period, role: profile.role });

  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Stats for Sales Reps - only their own data
async function getSalesRepStats(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  startDate: string
) {
  // Get threads assigned to this user
  const { data: threads } = await adminClient
    .from('threads')
    .select('id, flag, created_at')
    .eq('assigned_to', userId);

  const threadIds = (threads || []).map(t => t.id);

  // Count leads (threads) received in period
  const leadsReceived = (threads || []).filter(t => 
    new Date(t.created_at) >= new Date(startDate)
  ).length;

  // Get messages for these threads
  const { data: messages } = await adminClient
    .from('messages')
    .select('id, direction, created_at')
    .in('thread_id', threadIds.length > 0 ? threadIds : ['none'])
    .gte('created_at', startDate);

  const messagesReceived = (messages || []).filter(m => m.direction === 'inbound').length;
  const messagesSent = (messages || []).filter(m => m.direction === 'outbound').length;

  // Flag breakdown for all threads (not just period)
  const flagCounts = {
    no_response: 0,
    active: 0,
    booked: 0,
    dead: 0,
  };

  (threads || []).forEach(t => {
    const flag = t.flag || 'no_response';
    if (flag in flagCounts) {
      flagCounts[flag as keyof typeof flagCounts]++;
    }
  });

  return {
    leadsReceived,
    messagesReceived,
    messagesSent,
    totalThreads: threads?.length || 0,
    flagBreakdown: flagCounts,
  };
}

// Stats for Org Admins - their organization's data
async function getOrgAdminStats(
  adminClient: ReturnType<typeof createAdminClient>,
  organizationId: string,
  startDate: string
) {
  // Get all threads for the organization
  const { data: threads } = await adminClient
    .from('threads')
    .select('id, flag, assigned_to, created_at')
    .eq('organization_id', organizationId);

  const threadIds = (threads || []).map(t => t.id);

  // Count leads received in period
  const leadsReceived = (threads || []).filter(t => 
    new Date(t.created_at) >= new Date(startDate)
  ).length;

  // Get all messages for these threads
  const { data: messages } = await adminClient
    .from('messages')
    .select('id, direction, assigned_to, created_at')
    .in('thread_id', threadIds.length > 0 ? threadIds : ['none'])
    .gte('created_at', startDate);

  const messagesReceived = (messages || []).filter(m => m.direction === 'inbound').length;
  const messagesSent = (messages || []).filter(m => m.direction === 'outbound').length;

  // Flag breakdown
  const flagCounts = {
    no_response: 0,
    active: 0,
    booked: 0,
    dead: 0,
  };

  (threads || []).forEach(t => {
    const flag = t.flag || 'no_response';
    if (flag in flagCounts) {
      flagCounts[flag as keyof typeof flagCounts]++;
    }
  });

  // Get team members
  const { data: teamMembers } = await adminClient
    .from('profiles')
    .select('id, full_name, username')
    .eq('organization_id', organizationId)
    .in('role', ['sales', 'org_admin']);

  // Per-salesperson breakdown
  const perSalesperson: Record<string, {
    name: string;
    leadsReceived: number;
    messagesReceived: number;
    messagesSent: number;
  }> = {};

  (teamMembers || []).forEach(member => {
    const memberThreads = (threads || []).filter(t => t.assigned_to === member.id);
    const memberLeads = memberThreads.filter(t => 
      new Date(t.created_at) >= new Date(startDate)
    ).length;

    const memberMessages = (messages || []).filter(m => m.assigned_to === member.id);
    
    perSalesperson[member.id] = {
      name: member.full_name || member.username || 'Unknown',
      leadsReceived: memberLeads,
      messagesReceived: memberMessages.filter(m => m.direction === 'inbound').length,
      messagesSent: memberMessages.filter(m => m.direction === 'outbound').length,
    };
  });

  return {
    leadsReceived,
    messagesReceived,
    messagesSent,
    totalThreads: threads?.length || 0,
    flagBreakdown: flagCounts,
    perSalesperson,
  };
}

// Stats for Super Admins - all organizations
async function getSuperAdminStats(
  adminClient: ReturnType<typeof createAdminClient>,
  startDate: string
) {
  // Get all threads
  const { data: threads } = await adminClient
    .from('threads')
    .select('id, flag, organization_id, created_at');

  const threadIds = (threads || []).map(t => t.id);

  // Count leads received in period
  const leadsReceived = (threads || []).filter(t => 
    new Date(t.created_at) >= new Date(startDate)
  ).length;

  // Get all messages
  const { data: messages } = await adminClient
    .from('messages')
    .select('id, direction, organization_id, created_at')
    .in('thread_id', threadIds.length > 0 ? threadIds : ['none'])
    .gte('created_at', startDate);

  const messagesReceived = (messages || []).filter(m => m.direction === 'inbound').length;
  const messagesSent = (messages || []).filter(m => m.direction === 'outbound').length;

  // Flag breakdown
  const flagCounts = {
    no_response: 0,
    active: 0,
    booked: 0,
    dead: 0,
  };

  (threads || []).forEach(t => {
    const flag = t.flag || 'no_response';
    if (flag in flagCounts) {
      flagCounts[flag as keyof typeof flagCounts]++;
    }
  });

  // Get all organizations
  const { data: organizations } = await adminClient
    .from('organizations')
    .select('id, name');

  // Per-organization breakdown
  const perOrganization: Record<string, {
    name: string;
    leadsReceived: number;
    messagesReceived: number;
    messagesSent: number;
    totalThreads: number;
  }> = {};

  (organizations || []).forEach(org => {
    const orgThreads = (threads || []).filter(t => t.organization_id === org.id);
    const orgLeads = orgThreads.filter(t => 
      new Date(t.created_at) >= new Date(startDate)
    ).length;

    const orgMessages = (messages || []).filter(m => m.organization_id === org.id);
    
    perOrganization[org.id] = {
      name: org.name,
      leadsReceived: orgLeads,
      messagesReceived: orgMessages.filter(m => m.direction === 'inbound').length,
      messagesSent: orgMessages.filter(m => m.direction === 'outbound').length,
      totalThreads: orgThreads.length,
    };
  });

  return {
    leadsReceived,
    messagesReceived,
    messagesSent,
    totalThreads: threads?.length || 0,
    flagBreakdown: flagCounts,
    perOrganization,
  };
}

