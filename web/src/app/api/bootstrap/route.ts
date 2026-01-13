import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/bootstrap - Create the initial superadmin invite
// This endpoint only works if there are NO superadmins in the system
export async function POST() {
  try {
    const supabase = createAdminClient();

    // First check if any superadmins exist
    const { data: superadmins, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'superadmin')
      .limit(1);

    if (checkError) {
      console.error('Check error:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing superadmins' },
        { status: 500 }
      );
    }

    if (superadmins && superadmins.length > 0) {
      return NextResponse.json(
        { error: 'Bootstrap not available - a superadmin already exists' },
        { status: 403 }
      );
    }

    // Generate a secure token
    const tokenBytes = new Uint8Array(24);
    crypto.getRandomValues(tokenBytes);
    const token = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\//g, '_')
      .replace(/\+/g, '-');

    // Create the superadmin invite directly (bypassing RPC since no user is logged in)
    const { error: insertError } = await supabase
      .from('invite_tokens')
      .insert({
        token,
        organization_id: null, // Superadmin doesn't belong to an org
        role: 'superadmin',
        created_by: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create bootstrap invite' },
        { status: 500 }
      );
    }

    const inviteUrl = `/signup/${token}`;

    return NextResponse.json({
      success: true,
      message: 'Superadmin bootstrap invite created',
      token,
      invite_url: inviteUrl,
      expires_in: '24 hours',
    });

  } catch (error) {
    console.error('Bootstrap error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/bootstrap - Check if bootstrap is available
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: superadmins, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'superadmin')
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to check status' },
        { status: 500 }
      );
    }

    const bootstrapAvailable = !superadmins || superadmins.length === 0;

    return NextResponse.json({
      bootstrap_available: bootstrapAvailable,
      message: bootstrapAvailable 
        ? 'No superadmin exists. Bootstrap is available.'
        : 'A superadmin already exists. Bootstrap is not available.',
    });

  } catch (error) {
    console.error('Bootstrap check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

