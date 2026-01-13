import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalize phone number
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

// POST /api/extension/send - Send SMS with full metadata from extension
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const adminClient = createAdminClient();

    // Verify the token and get user
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user profile with organization
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*, organization:organizations(*)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const org = profile.organization;

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

    // Parse request body
    const body = await request.json();
    const { 
      to, 
      content, 
      seller_name, 
      vehicle_model, 
      listing_url 
    } = body;

    if (!to || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: to, content' },
        { status: 400 }
      );
    }

    const toNumber = normalizePhoneNumber(to);
    const fromNumber = normalizePhoneNumber(org.httpsms_from_number);

    // Send via httpsms API
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

    // Create or update thread with metadata
    const threadId = toNumber;

    const { data: existingThread } = await adminClient
      .from('threads')
      .select('id, metadata')
      .eq('id', threadId)
      .single();

    const threadMetadata = {
      seller_name: seller_name || null,
      vehicle_model: vehicle_model || null,
      listing_url: listing_url || null,
      source: 'kijiji',
      initiated_by: user.id,
      initiated_by_name: profile.full_name || profile.username || user.email,
      initiated_at: new Date().toISOString(),
    };

    if (!existingThread) {
      // Create new thread
      await adminClient.from('threads').insert({
        id: threadId,
        contact_phone: toNumber,
        contact_name: seller_name || null,
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 100),
        unread_count: 0,
        organization_id: org.id,
        assigned_to: user.id,
        metadata: threadMetadata,
      });
    } else {
      // Update existing thread - preserve existing metadata but update key fields
      const updatedMetadata = {
        ...existingThread.metadata,
        ...threadMetadata,
      };

      await adminClient
        .from('threads')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.substring(0, 100),
          metadata: updatedMetadata,
          // Only update contact_name if not set
          ...(seller_name && !existingThread.metadata?.seller_name 
            ? { contact_name: seller_name } 
            : {}),
        })
        .eq('id', threadId);
    }

    // Insert message with metadata
    const messageMetadata = {
      sent_by: user.email,
      sent_by_name: profile.full_name || profile.username || user.email,
      sent_at: new Date().toISOString(),
      source: 'extension',
      seller_name: seller_name || null,
      vehicle_model: vehicle_model || null,
      listing_url: listing_url || null,
      is_initial_outreach: !existingThread,
    };

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
        metadata: messageMetadata,
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
      thread_id: threadId,
    });

  } catch (error) {
    console.error('Extension send error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

