import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

interface SendResult {
  member_id: string;
  name: string;
  phone_number: string;
  status: 'sent' | 'failed';
  error?: string;
}

// POST /api/ups/send-alert - Send UP alert to selected team members
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile and verify role
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*, organization:organizations(*)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only org_admin and superadmin can send alerts
    if (!['superadmin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { locationId, memberIds } = body;

    // Validate required fields
    if (!locationId) {
      return NextResponse.json(
        { error: 'Missing required field: locationId' },
        { status: 400 }
      );
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: memberIds (must be a non-empty array)' },
        { status: 400 }
      );
    }

    // Fetch the location
    const { data: location, error: locationError } = await adminClient
      .from('ups_locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Verify org_admin can only use locations from their organization
    if (profile.role === 'org_admin' && location.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the team members
    let membersQuery = adminClient
      .from('ups_team_members')
      .select('*')
      .in('id', memberIds)
      .eq('is_active', true);

    // Org admins can only send to members in their organization
    if (profile.role === 'org_admin') {
      membersQuery = membersQuery.eq('organization_id', profile.organization_id);
    }

    const { data: members, error: membersError } = await membersQuery;

    if (membersError) {
      console.error('Error fetching team members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
    }

    if (!members || members.length === 0) {
      return NextResponse.json(
        { error: 'No valid active recipients found' },
        { status: 400 }
      );
    }

    // Get organization SMS credentials
    // For org_admin, use their organization; for superadmin, use the location's organization
    let org = profile.organization;
    
    if (profile.role === 'superadmin') {
      // Fetch the organization that owns the location
      const { data: locationOrg } = await adminClient
        .from('organizations')
        .select('*')
        .eq('id', location.organization_id)
        .single();
      
      if (locationOrg) {
        org = locationOrg;
      }
    }

    if (!org?.httpsms_api_key || !org?.httpsms_from_number) {
      return NextResponse.json(
        { error: 'SMS not configured for organization' },
        { status: 400 }
      );
    }

    const fromNumber = normalizePhoneNumber(org.httpsms_from_number);

    // Construct the alert message
    const message = `UP! Customer on the ${location.name}`;

    // Send SMS to each member
    const results: SendResult[] = [];

    for (const member of members) {
      try {
        const toNumber = normalizePhoneNumber(member.phone_number);
        
        const response = await fetch('https://api.httpsms.com/v1/messages/send', {
          method: 'POST',
          headers: {
            'x-api-key': org.httpsms_api_key,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: message,
            from: fromNumber,
            to: toNumber,
          }),
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
          results.push({
            member_id: member.id,
            name: member.name,
            phone_number: member.phone_number,
            status: 'sent',
          });
        } else {
          results.push({
            member_id: member.id,
            name: member.name,
            phone_number: member.phone_number,
            status: 'failed',
            error: data.message || 'SMS send failed',
          });
        }
      } catch (error) {
        console.error(`Error sending SMS to ${member.name}:`, error);
        results.push({
          member_id: member.id,
          name: member.name,
          phone_number: member.phone_number,
          status: 'failed',
          error: 'Network error',
        });
      }
    }

    // Log the alert to ups_alert_logs
    const { error: logError } = await adminClient
      .from('ups_alert_logs')
      .insert({
        organization_id: location.organization_id,
        location_id: location.id,
        location_name: location.name,
        sent_by: user.id,
        recipient_count: members.length,
        recipients: results,
      });

    if (logError) {
      console.error('Error logging alert:', logError);
      // Don't fail the request, just log the error
    }

    // Calculate success/failure counts
    const sentCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      sent_count: sentCount,
      failed_count: failedCount,
      results,
    });

  } catch (error) {
    console.error('UPS send alert error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
