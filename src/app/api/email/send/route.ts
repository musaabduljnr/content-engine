import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { sendContentEmail, EmailPayload } from '@/lib/services/resend';
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

    // 2. Fetch assets
    const { data: assets } = await supabaseAdmin
      .from('generated_assets')
      .select('*')
      .eq('run_id', runId);

    const canvaUrl = assets?.find(a => a.provider === 'canva')?.asset_url || 'No graphic generated';
    const hyperFramesUrl = assets?.find(a => a.provider === 'hyperframes')?.asset_url || 'No video generated';

    // 3. Fetch recipient & API key settings
    const { data: settingsList } = (await supabaseAdmin.from('settings').select('key, value')) as any;
    const settingsMap = new Map<string, string>((settingsList || []).map((s: any) => [s.key, s.value]));

    const recipient = settingsMap.get('owner_email') || process.env.OWNER_EMAIL || '';
    const customResendKey = settingsMap.get('resend_api_key') || undefined;

    const postingTime = new Date(Date.now() + 15 * 60 * 1000);
    const suggestedTimeStr = postingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' +
      postingTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    const emailPayload: EmailPayload = {
      topic: post.hook, // using hook or custom topic if available
      summary: post.summary,
      post: post.content,
      canvaUrl,
      hyperFramesUrl,
      suggestedPostingTime: suggestedTimeStr,
    };

    // Override topic if possible by retrieving the topic name
    if (post.topic_id) {
      const { data: topicData } = (await supabaseAdmin
        .from('topics')
        .select('name')
        .eq('id', post.topic_id)
        .single()) as any;
      if (topicData) {
        emailPayload.topic = topicData.name;
      }
    }

    const emailResult = await sendContentEmail(emailPayload, customResendKey, recipient);

    // 4. Log send status
    await supabaseAdmin.from('email_logs').insert({
      run_id: runId,
      subject: `AI Content Delivery (Retry) — ${emailPayload.topic.slice(0, 30)}`,
      recipient: recipient,
      status: emailResult.success ? 'success' : 'failed',
      error_message: emailResult.error || null,
    });

    if (emailResult.success) {
      return NextResponse.json({ success: true, message: 'Email sent successfully' });
    } else {
      return NextResponse.json({ error: emailResult.error }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
