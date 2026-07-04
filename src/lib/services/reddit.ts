export interface RedditPost {
  title: string;
  url: string;
  subreddit: string;
  score: number;
  num_comments: number;
  selftext: string;
  created_utc: number;
}

const SUBREDDITS = ['singularity', 'LocalLLaMA', 'openai', 'SaaS', 'startups', 'technology'];

export async function fetchTrendingTopics(): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];

  for (const subreddit of SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) content-delivery-automation/1.0 (by /u/automation-owner)',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch from r/${subreddit}: Status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const children = data?.data?.children || [];

      for (const child of children) {
        const postData = child.data;
        if (postData && !postData.stickied) {
          posts.push({
            title: postData.title,
            url: `https://reddit.com${postData.permalink || postData.url}`,
            subreddit,
            score: postData.score || 0,
            num_comments: postData.num_comments || 0,
            selftext: postData.selftext || '',
            created_utc: postData.created_utc || 0,
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching trending topics from r/${subreddit}:`, error);
    }
  }

  // Sort by score (descending)
  return posts.sort((a, b) => b.score - a.score);
}

// Filters posts to match the specified trending categories
export function filterRelevantTopics(posts: RedditPost[]): RedditPost[] {
  const keywords = [
    'ai', 'artificial intelligence', 'tech', 'technology', 'ai tools', 'developer tools', 'dev tools',
    'startups', 'startup', 'saas', 'claude', 'openai', 'gemini', 'cursor', 'ai agents', 'agent', 'mcp'
  ];

  return posts.filter(post => {
    const textToSearch = `${post.title} ${post.selftext}`.toLowerCase();
    return keywords.some(keyword => textToSearch.includes(keyword));
  });
}
