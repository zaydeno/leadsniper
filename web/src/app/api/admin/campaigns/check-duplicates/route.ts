import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalize phone number for comparison
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // If it starts with 1 and has 11 digits, remove the 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

// POST /api/admin/campaigns/check-duplicates - Check for duplicate phone numbers
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verify superadmin
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Superadmin only' }, { status: 403 });
    }

    const body = await request.json();
    const { phone_numbers } = body;

    if (!phone_numbers || !Array.isArray(phone_numbers)) {
      return NextResponse.json({ error: 'phone_numbers array is required' }, { status: 400 });
    }

    // Normalize all input phone numbers
    const normalizedInputs = phone_numbers.map((phone: string) => ({
      original: phone,
      normalized: normalizePhoneNumber(phone),
    }));

    // Get all existing threads (contact_phone is the thread ID)
    const { data: existingThreads, error: threadsError } = await adminClient
      .from('threads')
      .select('id, contact_phone, contact_name, organization_id, assigned_to');

    if (threadsError) {
      console.error('Error fetching threads:', threadsError);
      return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
    }

    // Create a map of normalized existing phone numbers
    const existingPhones = new Map<string, {
      thread_id: string;
      contact_phone: string;
      contact_name: string | null;
      organization_id: string | null;
      assigned_to: string | null;
    }>();

    (existingThreads || []).forEach(thread => {
      const normalized = normalizePhoneNumber(thread.contact_phone);
      existingPhones.set(normalized, {
        thread_id: thread.id,
        contact_phone: thread.contact_phone,
        contact_name: thread.contact_name,
        organization_id: thread.organization_id,
        assigned_to: thread.assigned_to,
      });
    });

    // Check each input phone number for duplicates
    const duplicates: {
      phone_number: string;
      existing_thread_id: string;
      existing_contact_name: string | null;
    }[] = [];

    normalizedInputs.forEach(({ original, normalized }) => {
      const existing = existingPhones.get(normalized);
      if (existing) {
        duplicates.push({
          phone_number: original,
          existing_thread_id: existing.thread_id,
          existing_contact_name: existing.contact_name,
        });
      }
    });

    return NextResponse.json({
      total_checked: phone_numbers.length,
      duplicates_found: duplicates.length,
      duplicates,
      unique_count: phone_numbers.length - duplicates.length,
    });

  } catch (error) {
    console.error('Check duplicates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

