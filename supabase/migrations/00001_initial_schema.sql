-- Create tables

-- 1. Topics
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Content Runs
CREATE TABLE IF NOT EXISTS content_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Generated Posts
CREATE TABLE IF NOT EXISTS generated_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES content_runs(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    hook TEXT NOT NULL,
    summary TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    visual_direction TEXT,
    video_direction TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Generated Assets
CREATE TABLE IF NOT EXISTS generated_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES content_runs(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    provider TEXT NOT NULL CHECK (provider IN ('canva', 'hyperframes')),
    asset_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES content_runs(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Calendar Logs
CREATE TABLE IF NOT EXISTS calendar_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES content_runs(id) ON DELETE CASCADE,
    event_id TEXT,
    title TEXT NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies (Allows access ONLY to authenticated users, since this is a private dashboard)
CREATE POLICY "Allow read for authenticated users" ON topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON topics FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow read for authenticated users" ON content_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for authenticated users" ON content_runs FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read for authenticated users" ON generated_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for authenticated users" ON generated_posts FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read for authenticated users" ON generated_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for authenticated users" ON generated_assets FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read for authenticated users" ON email_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for authenticated users" ON email_logs FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read for authenticated users" ON calendar_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for authenticated users" ON calendar_logs FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read for authenticated users" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for authenticated users" ON settings FOR ALL TO authenticated USING (true);

-- Also allow service role bypass (automatic for service_role in Supabase, but good to keep in mind)
-- API routes will run with service_role key to bypass RLS when executed via cron or background jobs.
