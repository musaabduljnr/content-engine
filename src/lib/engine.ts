import { supabaseAdmin } from './services/supabase';
import { fetchTrendingTopics, filterRelevantTopics } from './services/reddit';
import { generateContent } from './services/gemini';
import { generateCanvaGraphic } from './services/canva';
import { generateHyperFramesVideo } from './services/hyperframes';
import { sendContentEmail, EmailPayload } from './services/resend';
import { createCalendarReminder } from './services/calendar';

export interface AutomationResult {
  success: boolean;
  runId: string;
  topic?: string;
  post?: string;
  error?: string;
}

export async function runAutomationEngine(manualRun = false): Promise<AutomationResult> {
  // 1. Create a content run record
  const { data: run, error: runInsertError } = await supabaseAdmin
    .from('content_runs')
    .insert({
      status: 'running',
    })
    .select('id')
    .single();

  if (runInsertError || !run) {
    console.error('Failed to create content run log:', runInsertError);
    return { success: false, runId: '', error: 'Database error creating run' };
  }

  const runId = run.id;
  const now = new Date();

  try {
    // 2. Fetch configurations from the settings table
    const { data: settingsList } = (await supabaseAdmin
      .from('settings')
      .select('key, value')) as any;
    
    const settingsMap = new Map<string, string>((settingsList || []).map((s: any) => [s.key, s.value]));

    const canvaEnabled = settingsMap.get('canva_enabled') !== 'false'; // Default to true
    const hyperFramesEnabled = settingsMap.get('hyperframes_enabled') !== 'false'; // Default to true
    const customGeminiKey = settingsMap.get('gemini_api_key') || undefined;
    const customResendKey = settingsMap.get('resend_api_key') || undefined;
    const customRecipient = settingsMap.get('owner_email') || undefined;

    // 3. Research engine: fetch trending Reddit topics
    let candidates: { title: string; selftext: string }[] = [];
    try {
      const posts = await fetchTrendingTopics();
      const filtered = filterRelevantTopics(posts);
      candidates = filtered.map((p) => ({ title: p.title, selftext: p.selftext }));
    } catch (e) {
      console.error('Failed to fetch trending topics, proceeding to evergreen fallback:', e);
    }

    // 4. Content generation: call Gemini API (with candidate list or evergreen fallback)
    const content = await generateContent(candidates, customGeminiKey);

    // Save topic
    const { data: topicRecord } = await supabaseAdmin
      .from('topics')
      .insert({
        name: content.topic,
        category: content.category,
      })
      .select('id')
      .single();

    const topicId = topicRecord?.id || null;

    // Save post
    await supabaseAdmin.from('generated_posts').insert({
      run_id: runId,
      topic_id: topicId,
      content: content.post,
      hook: content.hook,
      summary: content.summary,
      why_it_matters: content.why_it_matters,
      visual_direction: content.visual_direction,
      video_direction: content.video_direction,
    });

    // 5. Asset generation: Canva Graphic (non-blocking)
    let canvaUrl = '';
    if (canvaEnabled) {
      try {
        const canvaAsset = await generateCanvaGraphic(
          content.topic,
          content.why_it_matters,
          content.visual_direction,
          settingsMap.get('canva_api_key') || undefined
        );
        canvaUrl = canvaAsset.assetUrl;

        await supabaseAdmin.from('generated_assets').insert({
          run_id: runId,
          type: 'image',
          provider: 'canva',
          asset_url: canvaUrl,
          status: 'success',
        });
      } catch (e: any) {
        console.error('Canva asset generation failed:', e);
        await supabaseAdmin.from('generated_assets').insert({
          run_id: runId,
          type: 'image',
          provider: 'canva',
          status: 'failed',
          error_message: e.message || 'Canva generation failed',
        });
      }
    }

    // 6. Asset generation: HyperFrames Video (non-blocking)
    let videoUrl = '';
    if (hyperFramesEnabled) {
      try {
        const hyperFramesAsset = await generateHyperFramesVideo(
          content.topic,
          content.hook,
          content.video_direction,
          settingsMap.get('hyperframes_api_key') || undefined
        );
        videoUrl = hyperFramesAsset.videoUrl;

        await supabaseAdmin.from('generated_assets').insert({
          run_id: runId,
          type: 'video',
          provider: 'hyperframes',
          asset_url: videoUrl,
          status: 'success',
        });
      } catch (e: any) {
        console.error('HyperFrames asset generation failed:', e);
        await supabaseAdmin.from('generated_assets').insert({
          run_id: runId,
          type: 'video',
          provider: 'hyperframes',
          status: 'failed',
          error_message: e.message || 'HyperFrames generation failed',
        });
      }
    }

    // 7. Email delivery: Resend (blocking in terms of logging, but failure won't crash setting success)
    let emailSent = false;
    let emailError: string | undefined;
    const recipient = customRecipient || process.env.OWNER_EMAIL || '';

    // Calculate suggested posting time (e.g., in 15 minutes)
    const postingTime = new Date(now.getTime() + 15 * 60 * 1000);
    const suggestedTimeStr = postingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' +
      postingTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    const emailPayload: EmailPayload = {
      topic: content.topic,
      summary: content.summary,
      post: content.post,
      canvaUrl: canvaUrl || 'No graphic generated',
      hyperFramesUrl: videoUrl || 'No video generated',
      suggestedPostingTime: suggestedTimeStr,
    };

    try {
      const emailResult = await sendContentEmail(emailPayload, customResendKey, recipient);
      emailSent = emailResult.success;
      emailError = emailResult.error;

      await supabaseAdmin.from('email_logs').insert({
        run_id: runId,
        subject: `AI Content Delivery — ${content.topic.slice(0, 30)}`,
        recipient: recipient,
        status: emailSent ? 'success' : 'failed',
        error_message: emailError || null,
      });
    } catch (e: any) {
      console.error('Email delivery failed:', e);
      emailError = e.message || 'Unknown email error';
      await supabaseAdmin.from('email_logs').insert({
        run_id: runId,
        subject: `AI Content Delivery — ${content.topic.slice(0, 30)}`,
        recipient: recipient,
        status: 'failed',
        error_message: emailError,
      });
    }

    // 8. Calendar reminder: Google Calendar (non-blocking)
    if (emailSent) {
      try {
        const calResult = await createCalendarReminder(content.post, now);
        await supabaseAdmin.from('calendar_logs').insert({
          run_id: runId,
          event_id: calResult.eventId || null,
          title: 'Post AI content on X',
          scheduled_for: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          status: calResult.success ? 'success' : 'failed',
          error_message: calResult.error || null,
        });
      } catch (e: any) {
        console.error('Google Calendar reminder creation failed:', e);
        await supabaseAdmin.from('calendar_logs').insert({
          run_id: runId,
          title: 'Post AI content on X',
          scheduled_for: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
          status: 'failed',
          error_message: e.message || 'Unknown calendar error',
        });
      }
    }

    // 9. Update content run log to success
    await supabaseAdmin
      .from('content_runs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return {
      success: true,
      runId,
      topic: content.topic,
      post: content.post,
    };
  } catch (error: any) {
    console.error('Automation Engine Execution Failed:', error);

    // Update content run log to failed
    await supabaseAdmin
      .from('content_runs')
      .update({
        status: 'failed',
        error_message: error.message || 'Unknown automation engine crash',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return {
      success: false,
      runId,
      error: error.message || 'Automation engine crashed',
    };
  }
}
