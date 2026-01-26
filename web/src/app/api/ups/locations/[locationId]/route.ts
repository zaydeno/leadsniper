import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ locationId: string }>;
}

// PUT /api/ups/locations/[locationId] - Update a UPS location
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { locationId } = await params;
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

    // Only org_admin and superadmin can update locations
    if (!['superadmin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the existing location
    const { data: existingLocation, error: fetchError } = await adminClient
      .from('ups_locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (fetchError || !existingLocation) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Org admins can only update locations in their organization
    if (profile.role === 'org_admin' && existingLocation.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { name, is_active, display_order } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }
    
    if (display_order !== undefined) {
      updateData.display_order = display_order;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update the location
    const { data: location, error: updateError } = await adminClient
      .from('ups_locations')
      .update(updateData)
      .eq('id', locationId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating UPS location:', updateError);
      
      // Check for unique constraint violation
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'A location with this name already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
    }

    return NextResponse.json({ location });

  } catch (error) {
    console.error('UPS location PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/ups/locations/[locationId] - Delete a UPS location
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { locationId } = await params;
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

    // Only org_admin and superadmin can delete locations
    if (!['superadmin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the existing location
    const { data: existingLocation, error: fetchError } = await adminClient
      .from('ups_locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (fetchError || !existingLocation) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Org admins can only delete locations in their organization
    if (profile.role === 'org_admin' && existingLocation.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the location
    const { error: deleteError } = await adminClient
      .from('ups_locations')
      .delete()
      .eq('id', locationId);

    if (deleteError) {
      console.error('Error deleting UPS location:', deleteError);
      return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('UPS location DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
