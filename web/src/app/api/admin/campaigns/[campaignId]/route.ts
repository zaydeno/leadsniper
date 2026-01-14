import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Parse spintax and return a random variation (curly braces with pipe-separated options)
function parseSpintax(template: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  return template.replace(spintaxRegex, (match, group) => {
    const options = group.split('|');
    if (options.length === 1) return match; // Not spintax, keep as-is
    return options[Math.floor(Math.random() * options.length)];
  });
}

// Replace placeholders with actual values (square bracket format)
function replacePlaceholders(
  message: string,
  lead: { name?: string; make?: string; model?: string },
  vehicleMode: 'make' | 'model'
): string {
  let result = message;
  result = result.replace(/\[Customer Name\]/gi, lead.name || 'there');
  result = result.replace(/\[Make\]/gi, lead.make || '');
  result = result.replace(/\[Model\]/gi, lead.model || '');
  return result;
}

// PATCH - Update campaign status (start/pause/cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
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
    const { action } = body;

    if (!['start', 'pause', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get current campaign
    const { data: campaign, error: fetchError } = await adminClient
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    let newStatus = campaign.status;
    const updates: Record<string, unknown> = {};

    if (action === 'start') {
      if (campaign.status !== 'draft' && campaign.status !== 'paused') {
        return NextResponse.json({ error: 'Campaign cannot be started' }, { status: 400 });
      }
      newStatus = 'running';
      updates.status = 'running';
      if (!campaign.started_at) {
        updates.started_at = new Date().toISOString();
      }
      
      // Resume processing in background
      resumeCampaign(campaignId).catch(console.error);
      
    } else if (action === 'pause') {
      if (campaign.status !== 'running') {
        return NextResponse.json({ error: 'Campaign is not running' }, { status: 400 });
      }
      newStatus = 'paused';
      updates.status = 'paused';
      
    } else if (action === 'cancel') {
      if (campaign.status === 'completed' || campaign.status === 'cancelled') {
        return NextResponse.json({ error: 'Campaign already finished' }, { status: 400 });
      }
      newStatus = 'cancelled';
      updates.status = 'cancelled';
      updates.completed_at = new Date().toISOString();
      
      // Mark remaining leads as skipped
      await adminClient
        .from('campaign_leads')
        .update({ status: 'skipped' })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending');
    }

    // Update campaign
    const { data: updatedCampaign, error: updateError } = await adminClient
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }

    return NextResponse.json({ campaign: updatedCampaign });
  } catch (error) {
    console.error('Campaign update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
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

    // Check campaign exists and is not running
    const { data: campaign } = await adminClient
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status === 'running') {
      return NextResponse.json({ error: 'Cannot delete a running campaign' }, { status: 400 });
    }

    // Delete campaign (leads will cascade)
    const { error: deleteError } = await adminClient
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Campaign delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get campaign details with leads
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
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

    const { data: campaign, error: fetchError } = await adminClient
      .from('campaigns')
      .select('*, organization:organizations(name), leads:campaign_leads(*)')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Campaign fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Resume campaign processing
async function resumeCampaign(campaignId: string) {
  const adminClient = createAdminClient();

  // Get campaign details
  const { data: campaign } = await adminClient
    .from('campaigns')
    .select('*, organization:organizations(*)')
    .eq('id', campaignId)
    .single();

  if (!campaign || !campaign.organization) {
    console.error('Campaign or organization not found');
    return;
  }

  const org = campaign.organization;
  if (!org.httpsms_api_key || !org.httpsms_from_number) {
    console.error('Organization SMS not configured');
    await adminClient
      .from('campaigns')
      .update({ status: 'cancelled' })
      .eq('id', campaignId);
    return;
  }

  // Get pending leads
  const { data: leads } = await adminClient
    .from('campaign_leads')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('lead_order', { ascending: true });

  if (!leads || leads.length === 0) {
    await adminClient
      .from('campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaignId);
    return;
  }

  const fromNumber = org.httpsms_from_number.startsWith('+') 
    ? org.httpsms_from_number 
    : `+${org.httpsms_from_number}`;

  let currentSentCount = campaign.sent_count;
  let currentFailedCount = campaign.failed_count;

  for (const lead of leads) {
    // Check if campaign is still running
    const { data: currentCampaign } = await adminClient
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single();

    if (!currentCampaign || currentCampaign.status !== 'running') {
      console.log('Campaign paused or cancelled, stopping processing');
      break;
    }

    try {
      // Generate message with spintax and placeholders
      const parsedMessage = parseSpintax(campaign.message_template);
      const finalMessage = replacePlaceholders(
        parsedMessage,
        { name: lead.name, make: lead.make, model: lead.model },
        campaign.vehicle_reference_mode
      );

      // Send SMS
      const httpsmsResponse = await fetch('https://api.httpsms.com/v1/messages/send', {
        method: 'POST',
        headers: {
          'x-api-key': org.httpsms_api_key,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: finalMessage,
          from: fromNumber,
          to: lead.phone_number,
        }),
      });

      const httpsmsData = await httpsmsResponse.json();

      if (httpsmsResponse.ok && httpsmsData.status === 'success') {
        // Create thread with metadata
        const threadId = lead.phone_number;
        
        const { data: existingThread } = await adminClient
          .from('threads')
          .select('id')
          .eq('id', threadId)
          .single();

        const threadMetadata = {
          seller_name: lead.name,
          vehicle_model: lead.model,
          vehicle_make: lead.make,
          listing_url: lead.kijiji_link,
          source: 'campaign',
          campaign_id: campaignId,
          campaign_name: campaign.name,
          initiated_at: new Date().toISOString(),
        };

        if (!existingThread) {
          await adminClient.from('threads').insert({
            id: threadId,
            contact_phone: lead.phone_number,
            contact_name: lead.name,
            last_message_at: new Date().toISOString(),
            last_message_preview: finalMessage.substring(0, 100),
            unread_count: 0,
            organization_id: org.id,
            assigned_to: lead.assigned_to,
            metadata: threadMetadata,
          });
        } else {
          await adminClient
            .from('threads')
            .update({
              last_message_at: new Date().toISOString(),
              last_message_preview: finalMessage.substring(0, 100),
              metadata: threadMetadata,
            })
            .eq('id', threadId);
        }

        // Create message record
        await adminClient.from('messages').insert({
          thread_id: threadId,
          content: finalMessage,
          direction: 'outbound',
          from_number: fromNumber,
          to_number: lead.phone_number,
          status: 'pending',
          httpsms_id: httpsmsData.data?.id,
          assigned_to: lead.assigned_to,
          organization_id: org.id,
          metadata: {
            is_campaign_message: true,
            campaign_id: campaignId,
            campaign_name: campaign.name,
            is_initial_outreach: true,
          },
        });

        // Update lead status
        await adminClient
          .from('campaign_leads')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', lead.id);

        currentSentCount += 1;
        
        // Update campaign progress
        await adminClient
          .from('campaigns')
          .update({ 
            sent_count: currentSentCount,
            current_lead_index: lead.lead_order + 1,
          })
          .eq('id', campaignId);

      } else {
        await adminClient
          .from('campaign_leads')
          .update({ 
            status: 'failed', 
            error_message: httpsmsData.message || 'SMS send failed' 
          })
          .eq('id', lead.id);

        currentFailedCount += 1;
        
        await adminClient
          .from('campaigns')
          .update({ failed_count: currentFailedCount })
          .eq('id', campaignId);
      }

    } catch (error) {
      console.error('Error processing lead:', error);
      await adminClient
        .from('campaign_leads')
        .update({ 
          status: 'failed', 
          error_message: error instanceof Error ? error.message : 'Unknown error' 
        })
        .eq('id', lead.id);

      currentFailedCount += 1;
      
      await adminClient
        .from('campaigns')
        .update({ failed_count: currentFailedCount })
        .eq('id', campaignId);
    }

    // Delay before next message
    const delay = campaign.delay_seconds * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Check final status
  const { data: finalCampaign } = await adminClient
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .single();

  if (finalCampaign && finalCampaign.status === 'running') {
    await adminClient
      .from('campaigns')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('id', campaignId);
  }
}

