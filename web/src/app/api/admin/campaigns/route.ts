import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Normalize phone number
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it already starts with +, check if it has country code
  if (cleaned.startsWith('+')) {
    // If it's +1 followed by 10 digits, it's correct
    if (cleaned.match(/^\+1\d{10}$/)) {
      return cleaned;
    }
    // If it's + followed by 11 digits (already has country code), return as is
    if (cleaned.match(/^\+\d{11}$/)) {
      return cleaned;
    }
    // If it's +1 followed by more than 10 digits, might be malformed
    if (cleaned.startsWith('+1') && cleaned.length > 12) {
      // Remove extra leading 1s
      cleaned = cleaned.replace(/^\+1+/, '+1');
    }
    return cleaned;
  }
  
  // No + prefix, add it
  // If it starts with 1 and has 11 digits total, it's already a US number with country code
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return `+${cleaned}`;
  }
  
  // If it's 10 digits, add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If it's 11 digits and starts with 1, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // Default: add +1
  return `+1${cleaned}`;
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
  lead: { 
    name?: string; 
    make?: string; 
    model?: string;
    salesperson?: string;
    month?: string;
    custom_fields?: Record<string, string> | null;
  },
  vehicleMode: 'make' | 'model',
  useCustomerName: boolean = true
): string {
  let result = message;
  // When using customer name: use name or fallback to 'there'
  // When NOT using customer name: always use 'there'
  // Note: Template should use greetings like {Hi|Hello} NOT {Hi there|Hello} to avoid duplication
  result = result.replace(/\[Customer Name\]/gi, useCustomerName ? (lead.name || 'there') : 'there');
  result = result.replace(/\[Make\]/gi, lead.make || '');
  result = result.replace(/\[Model\]/gi, lead.model || '');
  // Custom campaign fields
  result = result.replace(/\[Salesperson\]/gi, lead.salesperson || '');
  result = result.replace(/\[Month\]/gi, lead.month || '');
  
  // Replace any custom fields
  if (lead.custom_fields) {
    for (const [key, value] of Object.entries(lead.custom_fields)) {
      const regex = new RegExp(`\\[${key}\\]`, 'gi');
      result = result.replace(regex, value || '');
    }
  }
  
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
      campaign_type,
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
        campaign_type: campaign_type || 'normal',
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
    // Log first lead for debugging
    if (leads.length > 0) {
      console.log('First lead data received:', JSON.stringify(leads[0], null, 2));
    }
    
    const leadsToInsert = leads.map((lead: {
      phone_number: string;
      name?: string;
      make?: string;
      model?: string;
      kijiji_link?: string;
      salesperson?: string;
      month?: string;
      custom_fields?: Record<string, string>;
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
        salesperson: lead.salesperson || null,
        month: lead.month || null,
        custom_fields: lead.custom_fields || null,
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
    // Use setTimeout to ensure it runs in a separate event loop tick
    setTimeout(() => {
      processCampaign(campaign.id).catch(async (error) => {
        console.error('Campaign processing error:', error);
        // Log the error to the campaign
        try {
          const errorClient = createAdminClient();
          await errorClient.from('campaign_logs').insert({
            campaign_id: campaign.id,
            level: 'error',
            message: `Campaign processing crashed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { error: String(error) },
          });
        } catch (logError) {
          console.error('Failed to log campaign error:', logError);
        }
      });
    }, 100);

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

// Helper to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Process a single lead - returns result of processing
async function processOneLead(
  adminClient: ReturnType<typeof createAdminClient>,
  campaignId: string,
  campaign: {
    name: string;
    message_template: string;
    vehicle_reference_mode: 'make' | 'model';
    use_customer_name: boolean;
    sent_count: number;
    failed_count: number;
  },
  org: {
    id: string;
    httpsms_api_key: string;
    httpsms_from_number: string;
  },
  lead: {
    id: string;
    name?: string;
    phone_number: string;
    make?: string;
    model?: string;
    kijiji_link?: string;
    salesperson?: string;
    month?: string;
    custom_fields?: Record<string, string> | null;
    assigned_to?: string;
    lead_order: number;
  },
  leadIndex: number,
  totalLeads: number,
  fromNumber: string
): Promise<{ success: boolean; shouldContinue: boolean; sentCount: number; failedCount: number }> {
  let currentSentCount = campaign.sent_count;
  let currentFailedCount = campaign.failed_count;

  await addLog(adminClient, campaignId, 'info', `Processing lead ${leadIndex + 1}/${totalLeads}: ${lead.name || lead.phone_number}`, { phone: lead.phone_number });

  // Check if campaign is still running
  const { data: currentCampaign } = await adminClient
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .single();

  if (!currentCampaign || currentCampaign.status !== 'running') {
    await addLog(adminClient, campaignId, 'warning', 'Campaign paused or cancelled, stopping processing');
    return { success: false, shouldContinue: false, sentCount: currentSentCount, failedCount: currentFailedCount };
  }

  try {
    // Generate message with spintax and placeholders
    const parsedMessage = parseSpintax(campaign.message_template);
    
    // Log lead data for debugging placeholder replacement
    const leadData = { 
      name: lead.name, 
      make: lead.make, 
      model: lead.model,
      salesperson: lead.salesperson,
      month: lead.month,
      custom_fields: lead.custom_fields,
    };
    
    const finalMessage = replacePlaceholders(
      parsedMessage,
      leadData,
      campaign.vehicle_reference_mode,
      campaign.use_customer_name
    );
    
    // Log if any placeholders weren't replaced (still contain [])
    if (finalMessage.includes('[') && finalMessage.includes(']')) {
      await addLog(adminClient, campaignId, 'warning', `Unreplaced placeholders detected`, { 
        lead_phone: lead.phone_number,
        lead_data: leadData,
        message_preview: finalMessage.substring(0, 200) 
      });
    }

    await addLog(adminClient, campaignId, 'info', `Sending SMS to ${lead.phone_number}`, { message_preview: finalMessage.substring(0, 100) + '...' });

    // Send SMS with timeout
    const httpsmsResponse = await fetchWithTimeout('https://api.httpsms.com/v1/messages/send', {
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
    }, 30000);

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

      currentSentCount += 1;

      // Update campaign progress
      await adminClient
        .from('campaigns')
        .update({ 
          sent_count: currentSentCount,
          current_lead_index: lead.lead_order + 1,
        })
        .eq('id', campaignId);

      return { success: true, shouldContinue: true, sentCount: currentSentCount, failedCount: currentFailedCount };

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

      currentFailedCount += 1;

      await adminClient
        .from('campaigns')
        .update({ failed_count: currentFailedCount })
        .eq('id', campaignId);

      return { success: false, shouldContinue: true, sentCount: currentSentCount, failedCount: currentFailedCount };
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await addLog(adminClient, campaignId, 'error', `✗ Exception while processing lead: ${errorMsg}`, { phone: lead.phone_number, error: String(error) });
    
    await adminClient
      .from('campaign_leads')
      .update({ 
        status: 'failed', 
        error_message: errorMsg 
      })
      .eq('id', lead.id);

    currentFailedCount += 1;

    await adminClient
      .from('campaigns')
      .update({ failed_count: currentFailedCount })
      .eq('id', campaignId);

    return { success: false, shouldContinue: true, sentCount: currentSentCount, failedCount: currentFailedCount };
  }
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

  let currentSentCount = campaign.sent_count;
  let currentFailedCount = campaign.failed_count;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    
    const result = await processOneLead(
      adminClient,
      campaignId,
      { ...campaign, sent_count: currentSentCount, failed_count: currentFailedCount },
      org,
      lead,
      i,
      leads.length,
      fromNumber
    );

    currentSentCount = result.sentCount;
    currentFailedCount = result.failedCount;

    if (!result.shouldContinue) {
      break;
    }

    // Delay before next message - break into smaller chunks to check status
    if (i < leads.length - 1) {
      const totalDelay = campaign.delay_seconds * 1000;
      const chunkSize = 10000; // 10 second chunks
      const chunks = Math.ceil(totalDelay / chunkSize);
      
      await addLog(adminClient, campaignId, 'info', `Waiting ${campaign.delay_seconds} seconds before next message...`);
      
      for (let chunk = 0; chunk < chunks; chunk++) {
        // Check if campaign is still running during wait
        const { data: statusCheck } = await adminClient
          .from('campaigns')
          .select('status')
          .eq('id', campaignId)
          .single();
        
        if (!statusCheck || statusCheck.status !== 'running') {
          await addLog(adminClient, campaignId, 'warning', 'Campaign paused during delay, stopping');
          // Exit outer loop
          i = leads.length;
          break;
        }
        
        const remainingDelay = totalDelay - (chunk * chunkSize);
        const thisChunkDelay = Math.min(chunkSize, remainingDelay);
        await new Promise(resolve => setTimeout(resolve, thisChunkDelay));
      }
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
