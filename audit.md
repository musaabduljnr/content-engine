# Content Engine Project Audit

This document provides a comprehensive audit of the **Content Engine** codebase, detailing its architecture, state flows, database schema, third-party integrations, API routes, and dashboard interface.

---

## 1. Executive Summary

The **Content Engine** is a modern Next.js application built to automate research, creation, and delivery of high-value technical and startup-focused content packages. It leverages multi-agent pipelines to scrape trending industry topics, synthesize ready-to-post drafts using generative AI, dynamically compile graphic and video assets, and dispatch structured deliveries to the project owner via email while setting Google Calendar posting reminders.

---

## 2. System Architecture & Flow

The system operates on an orchestrated pipeline that can be triggered through two entrance vectors:
1. **Automated Trigger (Cron):** A GET request targeting the secure `/api/cron/content-run` endpoint verified with a `CRON_SECRET` header or query parameter.
2. **On-Demand Trigger (Manual Run):** A POST request targeting `/api/content/manual-run`, initiated from the admin dashboard and secured via Supabase Session Authentication.

### Execution Workflow Pipeline

```
[Trigger Event] (Cron / Dashboard)
       │
       ▼
1. Create 'content_runs' record in Supabase (status: 'running')
       │
       ▼
2. Fetch system configurations from Supabase 'settings' table
       │
       ▼
3. Research Engine (Reddit API)
   ├─ Fetch from r/singularity, r/LocalLLaMA, r/openai, r/SaaS, r/startups, r/technology
   ├─ Filter posts containing keywords (ai, tech, saas, claude, mcp, agents, etc.)
   └─ Fallback: Evergreen content if candidate list is empty
       │
       ▼
4. Content Generation (Gemini API - gemini-2.5-flash)
   ├─ Filter out topic names covered in the last 7 days to prevent duplicates
   ├─ Generate structured JSON matching the system instructions
   └─ Insert records into Supabase ('topics' & 'generated_posts')
       │
       ├──────────────────────────────────────────────┐
       ▼ (Async/Non-blocking)                         ▼ (Async/Non-blocking)
5. Canva Graphic Generation                     6. HyperFrames Video Generation
   ├─ API request to Canva designs                 ├─ API request to HeyGen vertical video
   ├─ Fallback: Demo Canva design url              ├─ Fallback: Demo HyperFrames video url
   └─ Log status in 'generated_assets'             └─ Log status in 'generated_assets'
       │                                              │
       └──────────────────────┬───────────────────────┘
                              │
                              ▼
7. Email Delivery (Resend API)
   ├─ Build responsive HTML payload with final post text, summary, and assets
   ├─ Send email to recipient (OWNER_EMAIL)
   └─ Insert record into Supabase 'email_logs' (status: success/failed)
                              │
                              ▼ (Only if Email Sent successfully)
8. Calendar Reminder (Google Calendar API)
   ├─ Retrieve OAuth refresh token from settings
   ├─ Insert event scheduled for exactly 15 minutes in the future
   └─ Insert record into Supabase 'calendar_logs' (status: success/failed)
                              │
                              ▼
9. Update 'content_runs' record (status: 'success' or 'failed', record completed_at)
```

---

## 3. Database Schema Reference

The Supabase database holds the primary persistent state for run tracking, configurations, and assets. The structural layout from `src/types/database.types.ts` consists of the following tables:

| Table Name | Primary Key | Key Fields | Relationships / Notes |
| :--- | :--- | :--- | :--- |
| **`topics`** | `id` (UUID) | `name` (text), `category` (text), `created_at` (timestamptz) | Avoids duplicate topic generation over a rolling 7-day period. |
| **`content_runs`** | `id` (UUID) | `status` ('running' \| 'success' \| 'failed'), `error_message` (text), `started_at` (timestamptz), `completed_at` (timestamptz) | Tracks overall orchestrator job status. |
| **`generated_posts`** | `id` (UUID) | `run_id` (UUID), `topic_id` (UUID), `content` (text), `hook` (text), `summary` (text), `why_it_matters` (text), `visual_direction` (text), `video_direction` (text) | Stores the primary written assets written by Gemini. Links to `content_runs` and `topics`. |
| **`generated_assets`** | `id` (UUID) | `run_id` (UUID), `type` ('image' \| 'video'), `provider` ('canva' \| 'hyperframes'), `asset_url` (text), `status` ('pending' \| 'success' \| 'failed'), `error_message` (text) | Holds external asset links. Multiple assets can belong to a single run. |
| **`email_logs`** | `id` (UUID) | `run_id` (UUID), `subject` (text), `recipient` (text), `status` ('success' \| 'failed'), `error_message` (text), `sent_at` (timestamptz) | Audit trail of email dispatch success or error logs. |
| **`calendar_logs`** | `id` (UUID) | `run_id` (UUID), `event_id` (text), `title` (text), `scheduled_for` (timestamptz), `status` ('success' \| 'failed'), `error_message` (text) | Logs Google Calendar appointment insertions. |
| **`settings`** | `key` (text) | `value` (text), `updated_at` (timestamptz) | Stores dashboard configurations (API keys, toggles, schedules, OAuth refresh tokens). |

