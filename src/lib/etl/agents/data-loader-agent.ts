/**
 * Data Loader Agent
 * 
 * Unified ETL agent that handles loading data to multiple targets:
 * - SQL tables (structured data)
 * - PostgreSQL pgvector (vector search)
 * - Azure Cognitive Search (enterprise search)
 * 
 * Supports CSV and JSON source files with configurable embedding generation.
 */

import Papa from 'papaparse';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { BaseETLAgent } from '../base-agent';
import { registerAgent } from '../orchestrator';
import { getEmbedding, getEmbeddings } from '@/lib/memory/embeddings';
import { PostgresSearchClient } from '@/lib/search/postgres-search-client';
import { AzureSearchClient, isAzureSearchConfigured } from '@/lib/search/azure-search-client';
import type { SearchDocument, IndexSchema } from '@/lib/search/types';
import type {
  ETLJobDefinition,
  PARPerception,
  PARAction,
  PARReflection,
  ETLError,
  MultiTargetConfig,
  StorageTargetConfig,
  isMultiTargetConfig,
} from '../types';

// Perception data structure
interface DataLoaderPerception {
  rawData: string;
  parsedData: Record<string, unknown>[];
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
  detectedTypes: Record<string, string>;
  sourceType: 'csv' | 'json';
}

// Target load result
interface TargetLoadResult {
  target: StorageTargetConfig;
  succeeded: number;
  failed: number;
  errors: ETLError[];
}

export class DataLoaderAgent extends BaseETLAgent {
  private fileContent: string = '';
  private postgresClient: PostgresSearchClient;
  private azureClient: AzureSearchClient | null = null;

  constructor(jobDefinition: ETLJobDefinition) {
    super(jobDefinition);
    this.postgresClient = new PostgresSearchClient();
    
    // Initialize Azure client if configured
    if (isAzureSearchConfigured()) {
      try {
        this.azureClient = new AzureSearchClient();
      } catch (error) {
        console.warn('[DataLoader] Azure Search not configured:', error);
      }
    }
  }

  /**
   * Load file content from config
   */
  private async loadFileContent(): Promise<string> {
    const { sourceConfig } = this.jobDefinition;
    
    if (sourceConfig.fileContent) {
      return sourceConfig.fileContent;
    }
    
    if (sourceConfig.filePath) {
      // In production, this would read from disk or cloud storage
      throw new Error('File path loading not implemented - provide fileContent directly');
    }
    
    throw new Error('No file content or path provided');
  }

  /**
   * Detect column types from sample data
   */
  private detectColumnTypes(data: Record<string, unknown>[]): Record<string, string> {
    const types: Record<string, string> = {};
    if (data.length === 0) return types;

    const headers = Object.keys(data[0]);
    for (const header of headers) {
      const values = data.slice(0, 100).map(row => row[header]).filter(v => v != null && v !== '');
      
      if (values.length === 0) {
        types[header] = 'TEXT';
        continue;
      }

      // Check if all values are numbers
      const allNumbers = values.every(v => !isNaN(Number(v)));
      if (allNumbers) {
        const hasDecimals = values.some(v => String(v).includes('.'));
        types[header] = hasDecimals ? 'DECIMAL' : 'INTEGER';
        continue;
      }

      // Check if all values are dates
      const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;
      const allDates = values.every(v => datePattern.test(String(v)));
      if (allDates) {
        types[header] = 'DATE';
        continue;
      }

      // Check if all values are booleans
      const boolValues = ['true', 'false', 'yes', 'no', '1', '0'];
      const allBools = values.every(v => boolValues.includes(String(v).toLowerCase()));
      if (allBools) {
        types[header] = 'BOOLEAN';
        continue;
      }

      // Check if UUIDs
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const allUuids = values.every(v => uuidPattern.test(String(v)));
      if (allUuids) {
        types[header] = 'UUID';
        continue;
      }

      types[header] = 'TEXT';
    }

    return types;
  }

  /**
   * PERCEIVE: Parse source data and gather metadata
   */
  async perceive(): Promise<PARPerception<DataLoaderPerception>> {
    this.fileContent = await this.loadFileContent();
    const sourceType = this.jobDefinition.sourceConfig.type as 'csv' | 'json';
    
    let parsedData: Record<string, unknown>[];
    let headers: string[];
    
    if (sourceType === 'json') {
      // Parse JSON
      const jsonData = JSON.parse(this.fileContent);
      parsedData = Array.isArray(jsonData) ? jsonData : [jsonData];
      headers = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
    } else {
      // Parse CSV (default)
      const parseResult = Papa.parse<Record<string, unknown>>(this.fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });
      parsedData = parseResult.data;
      headers = parseResult.meta.fields || [];
    }

