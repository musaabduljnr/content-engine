import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { generateHyperFramesVideo } from '@/lib/services/hyperframes';
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

    // Resolve topic name
    let topicName = post.hook;
    if (post.topic_id) {
      const { data: topicData } = (await supabaseAdmin
        .from('topics')
        .select('name')
        .eq('id', post.topic_id)
        .single()) as any;
      if (topicData) {
        topicName = topicData.name;
      }
    }

    // 2. Fetch configurations
    const { data: settingsList } = (await supabaseAdmin.from('settings').select('key, value')) as any;
    const settingsMap = new Map<string, string>((settingsList || []).map((s: any) => [s.key, s.value]));

    const hyperFramesApiKey = settingsMap.get('hyperframes_api_key') || undefined;

    // Delete any old HyperFrames asset for this run
    await supabaseAdmin
      .from('generated_assets')
      .delete()
      .eq('run_id', runId)
      .eq('provider', 'hyperframes');

    // 3. Generate HyperFrames Video
    const result = await generateHyperFramesVideo(
      topicName,
      post.hook,
      post.video_direction || '',
      hyperFramesApiKey
    );

    // 4. Save asset
    await supabaseAdmin.from('generated_assets').insert({
      run_id: runId,
      type: 'video',
      provider: 'hyperframes',
      asset_url: result.videoUrl,
      status: 'success',
    });

    return NextResponse.json({ success: true, videoUrl: result.videoUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
