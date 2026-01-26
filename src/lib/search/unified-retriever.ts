/**
 * Unified Retriever
 * 
 * Routes search queries to the appropriate backend(s) based on agent configuration.
 * Supports PostgreSQL pgvector, Azure Cognitive Search, and SQL queries.
 * Merges results from multiple backends using Reciprocal Rank Fusion (RRF).
 */

import { db } from '@/lib/db';
import { agentDataSources, dataSources } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getEmbedding } from '@/lib/memory/embeddings';
import { PostgresSearchClient, getPostgresSearchClient } from './postgres-search-client';
import { AzureSearchClient, isAzureSearchConfigured, getAzureSearchClient } from './azure-search-client';
import { mergeResultsWithRRF, type SearchResult, type RRFConfig, DEFAULT_RRF_CONFIG } from './types';
import type { RetrievalConfig, DEFAULT_RETRIEVAL_CONFIG } from '@/lib/etl/types';

// Agent data source configuration
export interface AgentDataSourceConfig {
  id: string;
  agentId: string;
  sourceType: string;
  sourceName: string;
  sourceConfig: Record<string, unknown>;
  embeddingTable?: string | null;
  retrievalConfig: RetrievalConfig;
}

// Unified search parameters
export interface UnifiedSearchParams {
  query: string;
  agentId?: string;
  dataSourceId?: string;
  mode?: 'semantic' | 'hybrid' | 'keyword';
  limit?: number;
  filters?: Record<string, unknown>;
}

// SQL query parameters
export interface SQLQueryParams {
  query: string;
  agentId?: string;
  dataSourceId?: string;
}

// SQL query result
export interface SQLQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: string[];
}

/**
 * Unified Retriever class
 * 
 * Provides a single interface for searching across multiple backends
 * based on agent configuration.
 */
export class UnifiedRetriever {
  private postgresClient: PostgresSearchClient;
  private azureClient: AzureSearchClient | null = null;
  private agentConfig: AgentDataSourceConfig | null = null;
  
  constructor(agentConfig?: AgentDataSourceConfig) {
    this.postgresClient = getPostgresSearchClient();
    this.agentConfig = agentConfig || null;
    
    // Initialize Azure client if configured
    if (isAzureSearchConfigured()) {
      try {
        this.azureClient = getAzureSearchClient();
      } catch (error) {
        console.warn('[UnifiedRetriever] Azure Search not available:', error);
      }
    }
  }
  
  /**
   * Load agent configuration from database
   */
  async loadAgentConfig(agentId: string, dataSourceId?: string): Promise<AgentDataSourceConfig | null> {
    try {
      const conditions = dataSourceId 
        ? [eq(agentDataSources.agentId, agentId), eq(agentDataSources.id, dataSourceId)]
        : [eq(agentDataSources.agentId, agentId)];
      
      const results = await db.select()
        .from(agentDataSources)
        .where(conditions.length > 1 ? sql`${conditions[0]} AND ${conditions[1]}` : conditions[0])
        .limit(1);
      
      if (results.length === 0) {
        return null;
      }
      
      const source = results[0];
      this.agentConfig = {
        id: source.id,
        agentId: source.agentId || '',
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        sourceConfig: (source.sourceConfig || {}) as Record<string, unknown>,
        embeddingTable: source.embeddingTable,
        retrievalConfig: (source.retrievalConfig || {
          enableSqlQueries: true,
          enableSemanticSearch: true,
          searchBackend: 'postgres',
          searchMode: 'hybrid',
          azureIndexName: null,
          maxResults: 10,
          similarityThreshold: 0.7,
        }) as RetrievalConfig,
      };
      
      return this.agentConfig;
    } catch (error) {
      console.error('[UnifiedRetriever] Failed to load agent config:', error);
      return null;
    }
  }
  
  /**
   * Get all data sources for an agent
   */
  async getAgentDataSources(agentId: string): Promise<AgentDataSourceConfig[]> {
    try {
      const results = await db.select()
        .from(agentDataSources)
        .where(eq(agentDataSources.agentId, agentId));
      
      return results.map(source => ({
        id: source.id,
        agentId: source.agentId || '',
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        sourceConfig: (source.sourceConfig || {}) as Record<string, unknown>,
        embeddingTable: source.embeddingTable,
        retrievalConfig: (source.retrievalConfig || {
          enableSqlQueries: true,
          enableSemanticSearch: true,
          searchBackend: 'postgres',
          searchMode: 'hybrid',
          azureIndexName: null,
          maxResults: 10,
          similarityThreshold: 0.7,
        }) as RetrievalConfig,
      }));
    } catch (error) {
      console.error('[UnifiedRetriever] Failed to get agent data sources:', error);
      return [];
    }
  }
  
