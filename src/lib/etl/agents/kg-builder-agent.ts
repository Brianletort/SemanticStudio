/**
 * Knowledge Graph Builder Agent
 * 
 * ETL agent that builds/rebuilds the knowledge graph with PAR loop validation.
 */

import { BaseETLAgent } from '../base-agent';
import { registerAgent } from '../orchestrator';
import { KnowledgeGraphPipeline } from '@/lib/graph/kg-pipeline';
import type {
  ETLJobDefinition,
  PARPerception,
  PARAction,
  PARReflection,
  ETLError,
} from '../types';
import type { GraphStats } from '@/lib/graph/types';

interface KGPerception {
  currentStats: GraphStats | null;
  expectedNodeTypes: string[];
  expectedEdgeTypes: string[];
}

export class KGBuilderAgent extends BaseETLAgent {
  private pipeline: KnowledgeGraphPipeline;

  constructor(jobDefinition: ETLJobDefinition) {
    super(jobDefinition);
    this.pipeline = new KnowledgeGraphPipeline({ 
      generateEmbeddings: false // Embeddings can be slow, skip for now
    });
  }

  /**
   * PERCEIVE: Check current graph state and expected entities
   */
  async perceive(): Promise<PARPerception<KGPerception>> {
    let currentStats: GraphStats | null = null;
    
    try {
      currentStats = await this.pipeline.getStats();
    } catch {
      // Graph might not exist yet
    }

    // Expected node types based on our sample data
    const expectedNodeTypes = [
      'customer',
      'employee', 
      'product',
      'nw_product',
      'category',
      'supplier',
      'opportunity',
      'ticket',
      'order',
    ];

    // Expected edge types based on our relationships
    const expectedEdgeTypes = [
      'HAS_OPPORTUNITY',
      'HAS_TICKET',
      'PLACED_ORDER',
      'PROCESSED',
      'BELONGS_TO',
      'SUPPLIED_BY',
      'REPORTS_TO',
    ];

    return {
      data: {
        currentStats,
        expectedNodeTypes,
        expectedEdgeTypes,
      },
      context: {
        rebuildRequired: !currentStats || currentStats.totalNodes === 0,
      },
      iteration: 0,
    };
  }

  /**
   * ACT: Build the knowledge graph
   */
  async act(perception: PARPerception<KGPerception>): Promise<PARAction> {
    const startTime = Date.now();
    const errors: ETLError[] = [];
    let stats: GraphStats;

    try {
      // Clear and rebuild the graph
      await this.pipeline.clear();
      stats = await this.pipeline.build();
    } catch (error) {
      errors.push({
        code: 'KG_BUILD_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Try to get whatever stats we can
      try {
        stats = await this.pipeline.getStats();
      } catch {
        stats = {
          totalNodes: 0,
          totalEdges: 0,
          nodesByType: {},
          edgesByType: {},
          avgConnections: 0,
        };
      }
    }

    return {
      result: {
        stats,
      },
      metrics: {
        recordsProcessed: stats.totalNodes + stats.totalEdges,
        recordsFailed: errors.length,
        duration: Date.now() - startTime,
      },
      errors,
    };
  }

  /**
   * REFLECT: Validate graph completeness and quality
   */
  async reflect(action: PARAction, perception: PARPerception<KGPerception>): Promise<PARReflection> {
    const { expectedNodeTypes, expectedEdgeTypes } = perception.data as KGPerception;
    const result = action.result as { stats?: GraphStats } | undefined;
    const stats = result?.stats;
    const improvements: string[] = [];
    
    if (!stats) {
      return {
        success: false,
        retry: perception.iteration < 2,
        confidence: 0,
        improvements: ['Failed to get graph statistics'],
      };
    }

    // Check node coverage
    const actualNodeTypes = Object.keys(stats.nodesByType);
    const missingNodeTypes = expectedNodeTypes.filter(t => !actualNodeTypes.includes(t));
    
    if (missingNodeTypes.length > 0) {
      improvements.push(`Missing node types: ${missingNodeTypes.join(', ')}`);
    }

    // Check edge coverage
    const actualEdgeTypes = Object.keys(stats.edgesByType);
    const missingEdgeTypes = expectedEdgeTypes.filter(t => !actualEdgeTypes.includes(t));
    
    if (missingEdgeTypes.length > 0) {
      improvements.push(`Missing edge types: ${missingEdgeTypes.join(', ')}`);
    }

    // Calculate connectivity ratio
    const connectivityRatio = stats.totalEdges / Math.max(stats.totalNodes, 1);
    if (connectivityRatio < 0.3) {
      improvements.push(`Low connectivity ratio: ${connectivityRatio.toFixed(2)} edges per node`);
    }

    // Determine success
    const nodeTypeCoverage = (expectedNodeTypes.length - missingNodeTypes.length) / expectedNodeTypes.length;
    const edgeTypeCoverage = (expectedEdgeTypes.length - missingEdgeTypes.length) / expectedEdgeTypes.length;
    const overallScore = (nodeTypeCoverage + edgeTypeCoverage + Math.min(connectivityRatio, 1)) / 3;

    const success = overallScore >= 0.7 && action.errors.length === 0;

    // Generate lessons learned
    let lessonsLearned: string | undefined;
    if (success) {
      lessonsLearned = `Successfully built KG with ${stats.totalNodes} nodes, ${stats.totalEdges} edges, ${actualEdgeTypes.length} relationship types`;
    } else {
      lessonsLearned = `KG build incomplete: ${improvements.join('; ')}`;
    }

    return {
      success,
      retry: !success && perception.iteration < 2,
      confidence: overallScore,
      improvements,
      lessonsLearned,
    };
  }
}

// Register the agent
registerAgent('kg_build', KGBuilderAgent);

export default KGBuilderAgent;
