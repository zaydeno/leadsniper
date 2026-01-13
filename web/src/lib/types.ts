// LeadSniper Type Definitions - Multi-Tenant

export type UserRole = 'superadmin' | 'org_admin' | 'sales';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sent' | 'received' | 'failed' | 'pending';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  httpsms_api_key: string | null;
  httpsms_from_number: string | null;
  max_sales_seats: number | null; // NULL = unlimited
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeatInfo {
  unlimited: boolean;
  max_seats: number | null;
  used_seats: number;
  pending_invites: number;
  remaining: number | null;
}

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
  notification_number: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  organization?: Organization;
}

export interface InviteToken {
  id: string;
  token: string;
  organization_id: string | null;
  role: UserRole;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
  // Joined data
  organization?: Organization;
}

export interface Message {
  id: string;
  thread_id: string;
  content: string;
  direction: MessageDirection;
  from_number: string;
  to_number: string;
  status: MessageStatus;
  httpsms_id: string | null;
  assigned_to: string | null;
  organization_id: string | null;
  metadata: MessageMetadata;
  created_at: string;
  updated_at: string;
}

export interface MessageMetadata {
  customer_name?: string;
  vehicle_model?: string;
  source?: string;
  [key: string]: unknown;
}

export interface MissedCall {
  id: string;
  from_number: string;
  to_number: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  organization_id: string | null;
  created_at: string;
}

export interface Thread {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  assigned_to: string | null;
  organization_id: string | null;
  metadata: ThreadMetadata;
  created_at: string;
  updated_at: string;
}

export interface ThreadMetadata {
  vehicle_model?: string;
  source?: string;
  [key: string]: unknown;
}

// httpsms Webhook Payloads
export interface HttpSmsWebhookPayload {
  event_type: 'message.phone.received' | 'message.phone.sent' | 'call.missed';
  data: HttpSmsMessageData | HttpSmsCallData;
}

export interface HttpSmsMessageData {
  id: string;
  owner: string;
  contact: string;
  content: string;
  timestamp: string;
  sim: 'SIM1' | 'SIM2';
  encrypted: boolean;
}

export interface HttpSmsCallData {
  id: string;
  owner: string;
  contact: string;
  timestamp: string;
  sim: 'SIM1' | 'SIM2';
}

// API Request/Response Types
export interface SendMessageRequest {
  to: string;
  content: string;
  from?: string;
}

export interface SendMessageResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

export interface CreateInviteRequest {
  organization_id: string;
  role: UserRole;
  expires_in_days?: number;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  httpsms_api_key?: string;
  httpsms_from_number?: string;
}
