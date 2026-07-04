import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from './supabase';

const geminiApiKey = process.env.GEMINI_API_KEY || '';

// Initialize client if key is available
const getGeminiClient = (apiKey?: string) => {
  const key = apiKey || geminiApiKey;
  if (!key) {
    throw new Error('Missing GEMINI_API_KEY environment variable or settings key.');
  }
  return new GoogleGenerativeAI(key);
};

export interface GeneratedPostContent {
  topic: string;
  category: string;
  post: string;
  hook: string;
  summary: string;
  why_it_matters: string;
  visual_direction: string;
  video_direction: string;
}

export async function generateContent(
  candidateTopics: { title: string; selftext: string }[],
  customApiKey?: string
): Promise<GeneratedPostContent> {
  const genAI = getGeminiClient(customApiKey);

  // 1. Fetch topics used in the last 7 days to prevent duplicates
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentTopics } = await supabaseAdmin
    .from('topics')
    .select('name')
    .gt('created_at', sevenDaysAgo.toISOString());

  const excludedTopicNames = new Set((recentTopics || []).map((t) => t.name.toLowerCase()));

  // 2. Format candidate topics for prompt, skipping recently used ones
  const filteredCandidates = candidateTopics.filter(
    (t) => !excludedTopicNames.has(t.title.toLowerCase())
  );

  const topicsList = filteredCandidates
    .slice(0, 15)
    .map((t, idx) => `Topic ${idx + 1}: "${t.title}"\nContext: ${t.selftext.slice(0, 300)}...`)
    .join('\n\n');

  const systemInstruction = `You are a high-performing social media manager and research analyst for founders, developers, and tech executives.
Your goal is to select the absolute best trending AI or developer tools topic from the candidate list (or create a high-value evergreen educational AI post if the candidate list is empty).
You will generate a structured response containing:
- topic: A clean, concise topic headline.
- category: One of 'AI', 'Tech', 'AI tools', 'developer tools', 'startups', 'SaaS', 'Claude', 'OpenAI', 'Gemini', 'Cursor', 'AI agents', 'MCP'.
- post: A polished, engaging X post.
- hook: A short, attention-grabbing hook from the post.
- summary: A brief summary of the topic.
- why_it_matters: Why this is critical for developers/founders.
- visual_direction: Design guidelines for a 1080x1080 graphic (headline, key insight, and modern AI/startup design style suggestions).
- video_direction: Directions for a 10-20 second vertical video (1080x1920, animated text, no talking avatar, AI/productivity aesthetic).

X POST RULES:
- MUST fit the free X character limit (maximum 280 characters).
- No long threads.
- No fluff, emojis or corporate jargon.
- No fake claims or hype.
- No hashtags unless absolutely necessary.
- Tone: smart, simple, developer-centric, founder/developer focused, educational, or highly practical.
- Make it sound like a real, technical human wrote it.
- Your output MUST be raw JSON matching the JSON schema provided in the request instructions. No markdown wraps (\`\`\`json ... \`\`\`), no extra text.`;

  const prompt = candidateTopics.length > 0
    ? `Here are the candidate trending topics from Reddit. Select the single best, most trending topic that has not been recently covered and write the post and metadata.

Candidates:
${topicsList}`
    : `There are no active trending topics from Reddit today. Generate a highly valuable, evergreen educational AI post (e.g., explaining an AI concept, an API pattern, or a developer tool technique).`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(`${systemInstruction}\n\n${prompt}`);
    const response = await result.response;
    const contentText = response.text() || '{}';
    const parsed: GeneratedPostContent = JSON.parse(contentText);

    // Safety fallback: clip post length if Gemini fails to follow the 280 limit
    if (parsed.post && parsed.post.length > 280) {
      parsed.post = parsed.post.slice(0, 277) + '...';
    }

    return parsed;
  } catch (error) {
    console.error('Error generating content with Gemini:', error);
    throw error;
  }
}
