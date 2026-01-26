/**
 * Knowledge Graph Types
 */

// Node types for the knowledge graph
export type KGNodeType = 
  | 'customer'
  | 'employee'
  | 'product'
  | 'category'
  | 'supplier'
  | 'order'
  | 'opportunity'
  | 'ticket'
  | 'department'
  | 'transaction'
  | 'company'
  | 'market'
  | 'region'
  // Public data node types
  | 'public_company'
  | 'industry'
  | 'economic_indicator';

// Edge/relationship types
export type KGEdgeType =
  | 'PURCHASED'
  | 'SOLD_BY'
  | 'WORKS_FOR'
  | 'MANAGES'
  | 'REPORTS_TO'
  | 'BELONGS_TO'
  | 'SUPPLIES'
  | 'CONTAINS'
  | 'HAS_OPPORTUNITY'
  | 'HAS_TICKET'
  | 'SUBMITTED_BY'
  | 'PROCESSED_BY'
  | 'RELATED_TO'
  | 'LOCATED_IN'
  | 'PART_OF'
  // Public data relationship types
  | 'OPERATES_IN'
  | 'COMPETES_WITH'
  | 'AFFECTED_BY'
  | 'MEASURED_BY';

// Knowledge graph node
export interface KGNode {
  id: string;
  type: KGNodeType | string;
  name: string;
  properties: Record<string, unknown>;
  embedding?: number[];
  importanceScore: number;
  sourceTable: string;
  sourceId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Knowledge graph edge
export interface KGEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: KGEdgeType | string;
  weight: number;
  confidence: number;
  properties: Record<string, unknown>;
  createdAt: Date;
}

// Node extraction configuration
export interface NodeExtractionConfig {
  sourceTable: string;
  nodeType: string;
  nameColumn: string;
  idColumn: string;
  propertyColumns: string[];
  filter?: string; // SQL WHERE clause
}

// Edge extraction configuration
export interface EdgeExtractionConfig {
  name: string;
  relationshipType: string;
  sourceNodeType: string;
  targetNodeType: string;
  // Either FK-based or rule-based
  foreignKey?: {
    table: string;
    sourceColumn: string;
    targetColumn: string;
  };
  rule?: {
    query: string; // SQL query that returns source_id, target_id pairs
  };
  weight?: number;
  confidence?: number;
}

// Graph traversal result
export interface TraversalResult {
  startNode: KGNode;
  paths: TraversalPath[];
  relatedNodes: KGNode[];
  totalHops: number;
}

export interface TraversalPath {
  nodes: KGNode[];
  edges: KGEdge[];
  totalWeight: number;
}

// Graph statistics
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  avgConnections: number;
}

// Graph expansion result for RAG
export interface GraphExpansionResult {
  originalQuery: string;
  matchedNodes: KGNode[];
  expandedNodes: KGNode[];
  paths: TraversalPath[];
  context: string;
}
