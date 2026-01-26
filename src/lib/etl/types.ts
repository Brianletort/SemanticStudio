/**
 * ETL System Types
 * 
 * Types for the ETL engine with PAR loops and self-learning capabilities.
 * Supports multi-target loading to SQL tables, PostgreSQL vector stores, and Azure Cognitive Search.
 */

// Job Status
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

// Source Types
export type SourceType = 'csv' | 'json' | 'api' | 'database' | 'web';

// Storage Target Types
export type StorageTarget = 'sql_table' | 'postgres_vector' | 'azure_search';

// Job Types
export type JobType = 
  | 'csv_import'
  | 'json_import'
  | 'api_fetch'
  | 'web_scrape'
  | 'kg_build'
  | 'embedding_generate'
  | 'data_sync'
  | 'data_load'  // Flexible multi-target loading
  // Public data ETL jobs
  | 'economic_indicators'
  | 'public_companies'
  | 'industry_statistics';

// ETL Job Definition
export interface ETLJobDefinition {
  id?: string;
  jobType: JobType;
  name: string;
  description?: string;
  sourceConfig: SourceConfig;
  targetConfig: TargetConfig | MultiTargetConfig;
  transformConfig?: TransformConfig;
  schedule?: ScheduleConfig;
}

// Source Configuration
export interface SourceConfig {
  type: SourceType;
  // For CSV/JSON files
  filePath?: string;
  fileContent?: string;
  // For APIs
  url?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  // For databases
  connectionString?: string;
  query?: string;
  // For web scraping
  targetUrl?: string;
  selectors?: Record<string, string>;
}

// Legacy Target Configuration (for backward compatibility)
export interface TargetConfig {
  table: string;
  mode: 'insert' | 'upsert' | 'replace';
  keyColumn?: string;
  columnMappings?: Record<string, string>;
}

// Multi-Target Configuration (for data_load job type)
export interface MultiTargetConfig {
  targets: StorageTargetConfig[];
}

// Storage Target Configuration
export interface StorageTargetConfig {
  type: StorageTarget;
  // Common fields
  name?: string;  // Human-readable name for this target
  
  // For SQL table target
  tableName?: string;
  mode?: 'insert' | 'upsert' | 'replace';
  keyColumn?: string;
  columnMappings?: Record<string, string>;
  
  // For vector stores (postgres_vector and azure_search)
  indexName?: string;
  embeddingColumns?: string[];  // Which columns to combine and embed
  embeddingModel?: string;      // Default: text-embedding-3-large
  chunkSize?: number;           // For text chunking (default: 1000)
  chunkOverlap?: number;        // Overlap between chunks (default: 200)
  
  // For Azure Cognitive Search specifically
  azureIndexName?: string;
  azureSemanticConfigName?: string;
}

// Type guard to check if config is multi-target
export function isMultiTargetConfig(config: TargetConfig | MultiTargetConfig): config is MultiTargetConfig {
  return 'targets' in config && Array.isArray((config as MultiTargetConfig).targets);
}

// Retrieval Configuration (for agent data sources)
export interface RetrievalConfig {
  enableSqlQueries: boolean;      // Allow SQL tool queries
  enableSemanticSearch: boolean;  // Allow vector search
  searchBackend: 'postgres' | 'azure' | 'both';
  searchMode: 'semantic' | 'hybrid' | 'keyword';
  azureIndexName?: string | null;
  maxResults?: number;            // Default: 10
  similarityThreshold?: number;   // Default: 0.7
}

// Default retrieval configuration
export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  enableSqlQueries: true,
  enableSemanticSearch: true,
  searchBackend: 'postgres',
  searchMode: 'hybrid',
  azureIndexName: null,
  maxResults: 10,
  similarityThreshold: 0.7,
};

// Transform Configuration
export interface TransformConfig {
  // Column transformations
  transforms?: ColumnTransform[];
  // Filtering
  filter?: FilterConfig;
  // Deduplication
  dedupe?: DedupeConfig;
}

export interface ColumnTransform {
  column: string;
  operation: 'rename' | 'cast' | 'compute' | 'default' | 'trim' | 'lowercase' | 'uppercase';
  params?: Record<string, unknown>;
}

export interface FilterConfig {
  conditions: Array<{
    column: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_null';
    value?: unknown;
  }>;
  logic: 'and' | 'or';
}

export interface DedupeConfig {
  columns: string[];
  keepFirst: boolean;
}

// Schedule Configuration
export interface ScheduleConfig {
  frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  cronExpression?: string;
  timezone?: string;
}

// PAR Loop Types
export interface PARPerception<T = unknown> {
  data: T;
  context: Record<string, unknown>;
  iteration: number;
  previousAdjustment?: unknown;
}

export interface PARAction<T = unknown> {
  result: T;
  metrics: {
    recordsProcessed: number;
    recordsFailed: number;
    duration: number;
  };
  errors: ETLError[];
}

export interface PARReflection {
  success: boolean;
  retry: boolean;
  confidence: number;
  adjustment?: unknown;
  improvements: string[];
  lessonsLearned?: string;
}

// ETL Errors
export interface ETLError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  row?: number;
  column?: string;
}

// Job Run Result
export interface JobRunResult {
  jobId: string;
  runId: string;
  status: JobStatus;
  startedAt: Date;
  completedAt?: Date;
  recordsProcessed: number;
  recordsFailed: number;
  errors: ETLError[];
  parIterations: number;
  reflexionImprovements: string[];
  metrics: Record<string, unknown>;
}

// Knowledge Graph Types for ETL
export interface KGNodeExtraction {
  type: string;
  name: string;
  properties: Record<string, unknown>;
  sourceTable: string;
  sourceId: string;
}

export interface KGEdgeExtraction {
  sourceType: string;
  sourceName: string;
  targetType: string;
  targetName: string;
  relationshipType: string;
  weight?: number;
  confidence?: number;
  properties?: Record<string, unknown>;
}

// Agent Events
export type ETLAgentEvent = 
  | { type: 'job_started'; jobId: string; runId: string }
  | { type: 'perception_complete'; data: unknown }
  | { type: 'action_complete'; metrics: PARAction['metrics'] }
  | { type: 'reflection_complete'; reflection: PARReflection }
  | { type: 'iteration_complete'; iteration: number; success: boolean }
  | { type: 'job_completed'; result: JobRunResult }
  | { type: 'job_failed'; error: ETLError };

export type ETLAgentEventHandler = (event: ETLAgentEvent) => void;