---

## 4. Third-Party Service Integrations

The system integrates with six external service APIs, utilizing a robust dual-source design: configurations are read first from the database `settings` table, falling back to server-side `process.env` environment variables.

### 4.1 Research Scraper (Reddit API)
- **Subreddits:** `['singularity', 'LocalLLaMA', 'openai', 'SaaS', 'startups', 'technology']`
- **Method:** Fetches `/r/{subreddit}/hot.json?limit=10` using a customized `User-Agent` header to respect Reddit’s API limits and avoid rate-limiting blocks.
- **Filtering:** Employs a strict keywords filter (`ai`, `artificial intelligence`, `tech`, `technology`, `ai tools`, `developer tools`, `dev tools`, `startups`, `saas`, `claude`, `openai`, `gemini`, `cursor`, `ai agents`, `mcp`, etc.) on both titles and selftext bodies.
- **Fallback:** If Reddit API calls fail or return empty lists, the engine triggers an "evergreen educational fallback" mode via Gemini.

### 4.2 Content Generation (Gemini API)
- **Model:** `gemini-2.5-flash`
- **Credentials:** `settings.gemini_api_key` ➔ `process.env.GEMINI_API_KEY`
- **Configuration:** Employs `responseMimeType: 'application/json'` to guarantee structural schema parsing.
- **Duplicate Prevention:** Before prompting Gemini, the system queries the `topics` table for entries generated within the last 7 days. These are supplied in the negative system instructions as excluded topics.
- **Rules & Guardrails:** Limits written content to a maximum of 280 characters matching the free X platform limits. Tone is configured to be technical, highly practical, and devoid of corporate jargon or generic emojis.

### 4.3 Graphic Generation (Canva Connect API)
- **Endpoint:** `POST https://api.canva.com/v1/designs`
- **Credentials:** `settings.canva_api_key` ➔ `process.env.CANVA_API_KEY`
- **Request Body:** Standard canvas dimension (`1080x1080`), passing `headline` (topic), `body` (insight), and `style_notes` (visual direction) under `asset_details`.
- **Non-blocking Fallback:** If the API key is not configured or the post fails, it gracefully logs a fallback mock design URL pointing to `https://www.canva.com/design/demo-graphic` rather than crashing the execution.

### 4.4 Video Generation (HeyGen / HyperFrames API)
- **Endpoint:** `POST https://api.heygen.com/v1/hyperframes/generate`
- **Credentials:** `settings.hyperframes_api_key` ➔ `process.env.HYPERFRAMES_API_KEY`
- **Request Body:** Configures vertical output (`1080x1920`), script content (hook), style prompt (video direction), 15s duration, disabled talking avatars, and the `AI/productivity` aesthetic.
- **Non-blocking Fallback:** If disabled or failing, logs a mock video preview URL pointing to `https://heygen.com/hyperframes/demo-video` rather than halting downstream email and calendar pipelines.

### 4.5 Email Delivery (Resend API)
- **Client:** Native `resend` SDK.
- **Credentials:** `settings.resend_api_key` ➔ `process.env.RESEND_API_KEY`
- **Delivery Target:** `settings.owner_email` ➔ `process.env.OWNER_EMAIL`
- **Payload:** Dispatches a structured responsive HTML layout detailing the generated Topic, Summary, final written Post, direct links to Canva and Hyperframes files, and a dynamically calculated suggested publishing time stamp.
- **Sender Profile:** Outbound emails run from `X Automation <onboarding@resend.dev>`.