  /**
   * Perform semantic/hybrid search across configured backends
   */
  async search(params: UnifiedSearchParams): Promise<SearchResult[]> {
    const { query, agentId, dataSourceId, mode, limit = 10, filters } = params;
    
    // Load agent config if not already set
    if (!this.agentConfig && agentId) {
      await this.loadAgentConfig(agentId, dataSourceId);
    }
    
    // Use default config if none available
    const config = this.agentConfig?.retrievalConfig || {
      enableSqlQueries: true,
      enableSemanticSearch: true,
      searchBackend: 'postgres' as const,
      searchMode: 'hybrid' as const,
      azureIndexName: null,
      maxResults: 10,
      similarityThreshold: 0.7,
    };
    
    // Check if semantic search is enabled
    if (!config.enableSemanticSearch) {
      console.log('[UnifiedRetriever] Semantic search not enabled for this agent');
      return [];
    }
    
    const searchMode = mode || config.searchMode || 'hybrid';
    const maxResults = limit || config.maxResults || 10;
    
    // Generate query embedding for vector search
    let embedding: number[] | undefined;
    if (searchMode === 'semantic' || searchMode === 'hybrid') {
      try {
        embedding = await getEmbedding(query);
      } catch (error) {
        console.error('[UnifiedRetriever] Failed to generate embedding:', error);
        // Fall back to keyword search if embedding fails
        return this.searchKeyword(query, maxResults);
      }
    }
    
    // Determine which backends to query
    const searchBackend = config.searchBackend || 'postgres';
    const resultSets: SearchResult[][] = [];
    
    // Query PostgreSQL
    if (searchBackend === 'postgres' || searchBackend === 'both') {
      const pgResults = await this.searchPostgres(query, embedding, searchMode, maxResults);
      resultSets.push(pgResults);
    }
    
    // Query Azure
    if ((searchBackend === 'azure' || searchBackend === 'both') && this.azureClient) {
      const azureResults = await this.searchAzure(
        query, 
        embedding, 
        config.azureIndexName || undefined, 
        searchMode, 
        maxResults
      );
      resultSets.push(azureResults);
    }
    
    // Merge results if querying multiple backends
    if (resultSets.length > 1) {
      return mergeResultsWithRRF(resultSets, DEFAULT_RRF_CONFIG).slice(0, maxResults);
    }
    
    return resultSets[0] || [];
  }
  
  /**
   * Search PostgreSQL pgvector
   */
  private async searchPostgres(
    query: string,
    embedding: number[] | undefined,
    mode: 'semantic' | 'hybrid' | 'keyword',
    limit: number
  ): Promise<SearchResult[]> {
    const tableName = this.agentConfig?.embeddingTable || 'document_chunks';
    
    try {
      if (mode === 'semantic' && embedding) {
        return this.postgresClient.semanticSearch(tableName, embedding, limit);
      }
      
      if (mode === 'hybrid' && embedding) {
        return this.postgresClient.hybridSearch(tableName, query, embedding, limit);
      }
      
      // Keyword search
      return this.postgresClient.keywordSearch(tableName, query, limit);
    } catch (error) {
      console.error('[UnifiedRetriever] PostgreSQL search failed:', error);
      return [];
    }
  }
  
  /**
   * Search Azure Cognitive Search
   */
  private async searchAzure(
    query: string,
    embedding: number[] | undefined,
    indexName: string | undefined,
    mode: 'semantic' | 'hybrid' | 'keyword',
    limit: number
  ): Promise<SearchResult[]> {
    if (!this.azureClient || !indexName) {
      return [];
    }
    
    try {
      if (mode === 'semantic' && embedding) {
        return this.azureClient.semanticSearch(indexName, embedding, limit);
      }
      
      if (mode === 'hybrid' && embedding) {
        return this.azureClient.hybridSearch(indexName, query, embedding, limit);
      }
      
      // Keyword search
      return this.azureClient.keywordSearch(indexName, query, limit);
    } catch (error) {
      console.error('[UnifiedRetriever] Azure search failed:', error);
      return [];
    }
  }
  
