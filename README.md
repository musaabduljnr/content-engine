# X Content Delivery Automation Engine

An automated content generation and delivery engine built with Next.js, TypeScript, Supabase, Gemini, Resend, Canva, HyperFrames, and Google Calendar. 

It runs 3 times daily to research trending topics, write polished developer/founder-focused social posts, request graphical designs, render vertical videos, email you the package, and set a calendar event to prompt publication.

---

## 🚀 Key Features

* **Subreddit Trends Scraper:** Tracks `r/singularity`, `r/LocalLLaMA`, `r/openai`, `r/SaaS`, `r/startups`, and `r/technology` for high-scoring, keyword-relevant topics.
* **Fallback Educational Mode:** Automatically generates evergreen AI/DevTools tutorials if no recent viral trends are discovered.
* **Gemini Content Orchestration:** Selects the best topic, checks Supabase to ensure no repetitions within 7 days, and generates:
  * A 280-character post (Free X limit).
  * Hooks, summaries, and key value propositions.
  * Precise graphic prompts and video aesthetics.
* **Canva & HyperFrames Connectors:** Calls APIs to generate graphic images and vertical videos (mock fallback is used if keys aren't configured).
* **Supabase Security:** Secure tables protected by Row Level Security (RLS) policies requiring Supabase Authenticated roles.
* **Interactive Admin Dashboard:**
  * Toggle Canva or HyperFrames runs.
  * Update API keys and configuration directly.
  * Manually trigger run executions.
  * Retry individual run steps (Canva, HyperFrames, Resend, Calendar) on failure.
  * Direct Google Calendar OAuth linking.

---

## 📁 Project Structure

```text
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── assets/
│   │   │   │   ├── canva/route.ts          # Canva regeneration retry
│   │   │   │   └── hyperframes/route.ts    # HyperFrames regeneration retry
│   │   │   ├── calendar/
│   │   │   │   ├── auth-url/route.ts       # Get Google OAuth url
│   │   │   │   └── callback/route.ts       # Google OAuth callback
│   │   │   │   └── create-reminder/route.ts# Calendar reminder retry
│   │   │   ├── content/
│   │   │   │   └── manual-run/route.ts     # Manual dashboard trigger
│   │   │   ├── cron/
│   │   │   │   └── content-run/route.ts    # 3x daily automated task
│   │   │   ├── email/
│   │   │   │   └── send/route.ts           # Email send retry
│   │   │   ├── settings/route.ts           # Fetch & Save settings
│   │   │   └── runs/route.ts               # Get history runs list
│   │   ├── dashboard.module.css            # Dark mode styles
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                        # Dashboard workspace & auth card
│   ├── lib/
│   │   ├── services/
│   │   │   ├── calendar.ts                 # Google Calendar API integration
│   │   │   ├── canva.ts                    # Canva API integration
│   │   │   ├── gemini.ts                   # Gemini structured JSON generator
│   │   │   ├── hyperframes.ts              # HyperFrames API integration
│   │   │   ├── reddit.ts                   # Reddit JSON trend parser
│   │   │   ├── resend.ts                   # Resend dynamic template email
│   │   │   └── supabase.ts                 # Supabase client helpers
│   │   ├── auth.ts                         # NextJS server session wrapper
│   │   └── engine.ts                       # Orchestration workflow
│   └── types/
│       └── database.types.ts               # Supabase database types
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql        # Tables, schemas, and RLS policies
├── vercel.json                             # static cron configuration
└── package.json
```

---

## 🛠️ Step-by-Step Setup Instructions

### 1. Database Setup (Supabase)
1. Create a project in [Supabase](https://supabase.com).
2. Open the **SQL Editor** in the Supabase Dashboard.
3. Paste and run the SQL schema migration located in [00001_initial_schema.sql](file:///c:/Users/user/OneDrive/Desktop/content-engine/supabase/migrations/00001_initial_schema.sql).
4. Create an Admin user in Supabase under **Authentication** > **Users** using the email you plan to configure as `OWNER_EMAIL`. This user will be the only account authorized to log into the dashboard.

### 2. Google Cloud Console Configuration (for Google Calendar)
1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a project and enable the **Google Calendar API**.
3. Configure the **OAuth Consent Screen** (User Type: External / Publishing status: Testing, add your email as a test user).
4. Go to **Credentials** > **Create Credentials** > **OAuth Client ID**.
5. Set Application Type to **Web Application**.
6. Under **Authorized redirect URIs**, add:
   * Local: `http://localhost:3000/api/calendar/callback`
   * Production: `https://your-app-domain.vercel.app/api/calendar/callback`
7. Save and copy the **Client ID** and **Client Secret**.

### 3. Local Environment Variables
Create a `.env.local` file in the root of your project:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-never-expose-to-client
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key

# API Integrations
GEMINI_API_KEY=your-gemini-api-key
RESEND_API_KEY=re_your_resend_api_key
OWNER_EMAIL=your-admin-email@domain.com
CRON_SECRET=a-secure-random-token-protecting-endpoints

# Google OAuth Credentials
GOOGLE_CALENDAR_CLIENT_ID=your-google-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-google-client-secret

# Canva & HyperFrames (Optional, mocks are utilized if keys are empty)
CANVA_API_KEY=your-canva-api-key
HYPERFRAMES_API_KEY=your-hyperframes-api-key
```

### 4. Running Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start local dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
4. Log in using the email and password you created in your Supabase Auth panel.
5. In the dashboard settings column (right), click the **📅 Link Google Calendar** button to complete the OAuth validation and store your offline refresh tokens securely.

---

## ⏱️ Vercel Deployment & Cron Configuration

1. Connect your GitHub repository to Vercel and import your project.
2. Input all environment variables in Vercel project settings (ensure you add `CRON_SECRET`).
3. Deploy the application.
4. Once deployed, link Google Calendar via your production dashboard domain to enable production calendar reminder creations.

### Vercel Hobby vs Pro Cron Limitations

> [!WARNING]
> The `vercel.json` file is pre-configured to run the automation route `/api/cron/content-run` 3 times a day (8:00, 14:00, 20:00 UTC).
> 
> * **Vercel Hobby Tier:** Vercel Hobby supports only **once-daily cron triggers**. Vercel will ignore the 3x daily schedule and only trigger it once a day.
> * **Solution for Hobby Tier:** If you are using the Hobby tier, you must use an external cron service (like [cron-job.org](https://cron-job.org) or [GitHub Actions](https://github.com/features/actions)) to trigger the endpoint. Configure the external scheduler to call:
>   `GET https://your-production-url.vercel.app/api/cron/content-run?cron_secret=YOUR_CRON_SECRET` at your desired hours.
