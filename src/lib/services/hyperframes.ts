interface HyperFramesResponse {
  videoUrl: string;
  id: string;
}

export async function generateHyperFramesVideo(
  topic: string,
  hook: string,
  videoDirection: string,
  customApiKey?: string
): Promise<HyperFramesResponse> {
  const apiKey = customApiKey || process.env.HYPERFRAMES_API_KEY;

  if (!apiKey) {
    console.warn('HyperFrames API key is not configured. Falling back to mock video URL.');
    return {
      videoUrl: `https://heygen.com/hyperframes/demo-video?topic=${encodeURIComponent(topic)}`,
      id: 'mock_hyperframes_video_id',
    };
  }

  try {
    // Generic HyperFrames / HeyGen video generation API call
    const response = await fetch('https://api.heygen.com/v1/hyperframes/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `Vertical Video - ${topic.slice(0, 30)}`,
        dimension: {
          width: 1080,
          height: 1920,
        },
        script: hook,
        style_prompt: videoDirection,
        duration: 15, // default 15s
        avatar: {
          enabled: false, // no talking avatar
        },
        aesthetic: 'AI/productivity',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen/HyperFrames API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      videoUrl: data.video_url || `https://heygen.com/hyperframes/video/${data.id}`,
      id: data.id || 'heygen_id',
    };
  } catch (error) {
    console.error('Failed to generate HyperFrames video:', error);
    // Non-blocking fallback
    return {
      videoUrl: `https://heygen.com/hyperframes/demo-video-error?topic=${encodeURIComponent(topic)}`,
      id: 'fallback_error_id',
    };
  }
}
