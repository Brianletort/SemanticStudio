/**
 * Semantic Search Tool
 * 
 * Allows agents to perform semantic search across their configured knowledge bases.
 * Supports semantic (vector), hybrid (vector + keyword), and keyword-only search modes.
 */

import { UnifiedRetriever, getUnifiedRetriever } from '@/lib/search/unified-retriever';
import type { SearchResult } from '@/lib/search/types';
import type { Tool, ToolDefinition, ToolContext, ToolResult } from './types';

// Search parameters
export interface SemanticSearchParams {
  query: string;
  mode?: 'semantic' | 'hybrid' | 'keyword';
  limit?: number;
  filters?: Record<string, unknown>;
}

// Search result format for tool output
export interface SemanticSearchToolResult {
  results: Array<{
    id: string;
    content: string;
    score: number;
    source: string;
    metadata?: Record<string, unknown>;
  }>;
  totalResults: number;
  searchMode: string;
  executionTimeMs?: number;
}

// Tool definition
export const semanticSearchToolDefinition: ToolDefinition = {
  name: 'search_knowledge',
  description: 'Search across knowledge bases using semantic similarity. Use this to find relevant information, documents, or data that matches the meaning of your query. Supports semantic search (finds conceptually similar content), hybrid search (combines semantic and keyword matching), and keyword search (exact term matching).',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Can be a question, phrase, or keywords. For semantic search, phrasing it as a question or complete thought often works better.',
      },
      mode: {
        type: 'string',
        description: 'Search mode: "semantic" (find conceptually similar content using embeddings), "hybrid" (combine semantic and keyword search - recommended default), or "keyword" (exact term matching).',
        enum: ['semantic', 'hybrid', 'keyword'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return. Default is 10.',
      },
    },
    required: ['query'],
  },
};

// Tool executor
export async function executeSemanticSearch(
  params: SemanticSearchParams,
  context: ToolContext
): Promise<ToolResult<SemanticSearchToolResult>> {
  const startTime = Date.now();
  const retriever = getUnifiedRetriever();
  
  try {
    // Load agent configuration if available
    if (context.agentId) {
      await retriever.loadAgentConfig(context.agentId, context.dataSourceId);
    }
    
    // Execute search
    const results = await retriever.search({
      query: params.query,
      agentId: context.agentId,
      dataSourceId: context.dataSourceId,
      mode: params.mode || 'hybrid',
      limit: params.limit || 10,
      filters: params.filters,
    });
    
    const executionTimeMs = Date.now() - startTime;
    
    // Format results for tool output
    const formattedResults = results.map(r => ({
      id: r.id,
      content: r.content,
      score: r.score,
      source: r.source,
      metadata: r.metadata,
    }));
    
    return {
      success: true,
      data: {
        results: formattedResults,
        totalResults: formattedResults.length,
        searchMode: params.mode || 'hybrid',
        executionTimeMs,
      },
      metadata: {
        executionTimeMs,
        agentId: context.agentId,
        searchMode: params.mode || 'hybrid',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during search',
      metadata: {
        executionTimeMs: Date.now() - startTime,
      },
    };
  }
}

// Format search results for inclusion in agent context
export function formatSearchResultsForContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No relevant results found.';
  }
  
  const formatted = results
    .map((result, i) => {
      const score = (result.score * 100).toFixed(1);
      return `[${i + 1}] (Score: ${score}%)\n${result.content.slice(0, 500)}${result.content.length > 500 ? '...' : ''}`;
    })
    .join('\n\n');
  
  return `## Search Results (${results.length} found)\n\n${formatted}`;
}

// Complete tool export
export const semanticSearchTool: Tool<SemanticSearchParams, SemanticSearchToolResult> = {
  definition: semanticSearchToolDefinition,
  execute: executeSemanticSearch,
};

export default semanticSearchTool;
