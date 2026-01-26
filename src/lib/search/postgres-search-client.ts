/**
 * PostgreSQL Search Client
 * 
 * Wrapper for PostgreSQL with pgvector for vector search and full-text search.
 * Supports semantic search, hybrid search (vector + full-text), and keyword search.
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type {
  SearchBackend,
  SearchResult,
  SearchParams,
  SearchDocument,
  BatchResult,
  IndexSchema,
  RRFConfig,
  DEFAULT_RRF_CONFIG,
} from './types';

// Default embedding dimensions
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

/**
 * PostgreSQL Search Client using pgvector
 */
export class PostgresSearchClient implements SearchBackend {
  private embeddingDimensions: number;
  
  constructor(embeddingDimensions: number = DEFAULT_EMBEDDING_DIMENSIONS) {
    this.embeddingDimensions = embeddingDimensions;
  }
  
  /**
   * Check if a table (index) exists
   */
  async indexExists(indexName: string): Promise<boolean> {
    try {
      const result = await db.execute(sql.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${this.sanitizeIdentifier(indexName)}'
        )
      `));
      return (result.rows[0] as { exists: boolean })?.exists ?? false;
    } catch {
      return false;
    }
  }
  
  /**
   * Create a new vector search table
   */
  async createIndex(schema: IndexSchema): Promise<void> {
    const tableName = this.sanitizeIdentifier(schema.name);
    const dimensions = schema.vectorConfig?.dimensions || this.embeddingDimensions;
    
    // Build column definitions
    const columns: string[] = [
      'id UUID PRIMARY KEY DEFAULT uuid_generate_v4()',
      'content TEXT NOT NULL',
      `embedding VECTOR(${dimensions})`,
      'metadata JSONB DEFAULT \'{}\'',
      // Add text search vector column for hybrid search
      'text_search TSVECTOR',
      'created_at TIMESTAMPTZ DEFAULT NOW()',
    ];
    
    // Add custom fields
    for (const field of schema.fields) {
      if (['id', 'content', 'embedding', 'metadata', 'text_search', 'created_at'].includes(field.name)) {
        continue;  // Skip built-in fields
      }
      
      const pgType = this.getPgType(field.type);
      columns.push(`${this.sanitizeIdentifier(field.name)} ${pgType}`);
    }
    
    // Create table
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns.join(',\n        ')}
      )
    `));
    
