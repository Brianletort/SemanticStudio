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
 */
export function isBraveSearchConfigured(): boolean {
  return !!(process.env.BRAVE_API_KEY_AI_GROUNDING || process.env.BRAVE_API_KEY);
}

/**
 * Search the web using Brave Search API
 */
export async function braveSearch(
  query: string, 
  count: number = 5
): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY_AI_GROUNDING || process.env.BRAVE_API_KEY;
  
  if (!apiKey) {
    console.warn('[BraveSearch] No API key configured');
    return [];
  }

  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(count));
    url.searchParams.set('safesearch', 'moderate');
    url.searchParams.set('freshness', 'py'); // Past year

    const response = await fetch(url.toString(), {
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[BraveSearch] API error:', response.status, response.statusText);
      return [];
    }

    const data: BraveSearchResponse = await response.json();
    
    if (!data.web?.results) {
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
    return [];
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
