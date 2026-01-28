-- Migration: Add custom campaign support
-- Description: Adds campaign_type to campaigns and custom fields to campaign_leads

-- Add campaign_type to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'normal' CHECK (campaign_type IN ('normal', 'custom'));

-- Add custom fields to campaign_leads table
ALTER TABLE campaign_leads
ADD COLUMN IF NOT EXISTS salesperson TEXT,
ADD COLUMN IF NOT EXISTS month TEXT,
ADD COLUMN IF NOT EXISTS custom_fields JSONB;

-- Add index for campaign_type for filtering
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_type ON campaigns(campaign_type);

-- Comment for documentation
COMMENT ON COLUMN campaigns.campaign_type IS 'Type of campaign: normal (vehicle acquisition) or custom (fully customizable)';
COMMENT ON COLUMN campaign_leads.salesperson IS 'Salesperson name for custom campaigns';
COMMENT ON COLUMN campaign_leads.month IS 'Month field for custom campaigns';
COMMENT ON COLUMN campaign_leads.custom_fields IS 'JSON object containing any custom fields from CSV headers';