    // Create vector index (IVFFlat for approximate nearest neighbor)
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_embedding 
      ON ${tableName} 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100)
    `));
    
    // Create text search index
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_text_search 
      ON ${tableName} 
      USING GIN(text_search)
    `));
    
    // Create trigger to auto-update text_search column
    await db.execute(sql.raw(`
      CREATE OR REPLACE FUNCTION ${tableName}_update_text_search()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.text_search := to_tsvector('english', COALESCE(NEW.content, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS ${tableName}_text_search_trigger ON ${tableName};
      
      CREATE TRIGGER ${tableName}_text_search_trigger
      BEFORE INSERT OR UPDATE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION ${tableName}_update_text_search();
    `));
  }
  
  /**
   * Delete a table (index)
   */
  async deleteIndex(indexName: string): Promise<void> {
    const tableName = this.sanitizeIdentifier(indexName);
    await db.execute(sql.raw(`DROP TABLE IF EXISTS ${tableName} CASCADE`));
  }
  
  /**
   * Upload documents to a table
   */
  async uploadDocuments(indexName: string, documents: SearchDocument[]): Promise<BatchResult> {
    const tableName = this.sanitizeIdentifier(indexName);
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];
    
    const batchSize = 100;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      for (const doc of batch) {
        try {
          const embeddingStr = doc.embedding 
            ? `'[${doc.embedding.join(',')}]'::vector` 
            : 'NULL';
          
          const metadataStr = doc.metadata 
            ? `'${JSON.stringify(doc.metadata).replace(/'/g, "''")}'::jsonb`
            : "'{}'::jsonb";
          
          await db.execute(sql.raw(`
            INSERT INTO ${tableName} (id, content, embedding, metadata)
            VALUES (
              '${doc.id}'::uuid,
              '${String(doc.content).replace(/'/g, "''")}',
              ${embeddingStr},
              ${metadataStr}
            )
            ON CONFLICT (id) DO UPDATE SET
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              metadata = EXCLUDED.metadata
          `));
          
          succeeded++;
        } catch (error) {
          failed++;
          errors.push({
            id: doc.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
    
    return { succeeded, failed, errors };
  }
  
  /**
   * Delete documents by ID
   */
  async deleteDocuments(indexName: string, documentIds: string[]): Promise<BatchResult> {
    const tableName = this.sanitizeIdentifier(indexName);
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];
    
    for (const id of documentIds) {
      try {
        await db.execute(sql.raw(`DELETE FROM ${tableName} WHERE id = '${id}'::uuid`));
        succeeded++;
      } catch (error) {
        failed++;
        errors.push({
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return { succeeded, failed, errors };
  }
  
  /**
   * Search with flexible parameters
   */
  async search(indexName: string, params: SearchParams): Promise<SearchResult[]> {
    const { query, embedding, limit = 10, mode = 'hybrid' } = params;
    
    if (mode === 'semantic' && embedding) {
      return this.semanticSearch(indexName, embedding, limit);
    }
    
    if (mode === 'hybrid' && embedding) {
      return this.hybridSearch(indexName, query, embedding, limit);
    }
    
    // Keyword search
    return this.keywordSearch(indexName, query, limit);
  }
  
  /**
   * Pure vector/semantic search using pgvector
   */
  async semanticSearch(
    indexName: string, 
    embedding: number[], 
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<SearchResult[]> {
    const tableName = this.sanitizeIdentifier(indexName);
    const embeddingStr = `'[${embedding.join(',')}]'::vector`;
    
    const result = await db.execute(sql.raw(`
      SELECT 
        id::text,
        content,
        metadata,
        1 - (embedding <=> ${embeddingStr}) as similarity
      FROM ${tableName}
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> ${embeddingStr}) > ${threshold}
      ORDER BY embedding <=> ${embeddingStr}
      LIMIT ${limit}
    `));
    
    return (result.rows as Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      similarity: number;
    }>).map(row => ({
      id: row.id,
      content: row.content,
      score: row.similarity,
      metadata: row.metadata || {},
      source: 'postgres' as const,
    }));
  }
  
  /**
   * Hybrid search combining vector and full-text search with RRF
   */
  async hybridSearch(
    indexName: string,
    query: string,
    embedding: number[],
    limit: number = 10,
    rrfConfig: RRFConfig = { k: 60, vectorWeight: 0.6, textWeight: 0.4 }
  ): Promise<SearchResult[]> {
    const tableName = this.sanitizeIdentifier(indexName);
    const embeddingStr = `'[${embedding.join(',')}]'::vector`;
    const tsQuery = this.buildTsQuery(query);
    const { k, vectorWeight, textWeight } = rrfConfig;
    
    // Use RRF to combine vector and text search
    const result = await db.execute(sql.raw(`
      WITH vector_search AS (
        SELECT 
          id,
          content,
          metadata,
          ROW_NUMBER() OVER (ORDER BY embedding <=> ${embeddingStr}) as vector_rank
        FROM ${tableName}
        WHERE embedding IS NOT NULL
        LIMIT ${limit * 2}
      ),
      text_search AS (
        SELECT 
          id,
          content,
          metadata,
          ROW_NUMBER() OVER (ORDER BY ts_rank_cd(text_search, ${tsQuery}) DESC) as text_rank
        FROM ${tableName}
        WHERE text_search @@ ${tsQuery}
        LIMIT ${limit * 2}
      ),
      combined AS (
        SELECT 
          COALESCE(v.id, t.id) as id,
          COALESCE(v.content, t.content) as content,
          COALESCE(v.metadata, t.metadata) as metadata,
          COALESCE(1.0 / (${k} + v.vector_rank), 0) * ${vectorWeight} +
          COALESCE(1.0 / (${k} + t.text_rank), 0) * ${textWeight} as rrf_score
        FROM vector_search v
        FULL OUTER JOIN text_search t ON v.id = t.id
      )
      SELECT 
        id::text,
        content,
        metadata,
        rrf_score as score
      FROM combined
      ORDER BY rrf_score DESC
      LIMIT ${limit}
    `));
    
    return (result.rows as Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: number;
    }>).map(row => ({
      id: row.id,
      content: row.content,
      score: row.score,
      metadata: row.metadata || {},
      source: 'postgres' as const,
    }));
  }
  
  /**
   * Pure keyword search using PostgreSQL full-text search
   */
  async keywordSearch(
    indexName: string,
    query: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const tableName = this.sanitizeIdentifier(indexName);
    const tsQuery = this.buildTsQuery(query);
    
    const result = await db.execute(sql.raw(`
      SELECT 
        id::text,
        content,
        metadata,
        ts_rank_cd(text_search, ${tsQuery}) as score
      FROM ${tableName}
      WHERE text_search @@ ${tsQuery}
      ORDER BY score DESC
      LIMIT ${limit}
    `));
    
    return (result.rows as Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: number;
    }>).map(row => ({
      id: row.id,
      content: row.content,
      score: row.score,
      metadata: row.metadata || {},
      source: 'postgres' as const,
    }));
  }
  
  /**
   * Search existing document_chunks table (for backward compatibility)
   */
  async searchDocumentChunks(
    embedding: number[],
    limit: number = 10,
    agentId?: string,
    threshold: number = 0.5
  ): Promise<SearchResult[]> {
    const embeddingStr = `'[${embedding.join(',')}]'::vector`;
    
    let whereClause = 'embedding IS NOT NULL';
    if (agentId) {
      whereClause += ` AND agent_id = '${agentId}'::uuid`;
    }
    whereClause += ` AND 1 - (embedding <=> ${embeddingStr}) > ${threshold}`;
    
    const result = await db.execute(sql.raw(`
      SELECT 
        id::text,
        content,
        metadata,
        chunk_index,
        file_id::text as document_id,
        1 - (embedding <=> ${embeddingStr}) as similarity
      FROM document_chunks
      WHERE ${whereClause}
      ORDER BY embedding <=> ${embeddingStr}
      LIMIT ${limit}
    `));
    
    return (result.rows as Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      chunk_index: number;
      document_id: string;
      similarity: number;
    }>).map(row => ({
      id: row.id,
      content: row.content,
      score: row.similarity,
      metadata: row.metadata || {},
      source: 'postgres' as const,
      chunkIndex: row.chunk_index,
      documentId: row.document_id,
    }));
  }
  
  /**
   * Build PostgreSQL tsquery from natural language query
   */
  private buildTsQuery(query: string): string {
    // Escape single quotes and build plainto_tsquery
    const escaped = query.replace(/'/g, "''");
    return `plainto_tsquery('english', '${escaped}')`;
  }
  
  /**
   * Sanitize identifier (table/column name) to prevent SQL injection
   */
  private sanitizeIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }
  
  /**
   * Get PostgreSQL type from our field type
   */
  private getPgType(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'TEXT',
      'int32': 'INTEGER',
      'int64': 'BIGINT',
      'double': 'DOUBLE PRECISION',
      'boolean': 'BOOLEAN',
      'datetime': 'TIMESTAMPTZ',
      'collection': 'TEXT[]',
      'vector': `VECTOR(${this.embeddingDimensions})`,
    };
    return typeMap[type] || 'TEXT';
  }
}

// Export singleton for convenience
let defaultClient: PostgresSearchClient | null = null;

export function getPostgresSearchClient(): PostgresSearchClient {
  if (!defaultClient) {
    defaultClient = new PostgresSearchClient();
  }
  return defaultClient;
}

export default PostgresSearchClient;