  /**
   * Keyword-only search (fallback)
   */
  private async searchKeyword(query: string, limit: number): Promise<SearchResult[]> {
    const tableName = this.agentConfig?.embeddingTable || 'document_chunks';
    return this.postgresClient.keywordSearch(tableName, query, limit);
  }
  
  /**
   * Execute SQL query against allowed tables
   */
  async queryStructuredData(params: SQLQueryParams): Promise<SQLQueryResult> {
    const { query, agentId, dataSourceId } = params;
    
    // Load agent config if needed
    if (!this.agentConfig && agentId) {
      await this.loadAgentConfig(agentId, dataSourceId);
    }
    
    const config = this.agentConfig?.retrievalConfig;
    
    // Check if SQL queries are enabled
    if (config && !config.enableSqlQueries) {
      throw new Error('SQL queries are not enabled for this agent');
    }
    
    // Get allowed tables from agent configuration
    const allowedTables = await this.getAllowedTables(agentId);
    
    // Validate query against allowed tables
    this.validateQuery(query, allowedTables);
    
    // Execute query
    try {
      const result = await db.execute(sql.raw(query));
      const rows = result.rows as Record<string, unknown>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      
      return {
        rows,
        rowCount: rows.length,
        columns,
      };
    } catch (error) {
      throw new Error(`SQL query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get allowed tables for an agent
   */
  private async getAllowedTables(agentId?: string): Promise<string[]> {
    if (!agentId) {
      return [];  // No restrictions if no agent specified
    }
    
    try {
      // Get data sources for this agent
      const sources = await this.getAgentDataSources(agentId);
      
      // Extract table names from sources
      const tables: string[] = [];
      for (const source of sources) {
        if (source.sourceType === 'table' || source.sourceType === 'view') {
          tables.push(source.sourceName);
        }
        // Also check sourceConfig for table references
        const configTables = (source.sourceConfig?.tables as string[]) || [];
        tables.push(...configTables);
      }
      
      return [...new Set(tables)];  // Remove duplicates
    } catch {
      return [];
    }
  }
  
  /**
   * Validate SQL query against allowed tables
   */
  private validateQuery(query: string, allowedTables: string[]): void {
    // Skip validation if no restrictions
    if (allowedTables.length === 0) {
      return;
    }
    
    // Basic SQL injection prevention
    const lowerQuery = query.toLowerCase();
    const dangerousPatterns = [
      /;\s*drop\s+/i,
      /;\s*delete\s+from\s+/i,
      /;\s*truncate\s+/i,
      /;\s*update\s+.*\s+set\s+/i,
      /;\s*insert\s+into\s+/i,
      /--/,  // SQL comments
      /\/\*/,  // Block comments
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new Error('Potentially dangerous SQL pattern detected');
      }
    }
    
    // Extract table names from query (simplified)
    const tablePattern = /(?:from|join)\s+([a-z_][a-z0-9_]*)/gi;
    const matches = query.matchAll(tablePattern);
    
    for (const match of matches) {
      const tableName = match[1].toLowerCase();
      if (!allowedTables.map(t => t.toLowerCase()).includes(tableName)) {
        throw new Error(`Access denied: Table '${tableName}' is not accessible by this agent`);
      }
    }
  }
  
  /**
   * Search document chunks for an agent (backward compatibility)
   */
  async searchDocumentChunks(
    query: string,
    agentId?: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      const embedding = await getEmbedding(query);
      return this.postgresClient.searchDocumentChunks(embedding, limit, agentId);
    } catch (error) {
      console.error('[UnifiedRetriever] Document chunk search failed:', error);
      return [];
    }
  }
}

// Export singleton factory
let defaultRetriever: UnifiedRetriever | null = null;

export function getUnifiedRetriever(): UnifiedRetriever {
  if (!defaultRetriever) {
    defaultRetriever = new UnifiedRetriever();
  }
  return defaultRetriever;
}

// Factory function to create retriever with agent config
export function createRetrieverForAgent(agentConfig: AgentDataSourceConfig): UnifiedRetriever {
  return new UnifiedRetriever(agentConfig);
}

export default UnifiedRetriever;
