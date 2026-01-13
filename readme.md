# README.md

## Project Architecture: httpsms Multi-Tenant Inbox
## URL: leadsniper.xyz
## Github Repo: https://github.com/zaydeno/leadsniper

### 1. Executive Summary

This project is a high-performance, serverless web application deployed on **Vercel**. It functions as a centralized SMS and Missed Call management dashboard for sales teams. The architecture prioritizes **Role-Based Access Control (RBAC)**, **Real-time Data Sync**, and a **Zero-Friction Setup** workflow.

**Core Objective:** Ingest webhooks from `httpsms.com`, normalize data, and present it in a secure, multi-user dashboard.

### 2. Technology Stack (Optimization: Speed & Vercel Native)

* **Framework:** Next.js 14 (App Router)
* **Language:** TypeScript
* **Database & Auth:** Supabase (PostgreSQL + Auth + Realtime Subscriptions)
* **Styling:** Tailwind CSS + shadcn/ui (Radix Primitives)
* **State Management:** TanStack Query (React Query)
* **Webhook Handling:** Next.js Route Handlers

### 3. Database Schema (Supabase)

The database requires strict Row Level Security (RLS) to ensure Sales Reps only see assigned data, while Admins see global data.

#### `users` (managed by Supabase Auth)

* `id` (UUID): Primary Key
* `email`: String
* `role`: Enum (`'admin'`, `'sales'`)
* `notification_number`: String (E.164 format)
* `created_at`: Timestampt

#### `messages`

* `id`: UUID
* `thread_id`: String (Group by phone number)
* `content`: Text
* `direction`: Enum (`'inbound'`, `'outbound'`)
* `from_number`: String
* `to_number`: String
* `status`: Enum (`'sent'`, `'received'`, `'failed'`)
* `created_at`: Timestamp (Indexed)

#### `missed_calls`

* `id`: UUID
* `from_number`: String
* `timestamp`: Timestamp
* `acknowledged`: Boolean

### 4. Implementation Phases

#### Phase 1: Infrastructure & Environment

**Goal:** Initialize the repo and connect backend services.

1. Initialize Next.js App Router project with TypeScript.
2. Set up Supabase project.
3. Configure environment variables:
* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`
* `SUPABASE_SERVICE_ROLE_KEY` (For webhook ingestion bypassing RLS)
* `HTTPSMS_API_KEY`



#### Phase 2: Authentication & RBAC

**Goal:** Secure the application.

1. Implement Supabase Auth (Email/Password).
2. Create a "Middleware" (`middleware.ts`) to protect dashboard routes.
* Redirect unauthenticated users to `/login`.
* Admin routes (`/admin`) check for `user_metadata.role === 'admin'`.


3. Build Login Page (`app/login/page.tsx`).
4. Build Profile Settings (`app/dashboard/settings/page.tsx`) to update `notification_number`.

#### Phase 3: Webhook Ingestion (The Core Engine)

**Goal:** Handle incoming data from httpsms.

1. Create Route Handler: `app/api/webhooks/httpsms/route.ts`.
2. **Logic Flow:**
* **Verify Secret:** Ensure request originates from httpsms.
* **Parse Payload:** Extract `from`, `content`, `type` (sms/call).
* **DB Insert:** Write to `messages` or `missed_calls` table using `Service Role` client.
* **Notification:** If a user has `notification_number` set, trigger an outbound alert via httpsms API (optional immediate loop).



#### Phase 4: The Dashboard (Frontend)

**Goal:** Real-time visibility.

1. **Layout:** Sidebar navigation (Inbox, Missed Calls, Settings).
2. **Inbox View:**
* Left panel: List of active threads (Phone numbers), sorted by latest message.
* Right panel: Chat interface (Bubble UI).
* **Real-time:** Use Supabase `channel.subscribe` to listen for `INSERT` on `messages` table. Instant UI updates without refresh.


3. **Sending Logic:**
* User types message -> POST to internal API -> Internal API calls httpsms `POST /messages/send` -> On success, write to DB.



### 5. Folder Structure

```
/app
  /api
    /webhooks
      /httpsms
        route.ts      # Ingests incoming SMS/Calls
    /send
      route.ts        # Outbound sending logic
  /dashboard
    layout.tsx        # Dashboard shell (Sidebar + Auth Check)
    page.tsx          # Redirects to /inbox
    /inbox
      page.tsx        # Main Chat UI
    /calls
      page.tsx        # Missed calls list
    /settings
      page.tsx        # Notification phone # config
  /login
    page.tsx
  page.tsx            # Landing Page
/components
  /ui                 # shadcn components
  /auth               # LoginForm
  /inbox              # ThreadList, ChatWindow
/lib
  supabase
    client.ts         # Client-side auth
    server.ts         # Server-side auth
    admin.ts          # Service role (Webhooks only)
  types.ts

```

### 6. Cursor Instructions (Prompt Engineering)

**Copy and paste the following into the Cursor chat to start coding:**

> "I am building a Vercel-hosted SMS inbox using Next.js 14 and Supabase.
> **Context:**
> 1. **Database:** We need a SQL migration file for Supabase to create `messages` and `missed_calls` tables, including RLS policies where 'admins' can read all rows, and 'sales' can only read unassigned or assigned rows.
> 2. **Webhooks:** We need a route handler at `/api/webhooks/httpsms` that accepts POST requests. It must parse the httpsms payload (refer to httpsms docs for schema) and insert into the DB using the Supabase Admin client.
> 3. **UI:** Use Tailwind and Lucide React icons. Create a clean dashboard layout.
> 
> 
> **Task 1:** Generate the Supabase SQL schema for the tables described in the README, including an Enum for user roles.
> **Task 2:** Create the `route.ts` for the webhook handler."

### 7. Deployment Strategy

1. Push to GitHub.
2. Import to Vercel.
3. Add Environment Variables in Vercel Dashboard.
4. Copy the Vercel Production URL (e.g., `https://my-app.vercel.app/api/webhooks/httpsms`).
5. Paste this URL into the httpsms.com Webhook Settings.

