# LeadSniper Web Dashboard

The centralized SMS inbox for automotive sales teams. This Next.js application handles incoming webhooks from httpsms, displays conversations in real-time, and allows team members to respond to leads.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database & Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** TanStack Query
- **SMS Provider:** httpsms.com

## Getting Started

### 1. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration in `supabase/migrations/001_initial_schema.sql`
3. Copy your project URL and keys from Settings > API

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# httpsms
HTTPSMS_API_KEY=your-httpsms-api-key
HTTPSMS_FROM_NUMBER=+1234567890
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── send/           # POST /api/send - Send SMS
│   │   └── webhooks/
│   │       └── httpsms/    # POST /api/webhooks/httpsms - Receive webhooks
│   ├── auth/
│   │   └── callback/       # OAuth callback handler
│   ├── dashboard/
│   │   ├── page.tsx        # Inbox view
│   │   ├── calls/          # Missed calls view
│   │   └── settings/       # User settings
│   ├── login/
│   └── page.tsx            # Landing page
├── components/
│   ├── calls/              # Missed calls components
│   ├── dashboard/          # Dashboard layout components
│   ├── inbox/              # Chat/thread components
│   ├── settings/           # Settings form
│   └── ui/                 # shadcn/ui components
└── lib/
    ├── supabase/           # Supabase client utilities
    └── types.ts            # TypeScript definitions
```

## Webhook Setup

After deploying to Vercel:

1. Go to [httpsms.com](https://httpsms.com) dashboard
2. Navigate to Webhooks settings
3. Add your webhook URL: `https://your-app.vercel.app/api/webhooks/httpsms`
4. Select events: `message.phone.received`, `message.phone.sent`, `call.missed`

## Chrome Extension Integration

The [TradeInExtension](/TradeInExtension) Chrome extension works alongside this dashboard:

1. Extension scrapes lead data from Kijiji listings
2. Extension sends initial SMS via httpsms API directly
3. httpsms webhooks notify this app of sent messages and replies
4. All conversations appear in the LeadSniper inbox

## Database Schema

### Tables

- **profiles** - User profiles (extends Supabase Auth)
- **messages** - SMS messages (inbound/outbound)
- **threads** - Conversation threads grouped by phone number
- **missed_calls** - Missed call logs

### Row Level Security

- Admins can view all data
- Sales reps can only view unassigned or their assigned conversations

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

### Environment Variables in Vercel

Add these in your Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HTTPSMS_API_KEY`
- `HTTPSMS_FROM_NUMBER`

## API Endpoints

### POST /api/send

Send an SMS message.

```json
{
  "to": "+1234567890",
  "content": "Hello from LeadSniper!"
}
```

### POST /api/webhooks/httpsms

Receives webhooks from httpsms for:
- Incoming messages
- Sent message confirmations
- Missed calls

## License

Private - All rights reserved.
