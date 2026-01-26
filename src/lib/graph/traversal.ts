/**
 * Graph Traversal
 * 
 * Multi-hop traversal and path finding in the knowledge graph.
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { KGNode, KGEdge, TraversalResult, TraversalPath } from './types';

/**
 * Get a node by ID
 */
export async function getNode(nodeId: string): Promise<KGNode | null> {
  const result = await db.execute(sql.raw(`
    SELECT * FROM knowledge_graph_nodes WHERE id = '${nodeId}'
  `));
  
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    type: row.type as string,
    name: row.name as string,
    properties: row.properties as Record<string, unknown>,
    importanceScore: parseFloat(row.importance_score as string),
    sourceTable: row.source_table as string,
    sourceId: row.source_id as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Find nodes by name (partial match)
 */
export async function findNodesByName(name: string, limit: number = 10): Promise<KGNode[]> {
  const result = await db.execute(sql.raw(`
    SELECT * FROM knowledge_graph_nodes 
    WHERE LOWER(name) LIKE LOWER('%${name.replace(/'/g, "''")}%')
    ORDER BY importance_score DESC
    LIMIT ${limit}
  `));
  
  return (result.rows as Array<Record<string, unknown>>).map(row => ({
    id: row.id as string,
    type: row.type as string,
    name: row.name as string,
    properties: row.properties as Record<string, unknown>,
    importanceScore: parseFloat(row.importance_score as string),
    sourceTable: row.source_table as string,
    sourceId: row.source_id as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }));
}

/**
 * Find nodes by type
 */
export async function findNodesByType(type: string, limit: number = 100): Promise<KGNode[]> {
  const result = await db.execute(sql.raw(`
    SELECT * FROM knowledge_graph_nodes 
    WHERE type = '${type}'
    ORDER BY importance_score DESC
    LIMIT ${limit}
  `));
  
  return (result.rows as Array<Record<string, unknown>>).map(row => ({
    id: row.id as string,
    type: row.type as string,
    name: row.name as string,
    properties: row.properties as Record<string, unknown>,
    importanceScore: parseFloat(row.importance_score as string),
    sourceTable: row.source_table as string,
    sourceId: row.source_id as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }));
}

/**
 * Get edges from a node
 */
export async function getEdgesFrom(nodeId: string): Promise<KGEdge[]> {
  const result = await db.execute(sql.raw(`
    SELECT * FROM knowledge_graph_edges WHERE source_id = '${nodeId}'
  `));
  
  return (result.rows as Array<Record<string, unknown>>).map(row => ({
    id: row.id as string,
    sourceId: row.source_id as string,
    targetId: row.target_id as string,
    relationshipType: row.relationship_type as string,
    weight: parseFloat(row.weight as string),
    confidence: parseFloat(row.confidence as string),
    properties: row.properties as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
  }));
}

/**
 * Get edges to a node
 */
export async function getEdgesTo(nodeId: string): Promise<KGEdge[]> {
  const result = await db.execute(sql.raw(`
    SELECT * FROM knowledge_graph_edges WHERE target_id = '${nodeId}'
  `));
  
  return (result.rows as Array<Record<string, unknown>>).map(row => ({
    id: row.id as string,
    sourceId: row.source_id as string,
    targetId: row.target_id as string,
    relationshipType: row.relationship_type as string,
    weight: parseFloat(row.weight as string),
    confidence: parseFloat(row.confidence as string),
    properties: row.properties as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
  }));
}

/**
 * Get all edges connected to a node (bidirectional)
 */
export async function getConnectedEdges(nodeId: string): Promise<KGEdge[]> {
  const result = await db.execute(sql.raw(`
    SELECT * FROM knowledge_graph_edges 
    WHERE source_id = '${nodeId}' OR target_id = '${nodeId}'
  `));
  
  return (result.rows as Array<Record<string, unknown>>).map(row => ({
    id: row.id as string,
    sourceId: row.source_id as string,
    targetId: row.target_id as string,
    relationshipType: row.relationship_type as string,
    weight: parseFloat(row.weight as string),
    confidence: parseFloat(row.confidence as string),
    properties: row.properties as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
  }));
}

/**
 * Multi-hop traversal from a starting node
 */
export async function traverse(
  startNodeId: string,
  maxHops: number = 2,
  relationshipTypes?: string[]
): Promise<TraversalResult> {
  const startNode = await getNode(startNodeId);
  if (!startNode) {
    throw new Error(`Node not found: ${startNodeId}`);
  }

  const visited = new Set<string>([startNodeId]);
  const paths: TraversalPath[] = [];
  const relatedNodes: KGNode[] = [];

  // BFS traversal
  interface QueueItem {
    nodeId: string;
    path: { nodes: KGNode[]; edges: KGEdge[] };
    depth: number;
  }

  const queue: QueueItem[] = [{
    nodeId: startNodeId,
    path: { nodes: [startNode], edges: [] },
    depth: 0,
  }];

  while (queue.length > 0) {
    const { nodeId, path, depth } = queue.shift()!;

    if (depth >= maxHops) continue;

    // Get connected edges
    let edges = await getConnectedEdges(nodeId);

    // Filter by relationship type if specified
    if (relationshipTypes && relationshipTypes.length > 0) {
      edges = edges.filter(e => relationshipTypes.includes(e.relationshipType));
    }

    for (const edge of edges) {
      const nextNodeId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;

      if (visited.has(nextNodeId)) continue;
      visited.add(nextNodeId);

      const nextNode = await getNode(nextNodeId);
      if (!nextNode) continue;

      relatedNodes.push(nextNode);

      const newPath: TraversalPath = {
        nodes: [...path.nodes, nextNode],
        edges: [...path.edges, edge],
        totalWeight: path.edges.reduce((sum, e) => sum + e.weight, 0) + edge.weight,
      };

      paths.push(newPath);

      queue.push({
        nodeId: nextNodeId,
        path: newPath,
        depth: depth + 1,
      });
    }
  }

  return {
    startNode,
    paths,
    relatedNodes,
    totalHops: maxHops,
  };
}

/**
 * Find shortest path between two nodes
 */
export async function findShortestPath(
  fromNodeId: string,
  toNodeId: string,
  maxHops: number = 5
): Promise<TraversalPath | null> {
  const startNode = await getNode(fromNodeId);
  const endNode = await getNode(toNodeId);
  
  if (!startNode || !endNode) return null;

  const visited = new Set<string>([fromNodeId]);
  
  interface QueueItem {
    nodeId: string;
    path: TraversalPath;
  }

  const queue: QueueItem[] = [{
    nodeId: fromNodeId,
    path: { nodes: [startNode], edges: [], totalWeight: 0 },
  }];

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;

    if (nodeId === toNodeId) {
      return path;
    }

    if (path.nodes.length > maxHops) continue;

    const edges = await getConnectedEdges(nodeId);

    for (const edge of edges) {
      const nextNodeId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;

      if (visited.has(nextNodeId)) continue;
      visited.add(nextNodeId);

      const nextNode = await getNode(nextNodeId);
      if (!nextNode) continue;

      queue.push({
        nodeId: nextNodeId,
        path: {
          nodes: [...path.nodes, nextNode],
          edges: [...path.edges, edge],
          totalWeight: path.totalWeight + edge.weight,
        },
      });
    }
  }

  return null;
}

/**
 * Get neighborhood subgraph around a node
 */
export async function getNeighborhood(
  nodeId: string,
  depth: number = 1
): Promise<{ nodes: KGNode[]; edges: KGEdge[] }> {
  const result = await traverse(nodeId, depth);
  
  // Collect all unique edges
  const edgeSet = new Set<string>();
  const edges: KGEdge[] = [];
  
  for (const path of result.paths) {
    for (const edge of path.edges) {
      if (!edgeSet.has(edge.id)) {
        edgeSet.add(edge.id);
        edges.push(edge);
      }
    }
  }

  return {
    nodes: [result.startNode, ...result.relatedNodes],
    edges,
  };
}

export default {
  getNode,
  findNodesByName,
  findNodesByType,
  getEdgesFrom,
  getEdgesTo,
  getConnectedEdges,
  traverse,
  findShortestPath,
  getNeighborhood,
};
