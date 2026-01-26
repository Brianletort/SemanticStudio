/**
 * GraphRAG-lite
 * 
 * Lightweight relationship-aware retrieval for enhanced RAG.
 * Uses the knowledge graph to expand query context with related entities.
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { extractEntities } from '@/lib/semantic/entity-resolver';
import { traverse, findNodesByName, findNodesByType, getNeighborhood } from './traversal';
import type { KGNode, GraphExpansionResult, TraversalPath } from './types';

/**
 * Extract entities from query and match to knowledge graph nodes
 */
export async function matchQueryToNodes(query: string): Promise<KGNode[]> {
  const matchedNodes: KGNode[] = [];

  // 1. Use semantic entity resolver
  const entities = await extractEntities(query);
  
  for (const resolved of entities) {
    // Find nodes of this entity type
    const nodes = await findNodesByType(resolved.entity.name, 5);
    matchedNodes.push(...nodes);
  }

  // 2. Extract potential entity names from query
  const words = query.split(/\s+/).filter(w => w.length > 3);
  
  for (const word of words) {
    // Skip common words
    if (['what', 'where', 'when', 'which', 'have', 'does', 'many', 'much', 'this', 'that', 'with'].includes(word.toLowerCase())) {
      continue;
    }
    
    const nodes = await findNodesByName(word, 3);
    for (const node of nodes) {
      if (!matchedNodes.some(n => n.id === node.id)) {
        matchedNodes.push(node);
      }
    }
  }

  return matchedNodes;
}

/**
 * Expand query context using knowledge graph relationships
 */
export async function expandQueryWithGraph(
  query: string,
  maxHops: number = 2,
  maxExpandedNodes: number = 20
): Promise<GraphExpansionResult> {
  // Match query to nodes
  const matchedNodes = await matchQueryToNodes(query);
  
  if (matchedNodes.length === 0) {
    return {
      originalQuery: query,
      matchedNodes: [],
      expandedNodes: [],
      paths: [],
      context: '',
    };
  }

  // Traverse from matched nodes
  const expandedNodesMap = new Map<string, KGNode>();
  const allPaths: TraversalPath[] = [];

  for (const node of matchedNodes.slice(0, 5)) {
    try {
      const result = await traverse(node.id, maxHops);
      
      for (const relatedNode of result.relatedNodes) {
        if (!expandedNodesMap.has(relatedNode.id) && expandedNodesMap.size < maxExpandedNodes) {
          expandedNodesMap.set(relatedNode.id, relatedNode);
        }
      }
      
      allPaths.push(...result.paths);
    } catch (error) {
      console.error(`Failed to traverse from node ${node.id}:`, error);
    }
  }

  const expandedNodes = Array.from(expandedNodesMap.values());

  // Build context string from graph data
  const context = buildContextFromGraph(matchedNodes, expandedNodes, allPaths);

  return {
    originalQuery: query,
    matchedNodes,
    expandedNodes,
    paths: allPaths.slice(0, 10), // Limit paths
    context,
  };
}

/**
 * Build a natural language context from graph data
 */
function buildContextFromGraph(
  matchedNodes: KGNode[],
  expandedNodes: KGNode[],
  paths: TraversalPath[]
): string {
  const contextParts: string[] = [];

  // Add matched entities
  if (matchedNodes.length > 0) {
    contextParts.push('**Relevant Entities:**');
    for (const node of matchedNodes.slice(0, 10)) {
      const props = Object.entries(node.properties)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      contextParts.push(`- ${node.type}: "${node.name}"${props ? ` (${props})` : ''}`);
    }
  }

  // Add related entities
  if (expandedNodes.length > 0) {
    contextParts.push('\n**Related Entities:**');
    for (const node of expandedNodes.slice(0, 10)) {
      contextParts.push(`- ${node.type}: "${node.name}"`);
    }
  }

  // Add relationship paths
  if (paths.length > 0) {
    contextParts.push('\n**Relationships:**');
    for (const path of paths.slice(0, 5)) {
      if (path.edges.length > 0) {
        const pathStr = path.nodes.map(n => n.name).join(' → ');
        const relType = path.edges[0]?.relationshipType || 'related';
        contextParts.push(`- ${pathStr} (${relType})`);
      }
    }
  }

  return contextParts.join('\n');
}

/**
 * Get data from source tables for matched nodes
 */
export async function getSourceDataForNodes(nodes: KGNode[]): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];

  // Group nodes by source table
  const nodesByTable = new Map<string, KGNode[]>();
  for (const node of nodes) {
    const existing = nodesByTable.get(node.sourceTable) || [];
    existing.push(node);
    nodesByTable.set(node.sourceTable, existing);
  }

  // Query each source table
  for (const [table, tableNodes] of nodesByTable.entries()) {
    const ids = tableNodes.map(n => `'${n.sourceId}'`).join(',');
    try {
      const result = await db.execute(sql.raw(`
        SELECT * FROM ${table} WHERE id IN (${ids})
      `));
      results.push(...(result.rows as Record<string, unknown>[]));
    } catch (error) {
      console.error(`Failed to get source data from ${table}:`, error);
    }
  }

  return results;
}

/**
 * Get full context including source data
 */
export async function getFullContext(
  query: string,
  options?: {
    maxHops?: number;
    includeSourceData?: boolean;
  }
): Promise<{
  graphContext: GraphExpansionResult;
  sourceData: Record<string, unknown>[];
  combinedContext: string;
}> {
  const graphContext = await expandQueryWithGraph(query, options?.maxHops || 2);
  
  let sourceData: Record<string, unknown>[] = [];
  if (options?.includeSourceData) {
    sourceData = await getSourceDataForNodes([
      ...graphContext.matchedNodes,
      ...graphContext.expandedNodes.slice(0, 10),
    ]);
  }

  // Build combined context
  let combinedContext = graphContext.context;
  
  if (sourceData.length > 0) {
    combinedContext += '\n\n**Source Data:**\n';
    combinedContext += JSON.stringify(sourceData.slice(0, 5), null, 2);
  }

  return {
    graphContext,
    sourceData,
    combinedContext,
  };
}

export default {
  matchQueryToNodes,
  expandQueryWithGraph,
  getSourceDataForNodes,
  getFullContext,
  buildContextFromGraph,
};
