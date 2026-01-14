import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { username, password, fullName, setupKey } = await request.json();

    // Validate setup key from environment
    const validSetupKey = process.env.SETUP_KEY;
    if (!validSetupKey) {
      return NextResponse.json(
        { error: 'Setup is not configured. Add SETUP_KEY to environment variables.' },
        { status: 500 }
      );
    }

    if (setupKey !== validSetupKey) {
      return NextResponse.json(
        { error: 'Invalid setup key' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // Check if any superadmin exists
    const { data: existingAdmin, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'superadmin')
      .limit(1);

    if (checkError) {
      console.error('Check error:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing setup' },
        { status: 500 }
      );
    }

    if (existingAdmin && existingAdmin.length > 0) {
      return NextResponse.json(
        { error: 'Setup has already been completed' },
        { status: 400 }
      );
    }

    // Create the auth user
    const email = `${username}@leadsniper.local`;
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error('Auth error:', authError);
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

    // Create the profile with superadmin role
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email,
        username: username,
        full_name: fullName,
        role: 'superadmin',
        organization_id: null,
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      // Try to clean up the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to create profile: ' + profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Super Admin created successfully',
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


