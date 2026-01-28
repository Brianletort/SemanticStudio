/**
 * Brave Search API Integration
 * 
 * Uses Brave Search API for web search augmentation in chat.
 * Requires BRAVE_API_KEY_AI_GROUNDING environment variable.
 */

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export interface BraveSearchResponse {
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      age?: string;
    }>;
  };
  query?: {
    original: string;
  };
}

/**
 * Check if Brave Search is configured
 * Note: Uses PRO keys for web search (AI_GROUNDING key doesn't return web results)
 */
export function isBraveSearchConfigured(): boolean {
  return !!(process.env.BRAVE_API_KEY_PRO || process.env.BRAVE_API_KEY_PRO_AI || process.env.BRAVE_API_KEY);
}

/**
 * Search the web using Brave Search API
 */
export async function braveSearch(
  query: string, 
  count: number = 5
): Promise<BraveSearchResult[]> {
  // Use PRO keys for web search (AI_GROUNDING key doesn't return web results)
  const apiKey = process.env.BRAVE_API_KEY_PRO || process.env.BRAVE_API_KEY_PRO_AI || process.env.BRAVE_API_KEY;
  
  if (!apiKey) {
    console.warn('[BraveSearch] No API key configured');
    throw new Error('Brave Search API key not configured');
  }

  // Truncate query to meet Brave API limits (400 chars or 50 words)
  const MAX_QUERY_LENGTH = 400;
  const MAX_WORDS = 50;

  let truncatedQuery = query;
  const words = query.split(/\s+/);
  if (words.length > MAX_WORDS) {
    truncatedQuery = words.slice(0, MAX_WORDS).join(' ');
  }
  if (truncatedQuery.length > MAX_QUERY_LENGTH) {
    truncatedQuery = truncatedQuery.substring(0, MAX_QUERY_LENGTH);
    // Avoid cutting in middle of word
    const lastSpace = truncatedQuery.lastIndexOf(' ');
    if (lastSpace > MAX_QUERY_LENGTH - 50) {
      truncatedQuery = truncatedQuery.substring(0, lastSpace);
    }
  }

  const wasQueryTruncated = truncatedQuery !== query;
  console.log(`[BraveSearch] Searching for: "${truncatedQuery.substring(0, 100)}..." (count: ${count})${wasQueryTruncated ? ` [truncated from ${query.length} to ${truncatedQuery.length} chars]` : ''}`);

  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', truncatedQuery);
    url.searchParams.set('count', String(count));
    url.searchParams.set('safesearch', 'moderate');
    // Removed freshness filter to get more results

    const response = await fetch(url.toString(), {
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error body');
      console.error('[BraveSearch] API error:', response.status, response.statusText, errorText);
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data: BraveSearchResponse = await response.json();
    
    console.log(`[BraveSearch] Response received, web results: ${data.web?.results?.length ?? 0}`);
    
    if (!data.web?.results) {
      console.log('[BraveSearch] No web.results in response, full response:', JSON.stringify(data).substring(0, 500));
      return [];
    }

    return data.web.results.map((result) => ({
      title: result.title,
      url: result.url,
      description: result.description,
      age: result.age,
    }));
  } catch (error) {
    console.error('[BraveSearch] Failed to search:', error);
    throw error;
  }
}

/**
 * Format search results for LLM context
 */
export function formatSearchResultsForContext(results: BraveSearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const formattedResults = results
    .map((result, i) => {
      return `[${i + 1}] ${result.title}\n   URL: ${result.url}\n   ${result.description}${result.age ? ` (${result.age})` : ''}`;
    })
    .join('\n\n');

  return `## Web Search Results\n\n${formattedResults}`;
}

/**
 * Analyze if a query would benefit from web search
 */
export function shouldUseWebSearch(query: string): boolean {
  const lowercaseQuery = query.toLowerCase();
  
  // Keywords that suggest web search would help
  const webSearchIndicators = [
    'latest', 'recent', 'news', 'current', 'today', '2024', '2025', '2026',
    'what is', 'who is', 'how to', 'why is', 'when did',
    'compare', 'vs', 'versus', 'best', 'top', 'review',
    'price', 'cost', 'buy', 'where can i',
    'update', 'release', 'announcement', 'launched',
  ];
  
  return webSearchIndicators.some(indicator => lowercaseQuery.includes(indicator));
}

export default {
  braveSearch,
  formatSearchResultsForContext,
  isBraveSearchConfigured,
  shouldUseWebSearch,
};