    const detectedTypes = this.detectColumnTypes(parsedData);

    return {
      data: {
        rawData: this.fileContent,
        parsedData,
        headers,
        rowCount: parsedData.length,
        sampleRows: parsedData.slice(0, 5),
        detectedTypes,
        sourceType,
      },
      context: {
        targetConfig: this.jobDefinition.targetConfig,
      },
      iteration: 0,
    };
  }

  /**
   * ACT: Load data to configured targets
   */
  async act(perception: PARPerception<DataLoaderPerception>): Promise<PARAction> {
    const startTime = Date.now();
    const errors: ETLError[] = [];
    let totalProcessed = 0;
    let totalFailed = 0;

    const { parsedData, headers, detectedTypes } = perception.data as DataLoaderPerception;
    const targetConfig = this.jobDefinition.targetConfig;
    
    // Handle multi-target config
    if (isMultiTargetConfig(targetConfig)) {
      const results: TargetLoadResult[] = [];
      
      for (const target of targetConfig.targets) {
        const result = await this.loadToTarget(parsedData, headers, detectedTypes, target);
        results.push(result);
        totalProcessed += result.succeeded;
        totalFailed += result.failed;
        errors.push(...result.errors);
      }

      return {
        result: { results },
        metrics: {
          recordsProcessed: totalProcessed,
          recordsFailed: totalFailed,
          duration: Date.now() - startTime,
        },
        errors,
      };
    }

    // Legacy single-target config (backward compatibility)
    const legacyResult = await this.loadToSqlTable(
      parsedData,
      headers,
      detectedTypes,
      {
        type: 'sql_table',
        tableName: targetConfig.table,
        mode: targetConfig.mode,
        keyColumn: targetConfig.keyColumn,
        columnMappings: targetConfig.columnMappings,
      }
    );

    return {
      result: { tableName: targetConfig.table },
      metrics: {
        recordsProcessed: legacyResult.succeeded,
        recordsFailed: legacyResult.failed,
        duration: Date.now() - startTime,
      },
      errors: legacyResult.errors,
    };
  }

  /**
   * Load data to a specific target
   */
  private async loadToTarget(
    data: Record<string, unknown>[],
    headers: string[],
    detectedTypes: Record<string, string>,
    target: StorageTargetConfig
  ): Promise<TargetLoadResult> {
    switch (target.type) {
      case 'sql_table':
        return this.loadToSqlTable(data, headers, detectedTypes, target);
      case 'postgres_vector':
        return this.loadToPostgresVector(data, headers, target);
      case 'azure_search':
        return this.loadToAzureSearch(data, headers, target);
      default:
        return {
          target,
          succeeded: 0,
          failed: data.length,
          errors: [{ code: 'UNKNOWN_TARGET', message: `Unknown target type: ${(target as StorageTargetConfig).type}` }],
        };
    }
  }

  /**
   * Load data to SQL table
   */
  private async loadToSqlTable(
    data: Record<string, unknown>[],
    headers: string[],
    detectedTypes: Record<string, string>,
    target: StorageTargetConfig
  ): Promise<TargetLoadResult> {
    const errors: ETLError[] = [];
    let succeeded = 0;
    let failed = 0;

    const tableName = this.sanitizeIdentifier(target.tableName || 'imported_data');

    try {
      // Create table if it doesn't exist
      const columnDefs = headers.map(h => {
        const sqlType = detectedTypes[h] || 'TEXT';
        const safeColName = this.sanitizeIdentifier(h);
        return `${safeColName} ${sqlType === 'DECIMAL' ? 'DECIMAL(15,2)' : sqlType}`;
      }).join(', ');

      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          _id SERIAL PRIMARY KEY,
          ${columnDefs},
          _imported_at TIMESTAMPTZ DEFAULT NOW()
        )
      `));

      // Clear table if replace mode
      if (target.mode === 'replace') {
        await db.execute(sql.raw(`TRUNCATE TABLE ${tableName}`));
      }

      // Insert data in batches
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        try {
          for (const row of batch) {
            const columns = headers.map(h => this.sanitizeIdentifier(h));
            const values = headers.map(h => {
              const val = row[h];
              if (val === null || val === undefined || val === '') return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              return val;
            });

            if (target.mode === 'upsert' && target.keyColumn) {
              const keyCol = this.sanitizeIdentifier(target.keyColumn);
              const updatePairs = columns
                .filter(c => c !== keyCol)
                .map((c, idx) => `${c} = EXCLUDED.${c}`)
                .join(', ');

              await db.execute(sql.raw(`
                INSERT INTO ${tableName} (${columns.join(', ')})
                VALUES (${values.join(', ')})
                ON CONFLICT (${keyCol}) DO UPDATE SET ${updatePairs}
              `));
            } else {
              await db.execute(sql.raw(`
                INSERT INTO ${tableName} (${columns.join(', ')})
                VALUES (${values.join(', ')})
              `));
            }
            succeeded++;
          }
        } catch (batchError) {
          failed += batch.length;
          errors.push({
            code: 'BATCH_INSERT_ERROR',
            message: batchError instanceof Error ? batchError.message : 'Unknown error',
            row: i,
          });
        }
      }
    } catch (error) {
      errors.push({
        code: 'SQL_TABLE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      failed = data.length;
    }

    return { target, succeeded, failed, errors };
  }

  /**
   * Load data to PostgreSQL vector store
   */
  private async loadToPostgresVector(
    data: Record<string, unknown>[],
    headers: string[],
    target: StorageTargetConfig
  ): Promise<TargetLoadResult> {
    const errors: ETLError[] = [];
    let succeeded = 0;
    let failed = 0;

    const indexName = target.indexName || 'vector_data';
    const embeddingColumns = target.embeddingColumns || headers.filter(h => 
      ['content', 'text', 'description', 'name', 'title'].some(t => h.toLowerCase().includes(t))
    );

    if (embeddingColumns.length === 0) {
      embeddingColumns.push(headers[0]);  // Default to first column
    }

    try {
      // Create vector index/table
      const schema: IndexSchema = {
        name: indexName,
        fields: [
          { name: 'id', type: 'string', key: true },
          { name: 'content', type: 'string', searchable: true },
          ...headers.map(h => ({ name: h, type: 'string' as const, searchable: true })),
        ],
        vectorConfig: {
          fieldName: 'embedding',
          dimensions: 1536,
          algorithm: 'hnsw',
          metric: 'cosine',
        },
      };

      // Check if index exists, create if not
      const exists = await this.postgresClient.indexExists(indexName);
      if (!exists) {
        await this.postgresClient.createIndex(schema);
      }

      // Generate embeddings and upload in batches
      const batchSize = 50;  // Smaller batch for embedding generation
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        try {
          // Combine embedding columns into content for each row
          const contents = batch.map(row => 
            embeddingColumns.map(col => String(row[col] || '')).join(' ')
          );

          // Generate embeddings
          const embeddings = await getEmbeddings(contents);

          // Create search documents
          const documents: SearchDocument[] = batch.map((row, idx) => ({
            id: String(row['id'] || row['_id'] || `${indexName}-${i + idx}`),
            content: contents[idx],
            embedding: embeddings[idx],
            metadata: row,
          }));

          // Upload to vector store
          const result = await this.postgresClient.uploadDocuments(indexName, documents);
          succeeded += result.succeeded;
          failed += result.failed;
          errors.push(...result.errors.map(e => ({
            code: 'VECTOR_UPLOAD_ERROR',
            message: e.error,
            details: { id: e.id },
          })));
        } catch (batchError) {
          failed += batch.length;
          errors.push({
            code: 'VECTOR_BATCH_ERROR',
            message: batchError instanceof Error ? batchError.message : 'Unknown error',
            row: i,
          });
        }
      }
    } catch (error) {
      errors.push({
        code: 'POSTGRES_VECTOR_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      failed = data.length;
    }

    return { target, succeeded, failed, errors };
  }

  /**
   * Load data to Azure Cognitive Search
   */
  private async loadToAzureSearch(
    data: Record<string, unknown>[],
    headers: string[],
    target: StorageTargetConfig
  ): Promise<TargetLoadResult> {
    const errors: ETLError[] = [];
    let succeeded = 0;
    let failed = 0;

    if (!this.azureClient) {
      return {
        target,
        succeeded: 0,
        failed: data.length,
        errors: [{
          code: 'AZURE_NOT_CONFIGURED',
          message: 'Azure Cognitive Search is not configured. Set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY.',
        }],
      };
    }

    const indexName = target.azureIndexName || target.indexName || 'azure_data';
    const embeddingColumns = target.embeddingColumns || headers.filter(h => 
      ['content', 'text', 'description', 'name', 'title'].some(t => h.toLowerCase().includes(t))
    );

    if (embeddingColumns.length === 0) {
      embeddingColumns.push(headers[0]);
    }

    try {
      // Create Azure index if it doesn't exist
      const exists = await this.azureClient.indexExists(indexName);
      if (!exists) {
        const schema: IndexSchema = {
          name: indexName,
          fields: [
            { name: 'id', type: 'string', key: true },
            { name: 'content', type: 'string', searchable: true },
            { name: 'embedding', type: 'vector', dimensions: 1536 },
            ...headers.map(h => ({ 
              name: this.sanitizeIdentifier(h), 
              type: 'string' as const, 
              searchable: true,
              filterable: true,
            })),
          ],
          vectorConfig: {
            fieldName: 'embedding',
            dimensions: 1536,
            algorithm: 'hnsw',
            metric: 'cosine',
          },
        };
        await this.azureClient.createIndex(schema);
      }

      // Generate embeddings and upload in batches
      const batchSize = 50;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        try {
          // Combine embedding columns into content
          const contents = batch.map(row => 
            embeddingColumns.map(col => String(row[col] || '')).join(' ')
          );

          // Generate embeddings
          const embeddings = await getEmbeddings(contents);

          // Create search documents with sanitized field names
          const documents: SearchDocument[] = batch.map((row, idx) => {
            const doc: SearchDocument = {
              id: String(row['id'] || row['_id'] || `${indexName}-${i + idx}`),
              content: contents[idx],
              embedding: embeddings[idx],
            };
            // Add all fields with sanitized names
            for (const h of headers) {
              doc[this.sanitizeIdentifier(h)] = row[h];
            }
            return doc;
          });

          // Upload to Azure
          const result = await this.azureClient.uploadDocuments(indexName, documents);
          succeeded += result.succeeded;
          failed += result.failed;
          errors.push(...result.errors.map(e => ({
            code: 'AZURE_UPLOAD_ERROR',
            message: e.error,
            details: { id: e.id },
          })));
        } catch (batchError) {
          failed += batch.length;
          errors.push({
            code: 'AZURE_BATCH_ERROR',
            message: batchError instanceof Error ? batchError.message : 'Unknown error',
            row: i,
          });
        }
      }
    } catch (error) {
      errors.push({
        code: 'AZURE_SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      failed = data.length;
    }

    return { target, succeeded, failed, errors };
  }

  /**
   * REFLECT: Evaluate load quality and determine if retry needed
   */
  async reflect(action: PARAction, perception: PARPerception<DataLoaderPerception>): Promise<PARReflection> {
    const { rowCount } = perception.data as DataLoaderPerception;
    const { recordsProcessed, recordsFailed } = action.metrics;
    const improvements: string[] = [];

    // Calculate success rate
    const successRate = rowCount > 0 ? recordsProcessed / rowCount : 0;

    // Check for errors
    if (action.errors.length > 0) {
      improvements.push(`Encountered ${action.errors.length} errors during load`);
    }

    // Determine if successful
    const success = successRate >= 0.95 && action.errors.length === 0;
    const retry = !success && perception.iteration < 2 && successRate < 0.8;

    // Generate lessons learned
    let lessonsLearned: string | undefined;
    if (success) {
      lessonsLearned = `Successfully loaded ${recordsProcessed} records with ${(successRate * 100).toFixed(1)}% success rate`;
    } else if (action.errors.length > 0) {
      lessonsLearned = `Load failed with errors: ${action.errors.slice(0, 3).map(e => e.message).join('; ')}`;
    }

    // Determine adjustments for retry
    let adjustment: unknown;
    if (retry) {
      adjustment = {
        batchSize: 25,  // Reduce batch size
        skipErrors: true,
      };
      improvements.push('Reducing batch size for retry');
    }

    return {
      success,
      retry,
      confidence: successRate,
      adjustment,
      improvements,
      lessonsLearned,
    };
  }

  /**
   * Sanitize identifier for SQL
   */
  private sanitizeIdentifier(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }
}

// Register the agent
registerAgent('data_load', DataLoaderAgent);

export default DataLoaderAgent;
