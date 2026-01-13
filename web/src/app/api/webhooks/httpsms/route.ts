import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================
// httpSMS Webhook Handler
// Docs: https://docs.httpsms.com/webhooks/introduction
// =============================================

// Normalize phone number to a consistent format
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

// Find organization by phone number
async function findOrganizationByPhone(
  supabase: ReturnType<typeof createAdminClient>,
  phoneNumber: string
) {
  const normalized = normalizePhoneNumber(phoneNumber);
  
  const { data } = await supabase
    .from('organizations')
    .select('id, httpsms_api_key, httpsms_from_number, httpsms_webhook_signing_key')
    .or(`httpsms_from_number.eq.${normalized},httpsms_from_number.eq.${phoneNumber}`)
    .single();

  return data;
}

// Verify JWT token from httpSMS (optional but recommended)
async function verifyWebhookSignature(
  request: NextRequest,
  signingKey: string | null
): Promise<boolean> {
  if (!signingKey) {
    // No signing key configured, skip verification
    return true;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Missing or invalid Authorization header');
    return false;
  }

  // For production, use a proper JWT library like jose
  // For now, we'll just check the header exists
  // TODO: Implement full JWT verification with HS256
  return true;
}

// Update or create thread for a phone number
async function upsertThread(
  supabase: ReturnType<typeof createAdminClient>,
  threadId: string,
  contactPhone: string,
  organizationId: string | null,
  lastMessage: string,
  isInbound: boolean
) {
  const { data: existing } = await supabase
    .from('threads')
    .select('id, unread_count')
    .eq('id', threadId)
    .single();

  if (existing) {
    await supabase
      .from('threads')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: lastMessage.substring(0, 100),
        unread_count: isInbound ? existing.unread_count + 1 : existing.unread_count,
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId);
  } else {
    await supabase.from('threads').insert({
      id: threadId,
      contact_phone: contactPhone,
      last_message_at: new Date().toISOString(),
      last_message_preview: lastMessage.substring(0, 100),
      unread_count: isInbound ? 1 : 0,
      organization_id: organizationId,
    });
  }
}

// =============================================
// WEBHOOK EVENT HANDLERS
// =============================================

// Handle incoming SMS: message.phone.received
async function handleMessageReceived(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, unknown>
) {
  const fromNumber = normalizePhoneNumber(data.contact as string);
  const toNumber = normalizePhoneNumber(data.owner as string);
  const threadId = fromNumber;
  const content = data.content as string;

  // Find organization by the receiving number
  const org = await findOrganizationByPhone(supabase, toNumber);

  // Insert the message
  const { error: messageError } = await supabase.from('messages').insert({
    thread_id: threadId,
    content: content,
    direction: 'inbound',
    from_number: fromNumber,
    to_number: toNumber,
    status: 'received',
    httpsms_id: data.id as string,
    organization_id: org?.id || null,
    metadata: {
      sim: data.sim,
      timestamp: data.timestamp,
      encrypted: data.encrypted,
    },
  });

  if (messageError) {
    console.error('Error inserting inbound message:', messageError);
    throw messageError;
  }

  // Update thread
  await upsertThread(supabase, threadId, fromNumber, org?.id || null, content, true);

  console.log(`📥 Inbound SMS from ${fromNumber} to org ${org?.id || 'unknown'}`);
  return { success: true, type: 'message_received' };
}

// Handle outbound SMS sent: message.phone.sent
async function handleMessageSent(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, unknown>
) {
  const toNumber = normalizePhoneNumber(data.contact as string);
  const fromNumber = normalizePhoneNumber(data.owner as string);
  const threadId = toNumber;
  const content = data.content as string;
  const httpsmsId = data.id as string;

  // Find organization
  const org = await findOrganizationByPhone(supabase, fromNumber);

  // Check if message already exists (sent via our app)
  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('httpsms_id', httpsmsId)
    .single();

  if (existing) {
    // Update existing message status to sent
    await supabase
      .from('messages')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('httpsms_id', httpsmsId);
  } else {
    // Message sent externally (not via our app), insert it
    await supabase.from('messages').insert({
      thread_id: threadId,
      content: content,
      direction: 'outbound',
      from_number: fromNumber,
      to_number: toNumber,
      status: 'sent',
      httpsms_id: httpsmsId,
      organization_id: org?.id || null,
      metadata: {
        sim: data.sim,
        timestamp: data.timestamp,
        source: 'external',
      },
    });

    // Update thread
    await upsertThread(supabase, threadId, toNumber, org?.id || null, content, false);
  }

  console.log(`📤 Outbound SMS sent to ${toNumber}`);
  return { success: true, type: 'message_sent' };
}

// Handle SMS delivered: message.phone.delivered
async function handleMessageDelivered(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, unknown>
) {
  const httpsmsId = data.id as string;

  const { error } = await supabase
    .from('messages')
    .update({ status: 'delivered', updated_at: new Date().toISOString() })
    .eq('httpsms_id', httpsmsId);

  if (error) {
    console.error('Error updating message to delivered:', error);
  }

  console.log(`✅ SMS delivered: ${httpsmsId}`);
  return { success: true, type: 'message_delivered' };
}

