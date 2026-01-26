import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentDataSources, domainAgents, dataSources } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { DEFAULT_RETRIEVAL_CONFIG } from '@/lib/etl/types';

/**
 * GET /api/agents/[id]/data-sources
 * 
 * Get all data sources configured for an agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;

    // Verify agent exists
    const [agent] = await db.select()
      .from(domainAgents)
      .where(eq(domainAgents.id, agentId))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get agent's data sources
    const sources = await db.select()
      .from(agentDataSources)
      .where(eq(agentDataSources.agentId, agentId));

    return NextResponse.json({
      agentId,
      agentName: agent.name,
      dataSources: sources.map(s => ({
        id: s.id,
        sourceType: s.sourceType,
        sourceName: s.sourceName,
        sourceConfig: s.sourceConfig,
        embeddingTable: s.embeddingTable,
        retrievalConfig: s.retrievalConfig || DEFAULT_RETRIEVAL_CONFIG,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch agent data sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent data sources' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/data-sources
 * 
 * Add a data source to an agent with retrieval configuration
 * 
 * Request body:
 * - sourceType: 'table' | 'view' | 'api' | 'file' | 'vector'
 * - sourceName: string
 * - sourceConfig: object (optional)
 * - embeddingTable: string (optional)
 * - retrievalConfig: object (optional)
 *   - enableSqlQueries: boolean
 *   - enableSemanticSearch: boolean
 *   - searchBackend: 'postgres' | 'azure' | 'both'
 *   - searchMode: 'semantic' | 'hybrid' | 'keyword'
 *   - azureIndexName: string (optional)
 *   - maxResults: number
 *   - similarityThreshold: number
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body = await request.json();
    const { sourceType, sourceName, sourceConfig, embeddingTable, retrievalConfig } = body;

    if (!sourceType || !sourceName) {
      return NextResponse.json(
        { error: 'sourceType and sourceName are required' },
        { status: 400 }
      );
    }

    // Validate sourceType
    const validSourceTypes = ['table', 'view', 'api', 'file', 'vector'];
    if (!validSourceTypes.includes(sourceType)) {
      return NextResponse.json(
        { error: `sourceType must be one of: ${validSourceTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify agent exists
    const [agent] = await db.select()
      .from(domainAgents)
      .where(eq(domainAgents.id, agentId))
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Validate retrieval config if provided
    if (retrievalConfig) {
      if (retrievalConfig.searchBackend && 
          !['postgres', 'azure', 'both'].includes(retrievalConfig.searchBackend)) {
        return NextResponse.json(
          { error: 'searchBackend must be one of: postgres, azure, both' },
          { status: 400 }
        );
      }
      if (retrievalConfig.searchMode && 
          !['semantic', 'hybrid', 'keyword'].includes(retrievalConfig.searchMode)) {
        return NextResponse.json(
          { error: 'searchMode must be one of: semantic, hybrid, keyword' },
          { status: 400 }
        );
      }
    }

    // Merge with defaults
    const finalRetrievalConfig = {
      ...DEFAULT_RETRIEVAL_CONFIG,
      ...retrievalConfig,
    };

    // Create agent data source
    const [source] = await db.insert(agentDataSources).values({
      agentId,
      sourceType,
      sourceName,
      sourceConfig: sourceConfig || {},
      embeddingTable,
      retrievalConfig: finalRetrievalConfig,
    }).returning();

    return NextResponse.json({
      id: source.id,
      agentId,
      sourceType: source.sourceType,
      sourceName: source.sourceName,
      sourceConfig: source.sourceConfig,
      embeddingTable: source.embeddingTable,
      retrievalConfig: source.retrievalConfig,
      createdAt: source.createdAt,
    });
  } catch (error) {
    console.error('Failed to add agent data source:', error);
    return NextResponse.json(
      { error: 'Failed to add agent data source' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/[id]/data-sources
 * 
 * Update an agent data source's retrieval configuration
 * 
 * Request body:
 * - dataSourceId: string (required)
 * - retrievalConfig: object (optional)
 * - sourceConfig: object (optional)
 * - embeddingTable: string (optional)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body = await request.json();
    const { dataSourceId, retrievalConfig, sourceConfig, embeddingTable } = body;

    if (!dataSourceId) {
      return NextResponse.json(
        { error: 'dataSourceId is required' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    
    if (retrievalConfig !== undefined) {
      // Validate retrieval config
      if (retrievalConfig.searchBackend && 
          !['postgres', 'azure', 'both'].includes(retrievalConfig.searchBackend)) {
        return NextResponse.json(
          { error: 'searchBackend must be one of: postgres, azure, both' },
          { status: 400 }
        );
      }
      if (retrievalConfig.searchMode && 
          !['semantic', 'hybrid', 'keyword'].includes(retrievalConfig.searchMode)) {
        return NextResponse.json(
          { error: 'searchMode must be one of: semantic, hybrid, keyword' },
          { status: 400 }
        );
      }
      updateData.retrievalConfig = {
        ...DEFAULT_RETRIEVAL_CONFIG,
        ...retrievalConfig,
      };
    }
    
    if (sourceConfig !== undefined) {
      updateData.sourceConfig = sourceConfig;
    }
    
    if (embeddingTable !== undefined) {
      updateData.embeddingTable = embeddingTable;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update
    const [updated] = await db.update(agentDataSources)
      .set(updateData)
      .where(
        and(
          eq(agentDataSources.id, dataSourceId),
          eq(agentDataSources.agentId, agentId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Data source not found or does not belong to this agent' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updated.id,
      agentId: updated.agentId,
      sourceType: updated.sourceType,
      sourceName: updated.sourceName,
      sourceConfig: updated.sourceConfig,
      embeddingTable: updated.embeddingTable,
      retrievalConfig: updated.retrievalConfig,
    });
  } catch (error) {
    console.error('Failed to update agent data source:', error);
    return NextResponse.json(
      { error: 'Failed to update agent data source' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]/data-sources
 * 
 * Remove a data source from an agent
 * 
 * Query params:
 * - dataSourceId: string (required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const { searchParams } = new URL(request.url);
    const dataSourceId = searchParams.get('dataSourceId');

    if (!dataSourceId) {
      return NextResponse.json(
        { error: 'dataSourceId query parameter is required' },
        { status: 400 }
      );
    }

    // Delete
    await db.delete(agentDataSources)
      .where(
        and(
          eq(agentDataSources.id, dataSourceId),
          eq(agentDataSources.agentId, agentId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete agent data source:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent data source' },
      { status: 500 }
    );
  }
}
