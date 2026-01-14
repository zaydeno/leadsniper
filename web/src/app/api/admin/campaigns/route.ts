import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalize phone number
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+1${cleaned}`;
}

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
  vehicleMode: 'make' | 'model',
  useCustomerName: boolean = true
): string {
  let result = message;
  result = result.replace(/\[Customer Name\]/gi, useCustomerName ? (lead.name || 'there') : 'there');
  result = result.replace(/\[Make\]/gi, lead.make || '');
  result = result.replace(/\[Model\]/gi, lead.model || '');
  return result;
}

// POST - Create a new campaign
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
    const {
      name,
      organization_id,
      message_template,
      vehicle_reference_mode,
      assignment_mode,
      assigned_to,
      delay_seconds,
      leads,
      use_customer_name,
    } = body;

    // Validation
    if (!name || !organization_id || !message_template || !leads || leads.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get users for random distribution
    let orgUsers: { id: string }[] = [];
    if (assignment_mode === 'random_distribution') {
      const { data: users } = await adminClient
        .from('profiles')
        .select('id')
        .eq('organization_id', organization_id);
      orgUsers = users || [];
      
      if (orgUsers.length === 0) {
        return NextResponse.json({ error: 'No users found in organization for random distribution' }, { status: 400 });
      }
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await adminClient
      .from('campaigns')
      .insert({
        name,
        organization_id,
        message_template,
        vehicle_reference_mode: vehicle_reference_mode || 'model',
        assignment_mode: assignment_mode || 'single_user',
        assigned_to: assignment_mode === 'single_user' ? assigned_to : null,
        delay_seconds: delay_seconds || 65,
        use_customer_name: use_customer_name !== false, // Default to true
        total_leads: leads.length,
        status: 'running', // Start immediately
        started_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Campaign creation error:', campaignError);
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    // Insert campaign leads with fair distribution for random mode
    const leadsToInsert = leads.map((lead: {
      phone_number: string;
      name?: string;
      make?: string;
      model?: string;
      kijiji_link?: string;
    }, index: number) => {
      let assignedUserId = assigned_to;
      
      if (assignment_mode === 'random_distribution' && orgUsers.length > 0) {
        // Fair round-robin distribution
        assignedUserId = orgUsers[index % orgUsers.length].id;
      }

      return {
        campaign_id: campaign.id,
        phone_number: normalizePhoneNumber(lead.phone_number),
        name: lead.name || null,
        make: lead.make || null,
        model: lead.model || null,
        kijiji_link: lead.kijiji_link || null,
        assigned_to: assignedUserId,
        lead_order: index,
        status: 'pending',
      };
    });

    const { error: leadsError } = await adminClient
      .from('campaign_leads')
      .insert(leadsToInsert);

    if (leadsError) {
      console.error('Leads insertion error:', leadsError);
      // Cleanup campaign if leads failed
      await adminClient.from('campaigns').delete().eq('id', campaign.id);
      return NextResponse.json({ error: 'Failed to insert leads' }, { status: 500 });
    }

    // Start processing in background (fire and forget)
    processCampaign(campaign.id).catch(console.error);

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error('Campaign creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper to add campaign log
async function addLog(
  adminClient: ReturnType<typeof createAdminClient>,
  campaignId: string,
  level: 'info' | 'success' | 'warning' | 'error',
  message: string,
  details?: Record<string, unknown>
) {
  await adminClient.from('campaign_logs').insert({
    campaign_id: campaignId,
    level,
    message,
    details: details || null,
  });
}

// Background campaign processor
async function processCampaign(campaignId: string) {
  const adminClient = createAdminClient();

  await addLog(adminClient, campaignId, 'info', 'Campaign processing started');

  // Get campaign details
  const { data: campaign, error: campaignError } = await adminClient
    .from('campaigns')
    .select('*, organization:organizations(*)')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign || !campaign.organization) {
    await addLog(adminClient, campaignId, 'error', 'Campaign or organization not found', { error: campaignError?.message });
    return;
  }

  await addLog(adminClient, campaignId, 'info', `Loaded campaign: ${campaign.name}`, { organization: campaign.organization.name });

  const org = campaign.organization;
  if (!org.httpsms_api_key || !org.httpsms_from_number) {
    await addLog(adminClient, campaignId, 'error', 'Organization SMS not configured - missing API key or phone number');
    await adminClient
      .from('campaigns')
      .update({ status: 'cancelled' })
      .eq('id', campaignId);
    return;
  }

  await addLog(adminClient, campaignId, 'info', `SMS configured with number: ${org.httpsms_from_number}`);

  // Get pending leads
  const { data: leads, error: leadsError } = await adminClient
    .from('campaign_leads')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('lead_order', { ascending: true });

  if (leadsError) {
    await addLog(adminClient, campaignId, 'error', 'Failed to fetch leads', { error: leadsError.message });
    return;
  }

  if (!leads || leads.length === 0) {
    await addLog(adminClient, campaignId, 'success', 'No pending leads - campaign complete');
    await adminClient
      .from('campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaignId);
    return;
  }

  await addLog(adminClient, campaignId, 'info', `Found ${leads.length} pending leads to process`);

  const fromNumber = org.httpsms_from_number.startsWith('+') 
    ? org.httpsms_from_number 
    : `+${org.httpsms_from_number}`;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    await addLog(adminClient, campaignId, 'info', `Processing lead ${i + 1}/${leads.length}: ${lead.name || lead.phone_number}`, { phone: lead.phone_number });

    // Check if campaign is still running
    const { data: currentCampaign } = await adminClient
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single();

    if (!currentCampaign || currentCampaign.status !== 'running') {
      await addLog(adminClient, campaignId, 'warning', 'Campaign paused or cancelled, stopping processing');
      break;
    }

    try {
      // Generate message with spintax and placeholders
      const parsedMessage = parseSpintax(campaign.message_template);
      const finalMessage = replacePlaceholders(
        parsedMessage,
        { name: lead.name, make: lead.make, model: lead.model },
        campaign.vehicle_reference_mode,
        campaign.use_customer_name
      );

      await addLog(adminClient, campaignId, 'info', `Sending SMS to ${lead.phone_number}`, { message_preview: finalMessage.substring(0, 100) + '...' });

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
      
      await addLog(adminClient, campaignId, 'info', `httpSMS API response`, { status: httpsmsData.status, response_ok: httpsmsResponse.ok });

      if (httpsmsResponse.ok && httpsmsData.status === 'success') {
        // Create thread with metadata
        const threadId = lead.phone_number;
        
        // Check if thread exists
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

        await addLog(adminClient, campaignId, 'success', `✓ SMS sent successfully to ${lead.name || lead.phone_number}`, { httpsms_id: httpsmsData.data?.id });

        // Update lead status
        await adminClient
          .from('campaign_leads')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', lead.id);

        // Update campaign progress
        await adminClient
          .from('campaigns')
          .update({ 
            sent_count: campaign.sent_count + 1,
            current_lead_index: lead.lead_order + 1,
          })
          .eq('id', campaignId);

        // Refresh campaign data for next iteration
        const { data: updatedCampaign } = await adminClient
          .from('campaigns')
          .select('sent_count')
          .eq('id', campaignId)
          .single();
        if (updatedCampaign) {
          campaign.sent_count = updatedCampaign.sent_count;
        }

      } else {
        const errorMsg = httpsmsData.message || 'SMS send failed';
        await addLog(adminClient, campaignId, 'error', `✗ Failed to send to ${lead.phone_number}: ${errorMsg}`, { response: httpsmsData });
        
        // Mark as failed
        await adminClient
          .from('campaign_leads')
          .update({ 
            status: 'failed', 
            error_message: errorMsg 
          })
          .eq('id', lead.id);

        await adminClient
          .from('campaigns')
          .update({ failed_count: campaign.failed_count + 1 })
          .eq('id', campaignId);

        campaign.failed_count += 1;
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await addLog(adminClient, campaignId, 'error', `✗ Exception while processing lead: ${errorMsg}`, { phone: lead.phone_number });
      
      await adminClient
        .from('campaign_leads')
        .update({ 
          status: 'failed', 
          error_message: errorMsg 
        })
        .eq('id', lead.id);

      await adminClient
        .from('campaigns')
        .update({ failed_count: campaign.failed_count + 1 })
        .eq('id', campaignId);

      campaign.failed_count += 1;
    }

    // Delay before next message (60-70 seconds)
    if (i < leads.length - 1) {
      const delay = campaign.delay_seconds * 1000;
      await addLog(adminClient, campaignId, 'info', `Waiting ${campaign.delay_seconds} seconds before next message...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Check final status
  const { data: finalCampaign } = await adminClient
    .from('campaigns')
    .select('status, sent_count, failed_count, total_leads')
    .eq('id', campaignId)
    .single();

  if (finalCampaign && finalCampaign.status === 'running') {
    // All leads processed
    await addLog(adminClient, campaignId, 'success', `🎉 Campaign completed! Sent: ${finalCampaign.sent_count}, Failed: ${finalCampaign.failed_count}`);
    await adminClient
      .from('campaigns')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('id', campaignId);
  }
}

// GET - List all campaigns
export async function GET() {
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

    const { data: campaigns, error } = await adminClient
      .from('campaigns')
      .select('*, organization:organizations(name)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Campaigns fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

