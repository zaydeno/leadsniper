import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalize phone number to a consistent format for thread_id
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

// Find organization by phone number
async function findOrganizationByPhone(supabase: ReturnType<typeof createAdminClient>, phoneNumber: string) {
  const { data } = await supabase
    .from('organizations')
    .select('id, httpsms_api_key, httpsms_from_number')
    .eq('httpsms_from_number', phoneNumber)
    .single();
  
  return data;
}

// httpsms webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const eventType = body.event_type || body.type;
    
    if (eventType === 'message.phone.received') {
      // Incoming SMS message
      const data = body.data;
      const fromNumber = normalizePhoneNumber(data.contact);
      const toNumber = normalizePhoneNumber(data.owner);
      const threadId = fromNumber;

      // Find which organization owns this number
      const org = await findOrganizationByPhone(supabase, toNumber);
      
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
          content: data.content,
          direction: 'inbound',
          from_number: fromNumber,
          to_number: toNumber,
          status: 'received',
          httpsms_id: data.id,
          organization_id: org?.id || null,
          metadata: {
            sim: data.sim,
            timestamp: data.timestamp,
          },
        });

      if (messageError) {
        console.error('Error inserting message:', messageError);
        return NextResponse.json({ error: 'Failed to insert message' }, { status: 500 });
      }

      console.log(`Inbound message saved from ${fromNumber} to org ${org?.id || 'unknown'}`);
      return NextResponse.json({ success: true, type: 'message_received' });
    }

    if (eventType === 'message.phone.sent') {
      // Outbound message confirmation
      const data = body.data;
      const toNumber = normalizePhoneNumber(data.contact);
      const fromNumber = normalizePhoneNumber(data.owner);
      const threadId = toNumber;

      // Find organization
      const org = await findOrganizationByPhone(supabase, fromNumber);

      // Check if message already exists
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .eq('httpsms_id', data.id)
        .single();

      if (existing) {
        await supabase
          .from('messages')
          .update({ status: 'sent' })
          .eq('httpsms_id', data.id);
      } else {
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            thread_id: threadId,
            content: data.content,
            direction: 'outbound',
            from_number: fromNumber,
            to_number: toNumber,
            status: 'sent',
            httpsms_id: data.id,
            organization_id: org?.id || null,
            metadata: {
              sim: data.sim,
              timestamp: data.timestamp,
              source: 'external',
            },
          });

        if (messageError) {
          console.error('Error inserting outbound message:', messageError);
        }
      }

      console.log(`Outbound message confirmed to ${toNumber}`);
      return NextResponse.json({ success: true, type: 'message_sent' });
    }

    if (eventType === 'call.missed') {
      // Missed call notification
      const data = body.data;
      const fromNumber = normalizePhoneNumber(data.contact);
      const toNumber = normalizePhoneNumber(data.owner);

      // Find organization
      const org = await findOrganizationByPhone(supabase, toNumber);

      const { error: callError } = await supabase
        .from('missed_calls')
        .insert({
          from_number: fromNumber,
          to_number: toNumber,
          organization_id: org?.id || null,
        });

      if (callError) {
        console.error('Error inserting missed call:', callError);
        return NextResponse.json({ error: 'Failed to insert missed call' }, { status: 500 });
      }

      console.log(`Missed call logged from ${fromNumber}`);
      return NextResponse.json({ success: true, type: 'call_missed' });
    }

    console.log('Unknown webhook event type:', eventType);
    return NextResponse.json({ success: true, type: 'unknown' });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint active' });
}
