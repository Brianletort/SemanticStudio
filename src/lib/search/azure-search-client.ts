/**
 * Azure Cognitive Search Client
 * 
 * Wrapper around Azure AI Search SDK for index management and search operations.
 * Supports vector search, hybrid search, and semantic search.
 */

import type {
  SearchBackend,
  SearchResult,
  SearchParams,
  SearchDocument,
  BatchResult,
  IndexSchema,
  IndexField,
} from './types';

// Azure Search configuration
export interface AzureSearchConfig {
  endpoint: string;
  apiKey: string;
  apiVersion?: string;
}

// Get Azure Search configuration from environment
export function getAzureSearchConfig(): AzureSearchConfig | null {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const apiKey = process.env.AZURE_SEARCH_API_KEY;
  
  if (!endpoint || !apiKey) {
    return null;
  }
  
  return {
    endpoint,
    apiKey,
    apiVersion: process.env.AZURE_SEARCH_API_VERSION || '2024-07-01',
  };
}

// Check if Azure Search is configured
export function isAzureSearchConfigured(): boolean {
  return getAzureSearchConfig() !== null;
}

/**
 * Azure Cognitive Search Client
 */
export class AzureSearchClient implements SearchBackend {
  private config: AzureSearchConfig;
  
  constructor(config?: AzureSearchConfig) {
    const envConfig = getAzureSearchConfig();
    if (!config && !envConfig) {
      throw new Error('Azure Search configuration required. Set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY environment variables.');
    }
    this.config = config || envConfig!;
  }
  
