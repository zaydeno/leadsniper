import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/ups/locations - Get all UPS locations for the organization
export async function GET() {
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
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only org_admin and superadmin can access UPS features
    if (!['superadmin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build query based on role
    let query = adminClient
      .from('ups_locations')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (profile.role === 'org_admin') {
      // Org admins can only see their organization's locations
      query = query.eq('organization_id', profile.organization_id);
    }
    // Superadmins see all locations

    const { data: locations, error: locationsError } = await query;

    if (locationsError) {
      console.error('Error fetching UPS locations:', locationsError);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    return NextResponse.json({ locations: locations || [] });

  } catch (error) {
    console.error('UPS locations GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/ups/locations - Add a new UPS location
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
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only org_admin and superadmin can add locations
    if (!['superadmin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { name, organization_id } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Determine which organization to add the location to
    let targetOrgId = profile.organization_id;
    
    if (profile.role === 'superadmin' && organization_id) {
      // Superadmins can specify an organization
      targetOrgId = organization_id;
    }

    if (!targetOrgId) {
      return NextResponse.json(
        { error: 'No organization specified' },
        { status: 400 }
      );
    }

    // Get the next display order
    const { data: maxOrderResult } = await adminClient
      .from('ups_locations')
      .select('display_order')
      .eq('organization_id', targetOrgId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextDisplayOrder = (maxOrderResult?.display_order || 0) + 1;

    // Insert the new location
    const { data: location, error: insertError } = await adminClient
      .from('ups_locations')
      .insert({
        organization_id: targetOrgId,
        name: name.trim(),
        display_order: nextDisplayOrder,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating UPS location:', insertError);
      
      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A location with this name already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
    }

    return NextResponse.json({ location }, { status: 201 });

  } catch (error) {
    console.error('UPS locations POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
