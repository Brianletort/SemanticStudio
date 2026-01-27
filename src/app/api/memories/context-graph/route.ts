import { NextRequest, NextResponse } from 'next/server';
import { createContextGraphService } from '@/lib/memory/context-graph-service';

// Default user ID for development
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * GET /api/memories/context-graph
 * 
 * Query parameters:
 * - query: Search for what user discussed about this entity (optional)
 * - action: 'top-entities' | 'recent' (optional)
 * - limit: Number of results (default 20)
 * 
 * Examples:
 * - /api/memories/context-graph?query=Acme Corp
 * - /api/memories/context-graph?action=top-entities&limit=10
 * - /api/memories/context-graph?action=recent&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const contextGraph = createContextGraphService(userId);

    // Action: get top entities user has interacted with
    if (action === 'top-entities') {
      const topEntities = await contextGraph.getTopEntities(limit);
      return NextResponse.json({
        type: 'top-entities',
        data: topEntities,
      });
    }

    // Action: get recent context references
    if (action === 'recent') {
      const recent = await contextGraph.getRecentReferences(limit);
      return NextResponse.json({
        type: 'recent',
        data: recent,
      });
    }

    // Query: "What did I discuss about X?"
    if (query) {
      const results = await contextGraph.whatDidIDiscussAbout(query);
      return NextResponse.json({
        type: 'query',
        query,
        data: results,
      });
    }

    // Default: return recent references
    const recent = await contextGraph.getRecentReferences(limit);
    return NextResponse.json({
      type: 'recent',
      data: recent,
    });
  } catch (error) {
    console.error('Failed to query context graph:', error);
    return NextResponse.json(
      { error: 'Failed to query context graph' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memories/context-graph
 * 
 * Clear all context references for user (privacy/cleanup)
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const contextGraph = createContextGraphService(userId);
    
    const deletedCount = await contextGraph.clearUserContext();
    
    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    console.error('Failed to clear context graph:', error);
    return NextResponse.json(
      { error: 'Failed to clear context graph' },
      { status: 500 }
    );
  }
}