// Handle SMS send failed: message.send.failed
async function handleMessageFailed(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, unknown>
) {
  const httpsmsId = data.id as string;
  const reason = data.failure_reason as string;

  // First update the status
  const { error } = await supabase
    .from('messages')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('httpsms_id', httpsmsId);

  if (error) {
    console.error('Error updating message to failed:', error);
  }

  // Update metadata with failure reason
  if (reason) {
    try {
      await supabase
        .from('messages')
        .update({
          metadata: { failure_reason: reason },
        })
        .eq('httpsms_id', httpsmsId);
    } catch {
      // Ignore metadata update errors
    }
  }

  console.log(`❌ SMS failed: ${httpsmsId} - ${reason}`);
  return { success: true, type: 'message_failed' };
}

// Handle SMS expired: message.send.expired
async function handleMessageExpired(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, unknown>
) {
  const httpsmsId = data.id as string;

  const { error } = await supabase
    .from('messages')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('httpsms_id', httpsmsId);

  if (error) {
    console.error('Error updating message to expired:', error);
  }

  console.log(`⏰ SMS expired: ${httpsmsId}`);
  return { success: true, type: 'message_expired' };
}

// Handle missed call: message.call.missed
async function handleMissedCall(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, unknown>
) {
  const fromNumber = normalizePhoneNumber(data.contact as string);
  const toNumber = normalizePhoneNumber(data.owner as string);

  // Find organization
  const org = await findOrganizationByPhone(supabase, toNumber);

  const { error } = await supabase.from('missed_calls').insert({
    from_number: fromNumber,
    to_number: toNumber,
    organization_id: org?.id || null,
  });

  if (error) {
    console.error('Error inserting missed call:', error);
    throw error;
  }

  console.log(`📞 Missed call from ${fromNumber}`);
  return { success: true, type: 'call_missed' };
}

// Handle phone offline: phone.heartbeat.offline
async function handlePhoneOffline(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, unknown>
) {
  const phoneNumber = normalizePhoneNumber(data.owner as string);

  // Find organization
  const org = await findOrganizationByPhone(supabase, phoneNumber);

  // Upsert phone status
  const { error } = await supabase.from('phone_status').upsert(
    {
      phone_number: phoneNumber,
      organization_id: org?.id || null,
      is_online: false,
      went_offline_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'phone_number' }
  );

  if (error) {
    console.error('Error updating phone status to offline:', error);
  }

  console.log(`📴 Phone offline: ${phoneNumber}`);
  return { success: true, type: 'phone_offline' };
}

// Handle phone online: phone.heartbeat.online
async function handlePhoneOnline(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, unknown>
) {
  const phoneNumber = normalizePhoneNumber(data.owner as string);

  // Find organization
  const org = await findOrganizationByPhone(supabase, phoneNumber);

  // Upsert phone status
  const { error } = await supabase.from('phone_status').upsert(
    {
      phone_number: phoneNumber,
      organization_id: org?.id || null,
      is_online: true,
      last_heartbeat_at: new Date().toISOString(),
      went_offline_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'phone_number' }
  );

  if (error) {
    console.error('Error updating phone status to online:', error);
  }

  console.log(`📱 Phone online: ${phoneNumber}`);
  return { success: true, type: 'phone_online' };
}

// =============================================
// MAIN WEBHOOK HANDLER
// =============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const supabase = createAdminClient();

    // Get event type from header or body (CloudEvents format)
    const eventType =
      request.headers.get('X-Event-Type') ||
      body.type ||
      body.event_type;

    console.log(`\n🔔 Webhook received: ${eventType}`);
    console.log('Payload:', JSON.stringify(body, null, 2));

    // Extract data from CloudEvents format
    const data = body.data || body;

    // Route to appropriate handler
    let result;
    switch (eventType) {
      case 'message.phone.received':
        result = await handleMessageReceived(supabase, data);
        break;

      case 'message.phone.sent':
        result = await handleMessageSent(supabase, data);
        break;

      case 'message.phone.delivered':
        result = await handleMessageDelivered(supabase, data);
        break;

      case 'message.send.failed':
        result = await handleMessageFailed(supabase, data);
        break;

      case 'message.send.expired':
        result = await handleMessageExpired(supabase, data);
        break;

      case 'message.call.missed':
        result = await handleMissedCall(supabase, data);
        break;

      case 'phone.heartbeat.offline':
        result = await handlePhoneOffline(supabase, data);
        break;

      case 'phone.heartbeat.online':
        result = await handlePhoneOnline(supabase, data);
        break;

      default:
        console.log(`⚠️ Unknown event type: ${eventType}`);
        result = { success: true, type: 'unknown', eventType };
    }

    const duration = Date.now() - startTime;
    console.log(`✓ Webhook processed in ${duration}ms\n`);

    return NextResponse.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`✗ Webhook error after ${duration}ms:`, error);

    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/webhooks/httpsms',
    supported_events: [
      'message.phone.received',
      'message.phone.sent',
      'message.phone.delivered',
      'message.send.failed',
      'message.send.expired',
      'message.call.missed',
      'phone.heartbeat.offline',
      'phone.heartbeat.online',
    ],
  });
}
