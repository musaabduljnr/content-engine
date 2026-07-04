interface CanvaAssetResponse {
  assetUrl: string;
  id: string;
}

export async function generateCanvaGraphic(
  topic: string,
  insight: string,
  visualDirection: string,
  customApiKey?: string
): Promise<CanvaAssetResponse> {
  const apiKey = customApiKey || process.env.CANVA_API_KEY;

  if (!apiKey) {
    console.warn('Canva API key is not configured. Falling back to mock graphic URL.');
    return {
      assetUrl: `https://www.canva.com/design/demo-graphic?topic=${encodeURIComponent(topic)}&insight=${encodeURIComponent(insight)}`,
      id: 'mock_canva_design_id',
    };
  }

  try {
    // Generic Canva Connect API call example (e.g. creating/autofilling a template design)
    // Post to Canva's design creation or autofill endpoint
    const response = await fetch('https://api.canva.com/v1/designs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `AI Post Graphic - ${topic.slice(0, 30)}`,
        width: 1080,
        height: 1080,
        asset_details: {
          headline: topic,
          body: insight,
          style_notes: visualDirection,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Canva API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      assetUrl: data.url || `https://www.canva.com/design/${data.id}`,
      id: data.id,
    };
  } catch (error) {
    console.error('Failed to generate Canva graphic:', error);
    // Non-blocking fallback
    return {
      assetUrl: `https://www.canva.com/design/demo-graphic-error?topic=${encodeURIComponent(topic)}`,
      id: 'fallback_error_id',
    };
  }
}