### 4.6 Calendar Reminders (Google Calendar API)
- **Client:** `googleapis` client utilizing the OAuth2 sub-client.
- **Credentials:** `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, and `google_refresh_token` stored inside `settings`.
- **Authorization Flow:**
  - `/api/calendar/auth-url` returns the consent URL requesting `offline` access and `prompt: consent` to obtain the vital `refresh_token`.
  - `/api/calendar/callback` processes the authorization code, exchanges it for tokens, and updates `google_refresh_token` inside the settings.
- **Scheduling Logic:** Computes the execution timestamp + 15 minutes, scheduling a 30-minute event on the user's primary calendar titled `"Post AI content on X 🚀"` with the post snippet in the description. Configures an immediate `popup` alert at start time.

---

## 5. Next.js REST API Architecture

All routes utilize `export const dynamic = 'force-dynamic'` to prevent Next.js static page compilation and guarantee fully dynamic runtime handling.

| Endpoint | Method | Security | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/runs` | `GET` | Supabase Session Auth | Returns the last 30 execution runs enriched with posts, assets, and logs. |
| `/api/settings` | `GET` | Supabase Session Auth | Returns all settings saved in the DB. |
| `/api/settings` | `POST` | Supabase Session Auth | Saves modified dashboard configurations. |
| `/api/calendar/auth-url` | `GET` | Supabase Session Auth | Returns Google Calendar consent URL. |
| `/api/calendar/callback` | `GET` | Google OAuth Callback | Saves OAuth access/refresh tokens and redirects to dashboard settings. |
| `/api/content/manual-run` | `POST` | Supabase Session Auth | Manually triggers the `runAutomationEngine` pipeline immediately. |
| `/api/cron/content-run` | `GET` | `CRON_SECRET` Header/Query | Triggers the automated `runAutomationEngine` pipeline. |
| `/api/assets/canva` | `POST` | Supabase Session Auth | Retries/regenerates Canva asset for a given `runId`. |
| `/api/assets/hyperframes`| `POST` | Supabase Session Auth | Retries/regenerates HyperFrames video for a given `runId`. |
| `/api/email/send` | `POST` | Supabase Session Auth | Retries/resends delivery email for a given `runId`. |
| `/api/calendar/create-reminder` | `POST` | Supabase Session Auth | Retries/reschedules Google Calendar event for a given `runId`. |

---

## 6. Frontend Dashboard User Interface

The frontend (`src/app/page.tsx`) uses `'use client'` and connects directly to the backend APIs and Supabase authentication.

### Key Functional Components
1. **Supabase Auth Gateway:** Displays a dark-themed login terminal requiring admin credentials if no active session is found on mount.
2. **Dynamic Stats Dashboard:** Summarizes run analytics:
   - **Total Executions:** Comprehensive history count.
   - **Success Rate:** Successful runs as a percentage of total executions.
   - **Failed Runs:** Count of crashed pipeline runs.
3. **Run Engine Orchestrator:** Provides a single-click button to trigger a manual run with active status feedback during ingestion.
4. **Execution Log History:** List of executions rendering topics, run details, timestamps, final written post, asset statuses (with direct resource links), and error crash reports.
5. **Step-by-Step Recovery Actions:** Each item in the history provides standalone recovery buttons to retry single steps if they failed (e.g., *Retry Canva*, *Retry HyperFrames*, *Retry Email*, *Retry Calendar*) without running the entire generation pipeline again.
6. **Configuration Panel:** Offers interactive text/password fields for all API Keys, toggles to enable or disable Canva/HyperFrames generation, scheduling inputs for target hours (Morning, Afternoon, Evening in UTC), and a dedicated Google Calendar OAuth linking button.

---

## 7. Architectural Highlights & Key Findings

### 7.1 High Operational Resilience
Downstream assets (Canva, HyperFrames) and calendar integrations are structured as non-blocking try-catch blocks. If Canva or HeyGen APIs rate-limit or fail, the pipeline records the failure state in the DB and moves on to deliver the final email and written content. This ensures the engine remains fully operational even when third-party design platforms face downtime.

### 7.2 Key-Value Settings Storage Pattern
The system stores external secrets (such as API keys) directly in the database `settings` table rather than relying exclusively on system environment variables. This enables:
- Seamless database-driven setting changes on the production dashboard without requiring git commits or container redeployments.
- Security precaution: The table configurations bypass Row Level Security via the backend `supabaseAdmin` service client. Ensuring database keys remain encrypted at rest is highly recommended for production security.

### 7.3 Dynamic API Optimization
Explicitly defining `export const dynamic = 'force-dynamic'` on Next.js Route handlers ensures the server never attempts to serve stale statically pre-rendered content and forces standard live API resolution for each execution and retry payload.

---
*Audit compiled successfully on July 4, 2026.*
