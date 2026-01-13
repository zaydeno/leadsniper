import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalize phone number
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Get user profile to determine role and organization
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*, organization:organizations(*)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { to, content, organization_id } = body;

    if (!to || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: to, content' },
        { status: 400 }
      );
    }

    const toNumber = normalizePhoneNumber(to);

    // Determine which organization's credentials to use based on role
    let org = null;

    if (profile.role === 'superadmin') {
      // Superadmin can send from any organization
      if (organization_id) {
        const { data: specifiedOrg } = await adminClient
          .from('organizations')
          .select('*')
          .eq('id', organization_id)
          .single();
        org = specifiedOrg;
      } else {
        // Try to find org by thread's organization_id, or use first available
        const { data: threadOrg } = await adminClient
          .from('threads')
          .select('organization_id')
          .eq('id', toNumber)
          .single();

        if (threadOrg?.organization_id) {
          const { data: foundOrg } = await adminClient
            .from('organizations')
            .select('*')
            .eq('id', threadOrg.organization_id)
            .single();
          org = foundOrg;
        }

        // Fallback: get first organization with httpSMS configured
        if (!org) {
          const { data: firstOrg } = await adminClient
            .from('organizations')
            .select('*')
            .not('httpsms_api_key', 'is', null)
            .not('httpsms_from_number', 'is', null)
            .limit(1)
            .single();
          org = firstOrg;
        }
      }
    } else {
      // Org Admin and Sales Rep use their organization
      org = profile.organization;
    }

    if (!org) {
      return NextResponse.json(
        { error: 'No organization configured' },
        { status: 400 }
      );
    }

    if (!org.httpsms_api_key || !org.httpsms_from_number) {
      return NextResponse.json(
        { error: 'Organization does not have httpSMS configured' },
        { status: 400 }
      );
    }

    const fromNumber = normalizePhoneNumber(org.httpsms_from_number);

    // Send via httpsms API using organization's credentials
    const httpsmsResponse = await fetch('https://api.httpsms.com/v1/messages/send', {
      method: 'POST',
      headers: {
        'x-api-key': org.httpsms_api_key,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        from: fromNumber,
        to: toNumber,
      }),
    });

    const httpsmsData = await httpsmsResponse.json();

    if (!httpsmsResponse.ok || httpsmsData.status !== 'success') {
      console.error('httpsms error:', httpsmsData);
      return NextResponse.json(
        { error: httpsmsData.message || 'Failed to send SMS' },
        { status: 500 }
      );
    }

    // Store message in database
    const threadId = toNumber;

    // Upsert thread
    const { data: existingThread } = await adminClient
      .from('threads')
      .select('id')
      .eq('id', threadId)
      .single();

    if (!existingThread) {
      await adminClient.from('threads').insert({
        id: threadId,
        contact_phone: toNumber,
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 100),
        unread_count: 0,
        organization_id: org.id,
      });
    } else {
      await adminClient
        .from('threads')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.substring(0, 100),
        })
        .eq('id', threadId);
    }

    // Insert message
    const { data: message, error: dbError } = await adminClient
      .from('messages')
      .insert({
        thread_id: threadId,
        content,
        direction: 'outbound',
        from_number: fromNumber,
        to_number: toNumber,
        status: 'pending',
        httpsms_id: httpsmsData.data?.id,
        assigned_to: user.id,
        organization_id: org.id,
        metadata: {
          sent_by: user.email,
          sent_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({
        success: true,
        warning: 'Message sent but failed to store in database',
        message_id: httpsmsData.data?.id,
      });
    }

    return NextResponse.json({
      success: true,
      message_id: message.id,
      httpsms_id: httpsmsData.data?.id,
    });

  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
