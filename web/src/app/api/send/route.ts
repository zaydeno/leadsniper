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

    const body = await request.json();
    const { to, content, from } = body;

    if (!to || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: to, content' },
        { status: 400 }
      );
    }

    const toNumber = normalizePhoneNumber(to);
    const fromNumber = normalizePhoneNumber(from || process.env.HTTPSMS_FROM_NUMBER || '');

    if (!fromNumber) {
      return NextResponse.json(
        { error: 'No from number configured' },
        { status: 400 }
      );
    }

    // Send via httpsms API
    const httpsmsResponse = await fetch('https://api.httpsms.com/v1/messages/send', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.HTTPSMS_API_KEY!,
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

    // Store message in database using admin client (bypasses RLS)
    const adminSupabase = createAdminClient();
    const threadId = toNumber;

    const { data: message, error: dbError } = await adminSupabase
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
        metadata: {
          sent_by: user.email,
          sent_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Message was sent but not stored - log for debugging
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

