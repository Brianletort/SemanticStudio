import { NextRequest, NextResponse } from 'next/server';
import { UnifiedRetriever, getUnifiedRetriever } from '@/lib/search/unified-retriever';

/**
 * POST /api/search
 * 
 * Unified search endpoint that queries configured backends based on agent configuration.
 * Supports semantic search, hybrid search, and keyword search.
 * 
 * Request body:
 * - query: string (required) - The search query
 * - agentId: string (optional) - Agent ID to use for configuration
 * - dataSourceId: string (optional) - Specific data source to search
 * - mode: 'semantic' | 'hybrid' | 'keyword' (optional, default: 'hybrid')
 * - limit: number (optional, default: 10)
 * - filters: object (optional) - Additional filters
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, agentId, dataSourceId, mode, limit, filters } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate mode if provided
    if (mode && !['semantic', 'hybrid', 'keyword'].includes(mode)) {
      return NextResponse.json(
        { error: 'mode must be one of: semantic, hybrid, keyword' },
        { status: 400 }
      );
    }

    // Validate limit if provided
    if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
      return NextResponse.json(
        { error: 'limit must be a number between 1 and 100' },
        { status: 400 }
      );
    }

    const retriever = getUnifiedRetriever();
    
    // Load agent config if provided
    if (agentId) {
      await retriever.loadAgentConfig(agentId, dataSourceId);
    }

    // Execute search
    const startTime = Date.now();
    const results = await retriever.search({
      query,
      agentId,
      dataSourceId,
      mode: mode || 'hybrid',
      limit: limit || 10,
      filters,
    });
    const executionTimeMs = Date.now() - startTime;

    return NextResponse.json({
      query,
      mode: mode || 'hybrid',
      results: results.map(r => ({
        id: r.id,
        content: r.content,
        score: r.score,
        source: r.source,
        metadata: r.metadata,
      })),
      totalResults: results.length,
      executionTimeMs,
    });
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json(
      { 
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search
 * 
 * Simple search endpoint for quick queries.
 * 
 * Query parameters:
 * - q: string (required) - The search query
 * - agent: string (optional) - Agent ID
 * - mode: 'semantic' | 'hybrid' | 'keyword' (optional)
 * - limit: number (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const agentId = searchParams.get('agent');
    const mode = searchParams.get('mode') as 'semantic' | 'hybrid' | 'keyword' | null;
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 10;

    if (!query) {
      return NextResponse.json(
        { error: 'q query parameter is required' },
        { status: 400 }
      );
    }

    const retriever = getUnifiedRetriever();
    
    if (agentId) {
      await retriever.loadAgentConfig(agentId);
    }

    const startTime = Date.now();
    const results = await retriever.search({
      query,
      agentId: agentId || undefined,
      mode: mode || 'hybrid',
      limit,
    });
    const executionTimeMs = Date.now() - startTime;

    return NextResponse.json({
      query,
      mode: mode || 'hybrid',
      results: results.map(r => ({
        id: r.id,
        content: r.content,
        score: r.score,
        source: r.source,
      })),
      totalResults: results.length,
      executionTimeMs,
    });
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json(
      { 
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
