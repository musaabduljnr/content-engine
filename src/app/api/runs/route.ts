import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch runs (order by started_at descending)
    const { data: runs, error: runsError } = await supabaseAdmin
      .from('content_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(30);

    if (runsError) throw runsError;

    if (!runs || runs.length === 0) {
      return NextResponse.json({ runs: [] });
    }

    const runIds = runs.map((r) => r.id);

    // Fetch related generated posts
    const { data: posts } = await supabaseAdmin
      .from('generated_posts')
      .select('*, topic:topic_id(name, category)')
      .in('run_id', runIds);

    // Fetch related generated assets
    const { data: assets } = await supabaseAdmin
      .from('generated_assets')
      .select('*')
      .in('run_id', runIds);

    // Fetch related email logs
    const { data: emails } = await supabaseAdmin
      .from('email_logs')
      .select('*')
      .in('run_id', runIds);

    // Fetch related calendar logs
    const { data: calendars } = await supabaseAdmin
      .from('calendar_logs')
      .select('*')
      .in('run_id', runIds);

    // Group related data for client consumption
    const enrichedRuns = runs.map((run) => {
      const post = posts?.find((p) => p.run_id === run.id) || null;
      const runAssets = assets?.filter((a) => a.run_id === run.id) || [];
      const runEmails = emails?.filter((e) => e.run_id === run.id) || [];
      const runCalendars = calendars?.filter((c) => c.run_id === run.id) || [];

      return {
        ...run,
        post,
        assets: runAssets,
        email_logs: runEmails,
        calendar_logs: runCalendars,
      };
    });

    return NextResponse.json({ runs: enrichedRuns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