  /**
   * Make authenticated request to Azure Search API
   */
  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<T> {
    const url = `${this.config.endpoint}${path}?api-version=${this.config.apiVersion}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure Search API error (${response.status}): ${error}`);
    }
    
    // DELETE returns empty body
    if (method === 'DELETE' || response.status === 204) {
      return {} as T;
    }
    
    return response.json();
  }
  
  /**
   * Check if an index exists
   */
  async indexExists(indexName: string): Promise<boolean> {
    try {
      await this.request(`/indexes/${indexName}`);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Create a new search index
   */
  async createIndex(schema: IndexSchema): Promise<void> {
    const azureSchema = this.convertToAzureSchema(schema);
    await this.request(`/indexes/${schema.name}`, 'PUT', azureSchema);
  }
  
  /**
   * Delete an index
   */
  async deleteIndex(indexName: string): Promise<void> {
    await this.request(`/indexes/${indexName}`, 'DELETE');
  }
  
  /**
   * Upload documents to an index
   */
  async uploadDocuments(indexName: string, documents: SearchDocument[]): Promise<BatchResult> {
    const azureDocs = documents.map(doc => ({
      '@search.action': 'mergeOrUpload',
      id: doc.id,
      content: doc.content,
      embedding: doc.embedding,
      ...doc.metadata,
    }));
    
    const batchSize = 1000;  // Azure limit
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];
    
    for (let i = 0; i < azureDocs.length; i += batchSize) {
      const batch = azureDocs.slice(i, i + batchSize);
      
      try {
        const result = await this.request<{
          value: Array<{ key: string; status: boolean; errorMessage?: string }>;
        }>(`/indexes/${indexName}/docs/index`, 'POST', { value: batch });
        
        for (const item of result.value) {
          if (item.status) {
            succeeded++;
          } else {
            failed++;
            errors.push({ id: item.key, error: item.errorMessage || 'Unknown error' });
          }
        }
      } catch (error) {
        failed += batch.length;
        for (const doc of batch) {
          errors.push({ id: doc.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    }
    
    return { succeeded, failed, errors };
  }
  
  /**
   * Delete documents from an index
   */
  async deleteDocuments(indexName: string, documentIds: string[]): Promise<BatchResult> {
    const azureDocs = documentIds.map(id => ({
      '@search.action': 'delete',
      id,
    }));
    
    try {
      const result = await this.request<{
        value: Array<{ key: string; status: boolean; errorMessage?: string }>;
      }>(`/indexes/${indexName}/docs/index`, 'POST', { value: azureDocs });
      
      let succeeded = 0;
      let failed = 0;
      const errors: Array<{ id: string; error: string }> = [];
      
      for (const item of result.value) {
        if (item.status) {
          succeeded++;
        } else {
          failed++;
          errors.push({ id: item.key, error: item.errorMessage || 'Unknown error' });
        }
      }
      
      return { succeeded, failed, errors };
    } catch (error) {
      return {
        succeeded: 0,
        failed: documentIds.length,
        errors: documentIds.map(id => ({
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
      };
    }
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
   * Pure vector/semantic search
   */
  async semanticSearch(indexName: string, embedding: number[], limit: number = 10): Promise<SearchResult[]> {
    const searchBody = {
      count: true,
      top: limit,
      vectorQueries: [{
        kind: 'vector',
        vector: embedding,
        fields: 'embedding',
        k: limit,
      }],
    };
    
    const result = await this.request<{
      value: Array<{
        '@search.score': number;
        id: string;
        content: string;
        [key: string]: unknown;
      }>;
    }>(`/indexes/${indexName}/docs/search`, 'POST', searchBody);
    
    return result.value.map(doc => this.convertToSearchResult(doc));
  }
  
  /**
   * Hybrid search (vector + keyword)
   */
  async hybridSearch(
    indexName: string,
    query: string,
    embedding: number[],
    limit: number = 10
  ): Promise<SearchResult[]> {
    const searchBody = {
      count: true,
      top: limit,
      search: query,
      queryType: 'simple',
      vectorQueries: [{
        kind: 'vector',
        vector: embedding,
        fields: 'embedding',
        k: limit,
      }],
    };
    
    const result = await this.request<{
      value: Array<{
        '@search.score': number;
        id: string;
        content: string;
        [key: string]: unknown;
      }>;
    }>(`/indexes/${indexName}/docs/search`, 'POST', searchBody);
    
    return result.value.map(doc => this.convertToSearchResult(doc));
  }
  
  /**
   * Pure keyword search
   */
  async keywordSearch(indexName: string, query: string, limit: number = 10): Promise<SearchResult[]> {
    const searchBody = {
      count: true,
      top: limit,
      search: query,
      queryType: 'simple',
    };
    
    const result = await this.request<{
      value: Array<{
        '@search.score': number;
        id: string;
        content: string;
        [key: string]: unknown;
      }>;
    }>(`/indexes/${indexName}/docs/search`, 'POST', searchBody);
    
    return result.value.map(doc => this.convertToSearchResult(doc));
  }
  
  /**
   * Convert our schema to Azure format
   */
  private convertToAzureSchema(schema: IndexSchema): unknown {
    const fields = schema.fields.map(field => this.convertField(field));
    
    const azureSchema: Record<string, unknown> = {
      name: schema.name,
      fields,
    };
    
    // Add vector search configuration if needed
    if (schema.vectorConfig) {
      azureSchema.vectorSearch = {
        algorithms: [{
          name: 'vector-algorithm',
          kind: schema.vectorConfig.algorithm === 'hnsw' ? 'hnsw' : 'exhaustiveKnn',
          ...(schema.vectorConfig.algorithm === 'hnsw' ? {
            hnswParameters: {
              metric: schema.vectorConfig.metric,
              m: 4,
              efConstruction: 400,
              efSearch: 500,
            },
          } : {
            exhaustiveKnnParameters: {
              metric: schema.vectorConfig.metric,
            },
          }),
        }],
        profiles: [{
          name: 'vector-profile',
          algorithm: 'vector-algorithm',
        }],
      };
    }
    
    // Add semantic configuration if needed
    if (schema.semanticConfig) {
      azureSchema.semantic = {
        configurations: [{
          name: schema.semanticConfig.name,
          prioritizedFields: {
            titleField: schema.semanticConfig.prioritizedFields.titleField 
              ? { fieldName: schema.semanticConfig.prioritizedFields.titleField }
              : undefined,
            contentFields: schema.semanticConfig.prioritizedFields.contentFields.map(f => ({ fieldName: f })),
            keywordsFields: schema.semanticConfig.prioritizedFields.keywordFields?.map(f => ({ fieldName: f })),
          },
        }],
      };
    }
    
    return azureSchema;
  }
  
  /**
   * Convert field definition to Azure format
   */
  private convertField(field: IndexField): Record<string, unknown> {
    const typeMap: Record<string, string> = {
      'string': 'Edm.String',
      'int32': 'Edm.Int32',
      'int64': 'Edm.Int64',
      'double': 'Edm.Double',
      'boolean': 'Edm.Boolean',
      'datetime': 'Edm.DateTimeOffset',
      'collection': 'Collection(Edm.String)',
      'vector': `Collection(Edm.Single)`,
    };
    
    const azureField: Record<string, unknown> = {
      name: field.name,
      type: typeMap[field.type] || 'Edm.String',
      searchable: field.searchable ?? (field.type === 'string'),
      filterable: field.filterable ?? false,
      sortable: field.sortable ?? false,
      facetable: field.facetable ?? false,
      key: field.key ?? false,
    };
    
    // Vector field configuration
    if (field.type === 'vector' && field.dimensions) {
      azureField.dimensions = field.dimensions;
      azureField.vectorSearchProfile = field.vectorSearchProfile || 'vector-profile';
    }
    
    return azureField;
  }
  
  /**
   * Convert Azure search result to our format
   */
  private convertToSearchResult(doc: Record<string, unknown>): SearchResult {
    const { '@search.score': score, id, content, embedding, ...metadata } = doc;
    
    return {
      id: String(id),
      content: String(content || ''),
      score: Number(score) || 0,
      metadata,
      source: 'azure',
    };
  }
}

// Export singleton for convenience
let defaultClient: AzureSearchClient | null = null;

export function getAzureSearchClient(): AzureSearchClient {
  if (!defaultClient) {
    defaultClient = new AzureSearchClient();
  }
  return defaultClient;
}

export default AzureSearchClient;
