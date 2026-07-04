import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { createCalendarReminder } from '@/lib/services/calendar';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { runId } = await request.json();
    if (!runId) {
      return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
    }

    // 1. Get generated post content
    const { data: post } = (await supabaseAdmin
      .from('generated_posts')
      .select('*')
      .eq('run_id', runId)
      .single()) as any;

    if (!post) {
      return NextResponse.json({ error: 'No generated post found for this runId' }, { status: 404 });
    }

    // 2. Call calendar service
    const calResult = await createCalendarReminder(post.content, new Date());

    // 3. Log execution
    await supabaseAdmin.from('calendar_logs').insert({
      run_id: runId,
      event_id: calResult.eventId || null,
      title: 'Post AI content on X (Retry)',
      scheduled_for: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      status: calResult.success ? 'success' : 'failed',
      error_message: calResult.error || null,
    });

    if (calResult.success) {
      return NextResponse.json({ success: true, message: 'Google Calendar event created successfully' });
    } else {
      return NextResponse.json({ error: calResult.error }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
