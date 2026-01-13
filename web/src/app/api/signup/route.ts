import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { username, password, fullName, token } = await request.json();

    const supabase = createAdminClient();

    // Validate the invite token
    const { data: invite, error: inviteError } = await supabase
      .from('invite_tokens')
      .select('*')
      .eq('token', token)
      .is('used_by', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invite token' },
        { status: 400 }
      );
    }

    // Create the auth user with role in metadata (trigger will use this)
    const email = `${username}@leadsniper.local`;
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: username,
        full_name: fullName,
        role: invite.role,
        organization_id: invite.organization_id,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Profile is created automatically by the database trigger (handle_new_user)
    // The trigger uses the user_metadata we passed above

    // Mark invite as used
    await supabase
      .from('invite_tokens')
      .update({
        used_by: authData.user.id,
        used_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    return NextResponse.json({
      success: true,
      email: email,
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

