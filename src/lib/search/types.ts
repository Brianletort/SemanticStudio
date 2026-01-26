/**
 * Search Types
 * 
 * Shared types for search backends (PostgreSQL pgvector, Azure Cognitive Search)
 */

// Search result from any backend
export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  source: 'postgres' | 'azure';
  // Optional fields for additional context
  chunkIndex?: number;
  documentId?: string;
  title?: string;
}

// Search query parameters
export interface SearchParams {
  query: string;
  embedding?: number[];
  limit?: number;
  offset?: number;
  filters?: SearchFilter[];
  mode?: 'semantic' | 'hybrid' | 'keyword';
}

// Search filter
export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: unknown;
}

// Index schema for creating new indexes
export interface IndexSchema {
  name: string;
  fields: IndexField[];
  vectorConfig?: VectorFieldConfig;
  semanticConfig?: SemanticConfig;
}

// Index field definition
export interface IndexField {
  name: string;
  type: 'string' | 'int32' | 'int64' | 'double' | 'boolean' | 'datetime' | 'collection' | 'vector';
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  key?: boolean;
  // For vector fields
  dimensions?: number;
  vectorSearchProfile?: string;
}

// Vector field configuration
export interface VectorFieldConfig {
  fieldName: string;
  dimensions: number;
  algorithm: 'hnsw' | 'exhaustive-knn';
  metric: 'cosine' | 'euclidean' | 'dotProduct';
}

// Semantic configuration (for Azure)
export interface SemanticConfig {
  name: string;
  prioritizedFields: {
    titleField?: string;
    contentFields: string[];
    keywordFields?: string[];
  };
}

// Document for indexing
export interface SearchDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Batch operation result
export interface BatchResult {
  succeeded: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

// Search backend interface
export interface SearchBackend {
  // Index management
  createIndex(schema: IndexSchema): Promise<void>;
  deleteIndex(indexName: string): Promise<void>;
  indexExists(indexName: string): Promise<boolean>;
  
  // Document operations
  uploadDocuments(indexName: string, documents: SearchDocument[]): Promise<BatchResult>;
  deleteDocuments(indexName: string, documentIds: string[]): Promise<BatchResult>;
  
  // Search operations
  search(indexName: string, params: SearchParams): Promise<SearchResult[]>;
  semanticSearch(indexName: string, embedding: number[], limit?: number): Promise<SearchResult[]>;
  hybridSearch(indexName: string, query: string, embedding: number[], limit?: number): Promise<SearchResult[]>;
}

// RRF (Reciprocal Rank Fusion) configuration
export interface RRFConfig {
  k: number;  // Constant for RRF formula (default: 60)
  vectorWeight: number;  // Weight for vector results (default: 0.6)
  textWeight: number;  // Weight for text results (default: 0.4)
}

export const DEFAULT_RRF_CONFIG: RRFConfig = {
  k: 60,
  vectorWeight: 0.6,
  textWeight: 0.4,
};

// Merge results from multiple backends using RRF
export function mergeResultsWithRRF(
  resultSets: SearchResult[][],
  config: RRFConfig = DEFAULT_RRF_CONFIG
): SearchResult[] {
  const scoreMap = new Map<string, { result: SearchResult; score: number }>();
  
  for (const results of resultSets) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank];
      const rrfScore = 1 / (config.k + rank + 1);
      
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(result.id, { result, score: rrfScore });
      }
    }
  }
  
  // Sort by combined RRF score and return
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map(({ result, score }) => ({
      ...result,
      score,  // Replace original score with RRF score
    }));
}
