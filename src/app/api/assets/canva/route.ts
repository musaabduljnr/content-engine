import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { generateCanvaGraphic } from '@/lib/services/canva';
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

    const canvaApiKey = settingsMap.get('canva_api_key') || undefined;

    // Delete any old Canva asset for this run
    await supabaseAdmin
      .from('generated_assets')
      .delete()
      .eq('run_id', runId)
      .eq('provider', 'canva');

    // 3. Generate Canva Graphic
    const result = await generateCanvaGraphic(
      topicName,
      post.why_it_matters,
      post.visual_direction || '',
      canvaApiKey
    );

    // 4. Save asset
    await supabaseAdmin.from('generated_assets').insert({
      run_id: runId,
      type: 'image',
      provider: 'canva',
      asset_url: result.assetUrl,
      status: 'success',
    });

    return NextResponse.json({ success: true, assetUrl: result.assetUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
