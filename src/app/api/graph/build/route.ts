import { NextResponse } from 'next/server';
import { ETLOrchestrator } from '@/lib/etl';
// Import agents to register them
import '@/lib/etl/agents';
import { KnowledgeGraphPipeline } from '@/lib/graph/kg-pipeline';

// POST /api/graph/build - Build/rebuild the knowledge graph using PAR loop
export async function POST() {
  try {
    // Create a KG build job and execute it
    const jobDefinition = {
      jobType: 'kg_build' as const,
      name: 'Knowledge Graph Build',
      sourceConfig: { type: 'database' as const },
      targetConfig: { table: 'knowledge_graph_nodes', mode: 'replace' as const },
    };

    const result = await ETLOrchestrator.executeJobDirect(jobDefinition);

    // Get the final stats
    const pipeline = new KnowledgeGraphPipeline({ generateEmbeddings: false });
    const stats = await pipeline.getStats();

    return NextResponse.json({
      message: 'Knowledge graph built successfully',
      stats,
      parIterations: result.parIterations,
      improvements: result.reflexionImprovements,
    });
  } catch (error) {
    console.error('Failed to build knowledge graph:', error);
    return NextResponse.json({ 
      error: 'Failed to build knowledge graph',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
