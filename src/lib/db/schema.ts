import { pgTable, text, timestamp, uuid, jsonb, real, boolean, integer, serial, decimal, date, index, vector } from 'drizzle-orm/pg-core';

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Session Folders (for organizing chat sessions)
export const sessionFolders = pgTable('session_folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_session_folders_user_id').on(table.userId),
}));

// Sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').default('New Chat'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  summaryText: text('summary_text'),
  summaryEmbedding: vector('summary_embedding', { dimensions: 1536 }),
  // Pinning support
  isPinned: boolean('is_pinned').default(false),
  pinnedAt: timestamp('pinned_at'),
  // Folder organization
  folderId: uuid('folder_id').references(() => sessionFolders.id, { onDelete: 'set null' }),
}, (table) => ({
  userIdIdx: index('idx_sessions_user_id').on(table.userId),
  updatedAtIdx: index('idx_sessions_updated_at').on(table.updatedAt),
  isPinnedIdx: index('idx_sessions_is_pinned').on(table.isPinned),
  folderIdIdx: index('idx_sessions_folder_id').on(table.folderId),
}));

// Messages
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  sessionIdIdx: index('idx_messages_session_id').on(table.sessionId),
  createdAtIdx: index('idx_messages_created_at').on(table.createdAt),
}));

// Session Memory Facts
export const sessionMemoryFacts = pgTable('session_memory_facts', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  factType: text('fact_type').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  importance: real('importance').default(0.5),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  sessionIdIdx: index('idx_session_memory_facts_session_id').on(table.sessionId),
}));

// User Memory (system-extracted facts)
export const userMemory = pgTable('user_memory', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  factType: text('fact_type').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  importance: real('importance').default(0.5),
  sourceSessionId: uuid('source_session_id').references(() => sessions.id, { onDelete: 'set null' }),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_user_memory_user_id').on(table.userId),
}));

// ============================================
// USER SETTINGS & MEMORIES
// ============================================

// User Settings (profile, preferences, personalization)
export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').unique().notNull().references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme').default('system'),
  nickname: text('nickname'),
  occupation: text('occupation'),
  aboutMe: text('about_me'),
  conversationStyle: text('conversation_style').default('professional'),
  characteristics: jsonb('characteristics').default({
    use_emojis: false,
    use_headers: true,
    enthusiastic: false,
    formal: false,
    detailed: true,
  }),
  // Memory configuration
  memoryEnabled: boolean('memory_enabled').default(true),
  referenceSavedMemories: boolean('reference_saved_memories').default(true),
  referenceChatHistory: boolean('reference_chat_history').default(true),
  autoSaveMemories: boolean('auto_save_memories').default(false),
  memoryExtractionMode: text('memory_extraction_mode').default('balanced'),
  maxMemoriesInContext: integer('max_memories_in_context').default(10),
  includeSessionSummaries: boolean('include_session_summaries').default(false),
  // Chat organization
  maxPinnedSessions: integer('max_pinned_sessions').default(10),
  
  // ============================================
  // MODE AND PIPELINE CONFIGURATION (Advanced Settings)
  // ============================================
  
  // Per-mode configuration overrides (JSON, null = use defaults)
  // Structure: { quick?: {...}, think?: {...}, deep?: {...}, research?: {...} }
  modeConfigOverrides: jsonb('mode_config_overrides').$type<{
    quick?: {
      maxResults?: number;
      graphHops?: number;
      webResultsIfEnabled?: number;
    };
    think?: {
      maxResults?: number;
      graphHops?: number;
      webResultsIfEnabled?: number;
    };
    deep?: {
      maxResults?: number;
      graphHops?: number;
      webResultsIfEnabled?: number;
    };
    research?: {
      maxResults?: number;
      graphHops?: number;
      webResultsIfEnabled?: number;
    };
  }>(),
  
  // Memory tier configuration
  memoryTierConfig: jsonb('memory_tier_config').$type<{
    tier1WorkingContext: boolean;   // Always true
    tier2SessionMemory: boolean;    // Default: true
    tier3LongTermMemory: boolean;   // Default: true
  }>().default({
    tier1WorkingContext: true,
    tier2SessionMemory: true,
    tier3LongTermMemory: true,
  }),
  
  // Pipeline configuration
  pipelineConfig: jsonb('pipeline_config').$type<{
    enableReflection: boolean;      // Default: true
    enableClarification: boolean;   // Default: true (for research mode)
    showEvaluationInChat: boolean;  // Default: true
    autoModeDefault: 'quick' | 'think' | 'deep' | 'research';  // Default: 'think'
  }>().default({
    enableReflection: true,
    enableClarification: true,
    showEvaluationInChat: true,
    autoModeDefault: 'think',
  }),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_user_settings_user_id').on(table.userId),
}));

// User Memories (ChatGPT-style long-term memories)
export const userMemories = pgTable('user_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  source: text('source').default('user'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_user_memories_user_id').on(table.userId),
}));

// Domain Agents
export const domainAgents = pgTable('domain_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  status: text('status').default('active'),
  config: jsonb('config').default({}),
  schemaTables: text('schema_tables').array().default([]),
  systemPrompt: text('system_prompt'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  categoryIdx: index('idx_domain_agents_category').on(table.category),
  statusIdx: index('idx_domain_agents_status').on(table.status),
}));

// Agent Data Sources
export const agentDataSources = pgTable('agent_data_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => domainAgents.id, { onDelete: 'cascade' }),
  sourceType: text('source_type').notNull(),
  sourceName: text('source_name').notNull(),
  sourceConfig: jsonb('source_config').default({}),
  embeddingTable: text('embedding_table'),
  // Retrieval configuration for this data source
  retrievalConfig: jsonb('retrieval_config').default({
    enableSqlQueries: true,
    enableSemanticSearch: true,
    searchBackend: 'postgres',
    searchMode: 'hybrid',
    azureIndexName: null,
    maxResults: 10,
    similarityThreshold: 0.7,
  }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Model Configurations
export const modelConfigs = pgTable('model_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: text('role').unique().notNull(),
  provider: text('provider').notNull(),
  modelName: text('model_name').notNull(),
  isActive: boolean('is_active').default(true),
  config: jsonb('config').default({}),
  fallbackProvider: text('fallback_provider'),
  fallbackModel: text('fallback_model'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ETL Jobs
export const etlJobs = pgTable('etl_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => domainAgents.id, { onDelete: 'cascade' }),
  jobType: text('job_type').notNull(),
  status: text('status').default('pending'),
  config: jsonb('config').default({}),
  result: jsonb('result'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  agentIdIdx: index('idx_etl_jobs_agent_id').on(table.agentId),
  statusIdx: index('idx_etl_jobs_status').on(table.status),
}));

// ETL Knowledge
export const etlKnowledge = pgTable('etl_knowledge', {
  id: uuid('id').primaryKey().defaultRandom(),
  pattern: text('pattern').notNull(),
  successRate: real('success_rate').default(0.0),
  lessonsLearned: text('lessons_learned'),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// File Uploads
export const fileUploads = pgTable('file_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storagePath: text('storage_path').notNull(),
  status: text('status').default('uploaded'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

// Document Chunks
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => fileUploads.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => domainAgents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  fileIdIdx: index('idx_document_chunks_file_id').on(table.fileId),
  agentIdIdx: index('idx_document_chunks_agent_id').on(table.agentId),
}));

// Generated Images
export const generatedImages = pgTable('generated_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  revisedPrompt: text('revised_prompt'),
  imageUrl: text('image_url').notNull(),
  model: text('model').notNull(),
  size: text('size'),
  quality: text('quality'),
  background: text('background'), // 'transparent' | 'opaque'
  action: text('action'), // 'generate' | 'edit'
  inputFileIds: jsonb('input_file_ids'), // Array of OpenAI file IDs used for editing
  status: text('status').default('completed'), // 'generating' | 'completed' | 'failed'
  durationMs: integer('duration_ms'), // Generation time in milliseconds
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  sessionIdIdx: index('idx_generated_images_session_id').on(table.sessionId),
  messageIdIdx: index('idx_generated_images_message_id').on(table.messageId),
}));

// OpenAI Files (for image editing)
export const openaiFiles = pgTable('openai_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  openaiFileId: text('openai_file_id').notNull(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  purpose: text('purpose').notNull(), // 'vision'
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  openaiFileIdIdx: index('idx_openai_files_openai_file_id').on(table.openaiFileId),
  sessionIdIdx: index('idx_openai_files_session_id').on(table.sessionId),
}));

// ============================================
// KNOWLEDGE GRAPH TABLES
// ============================================

// Knowledge Graph Nodes
export const knowledgeGraphNodes = pgTable('knowledge_graph_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  properties: jsonb('properties').default({}),
  embedding: vector('embedding', { dimensions: 1536 }),
  importanceScore: real('importance_score').default(0.5),
  sourceTable: text('source_table'),
  sourceId: text('source_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  typeIdx: index('idx_kg_nodes_type').on(table.type),
  nameIdx: index('idx_kg_nodes_name').on(table.name),
  sourceIdx: index('idx_kg_nodes_source').on(table.sourceTable, table.sourceId),
}));

// Knowledge Graph Edges
export const knowledgeGraphEdges = pgTable('knowledge_graph_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => knowledgeGraphNodes.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').references(() => knowledgeGraphNodes.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(),
  weight: real('weight').default(1.0),
  confidence: real('confidence').default(1.0),
  properties: jsonb('properties').default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  sourceIdx: index('idx_kg_edges_source').on(table.sourceId),
  targetIdx: index('idx_kg_edges_target').on(table.targetId),
  typeIdx: index('idx_kg_edges_type').on(table.relationshipType),
}));

// ============================================
// SEMANTIC LAYER TABLES
// ============================================

// Semantic Entities Registry
export const semanticEntities = pgTable('semantic_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  sourceTable: text('source_table').notNull(),
  domainAgent: text('domain_agent'),
  fields: jsonb('fields').default([]),
  aliases: jsonb('aliases').default([]),
  relationships: jsonb('relationships').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  nameIdx: index('idx_semantic_entities_name').on(table.name),
  domainIdx: index('idx_semantic_entities_domain').on(table.domainAgent),
}));

// Entity Aliases
export const entityAliases = pgTable('entity_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').references(() => semanticEntities.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
  aliasType: text('alias_type').default('synonym'),
  confidence: real('confidence').default(1.0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  aliasIdx: index('idx_entity_aliases_alias').on(table.alias),
}));

// ============================================
// ETL JOB RUNS
// ============================================

// ETL Job Runs
export const etlJobRuns = pgTable('etl_job_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => etlJobs.id, { onDelete: 'cascade' }),
  status: text('status').default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  recordsProcessed: integer('records_processed').default(0),
  recordsFailed: integer('records_failed').default(0),
  errors: jsonb('errors').default([]),
  parIterations: integer('par_iterations').default(0),
  reflexionImprovements: jsonb('reflexion_improvements').default([]),
  metrics: jsonb('metrics').default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  jobIdIdx: index('idx_etl_job_runs_job_id').on(table.jobId),
  statusIdx: index('idx_etl_job_runs_status').on(table.status),
}));

// ============================================
// DATA SOURCES
// ============================================

// Data Sources
export const dataSources = pgTable('data_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
  displayName: text('display_name').notNull(),
  sourceType: text('source_type').notNull(),
  config: jsonb('config').default({}),
  schemaInfo: jsonb('schema_info').default({}),
  // Storage targets configuration (SQL table, postgres vector, azure search)
  storageTargets: jsonb('storage_targets').default([]),
  status: text('status').default('active'),
  lastSyncAt: timestamp('last_sync_at'),
  syncFrequency: text('sync_frequency'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  typeIdx: index('idx_data_sources_type').on(table.sourceType),
  statusIdx: index('idx_data_sources_status').on(table.status),
}));

// Data Source to Agent mapping
export const dataSourceAgents = pgTable('data_source_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  dataSourceId: uuid('data_source_id').references(() => dataSources.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => domainAgents.id, { onDelete: 'cascade' }),
  accessType: text('access_type').default('read'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// NORTHWIND-STYLE TABLES
// ============================================

// Categories
export const nwCategories = pgTable('nw_categories', {
  id: serial('id').primaryKey(),
  categoryName: text('category_name').notNull(),
  description: text('description'),
});

// Suppliers
export const nwSuppliers = pgTable('nw_suppliers', {
  id: serial('id').primaryKey(),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name'),
  contactTitle: text('contact_title'),
  address: text('address'),
  city: text('city'),
  region: text('region'),
  postalCode: text('postal_code'),
  country: text('country'),
  phone: text('phone'),
  fax: text('fax'),
  homepage: text('homepage'),
});

// Products
export const nwProducts = pgTable('nw_products', {
  id: serial('id').primaryKey(),
  productName: text('product_name').notNull(),
  supplierId: integer('supplier_id').references(() => nwSuppliers.id),
  categoryId: integer('category_id').references(() => nwCategories.id),
  quantityPerUnit: text('quantity_per_unit'),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
  unitsInStock: integer('units_in_stock').default(0),
  unitsOnOrder: integer('units_on_order').default(0),
  reorderLevel: integer('reorder_level').default(0),
  discontinued: boolean('discontinued').default(false),
}, (table) => ({
  supplierIdx: index('idx_nw_products_supplier').on(table.supplierId),
  categoryIdx: index('idx_nw_products_category').on(table.categoryId),
}));

// Regions
export const nwRegions = pgTable('nw_regions', {
  id: serial('id').primaryKey(),
  regionDescription: text('region_description').notNull(),
});

// Territories
export const nwTerritories = pgTable('nw_territories', {
  id: text('id').primaryKey(),
  territoryDescription: text('territory_description').notNull(),
  regionId: integer('region_id').references(() => nwRegions.id),
});

// Shippers
export const nwShippers = pgTable('nw_shippers', {
  id: serial('id').primaryKey(),
  companyName: text('company_name').notNull(),
  phone: text('phone'),
});

// Orders
export const nwOrders = pgTable('nw_orders', {
  id: serial('id').primaryKey(),
  customerId: uuid('customer_id').references(() => sampleCustomers.id),
  employeeId: uuid('employee_id').references(() => sampleEmployees.id),
  orderDate: date('order_date'),
  requiredDate: date('required_date'),
  shippedDate: date('shipped_date'),
  shipperId: integer('shipper_id').references(() => nwShippers.id),
  freight: decimal('freight', { precision: 10, scale: 2 }),
  shipName: text('ship_name'),
  shipAddress: text('ship_address'),
  shipCity: text('ship_city'),
  shipRegion: text('ship_region'),
  shipPostalCode: text('ship_postal_code'),
  shipCountry: text('ship_country'),
}, (table) => ({
  customerIdx: index('idx_nw_orders_customer').on(table.customerId),
  employeeIdx: index('idx_nw_orders_employee').on(table.employeeId),
}));

// Order Details
export const nwOrderDetails = pgTable('nw_order_details', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => nwOrders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => nwProducts.id),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
  quantity: integer('quantity'),
  discount: decimal('discount', { precision: 4, scale: 2 }).default('0'),
}, (table) => ({
  orderIdx: index('idx_nw_order_details_order').on(table.orderId),
  productIdx: index('idx_nw_order_details_product').on(table.productId),
}));

// ============================================
// SAMPLE DATA TABLES (referenced by Northwind)
// ============================================

// Sample Customers
export const sampleCustomers = pgTable('sample_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  company: text('company'),
  segment: text('segment'),
  industry: text('industry'),
  annualRevenue: decimal('annual_revenue', { precision: 15, scale: 2 }),
  employeeCount: integer('employee_count'),
  lifetimeValue: decimal('lifetime_value', { precision: 15, scale: 2 }),
  healthScore: integer('health_score'),
  churnRisk: text('churn_risk'),
  createdAt: timestamp('created_at').defaultNow(),
  lastActivity: timestamp('last_activity'),
});

// Sample Employees
export const sampleEmployees = pgTable('sample_employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  department: text('department'),
  title: text('title'),
  managerId: uuid('manager_id'),
  hireDate: date('hire_date'),
  salary: decimal('salary', { precision: 10, scale: 2 }),
  status: text('status'),
});

// Sample Opportunities
export const sampleOpportunities = pgTable('sample_opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  customerId: uuid('customer_id').references(() => sampleCustomers.id),
  stage: text('stage'),
  amount: decimal('amount', { precision: 15, scale: 2 }),
  probability: integer('probability'),
  closeDate: date('close_date'),
  owner: text('owner'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sample Tickets
export const sampleTickets = pgTable('sample_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject: text('subject').notNull(),
  customerId: uuid('customer_id').references(() => sampleCustomers.id),
  priority: text('priority'),
  status: text('status'),
  category: text('category'),
  createdAt: timestamp('created_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  slaMet: boolean('sla_met'),
});

// Sample Products
export const sampleProducts = pgTable('sample_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sku: text('sku').unique(),
  category: text('category'),
  price: decimal('price', { precision: 10, scale: 2 }),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  stockQuantity: integer('stock_quantity'),
  reorderPoint: integer('reorder_point'),
  status: text('status'),
});

// Sample Transactions
export const sampleTransactions = pgTable('sample_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type'),
  category: text('category'),
  amount: decimal('amount', { precision: 15, scale: 2 }),
  description: text('description'),
  date: date('date'),
  department: text('department'),
});

// ============================================
// PUBLIC DATA TABLES
// ============================================

// Economic Indicators (from FRED API)
export const economicIndicators = pgTable('economic_indicators', {
  id: uuid('id').primaryKey().defaultRandom(),
  indicator: text('indicator').notNull(),      // GDP, UNEMPLOYMENT, CPI, INTEREST_RATE, etc.
  indicatorName: text('indicator_name'),        // Human-readable name
  value: real('value').notNull(),
  date: date('date').notNull(),
  source: text('source').default('FRED'),
  unit: text('unit'),                           // Percent, Billions USD, Index, etc.
  frequency: text('frequency'),                 // Monthly, Quarterly, Annual
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  indicatorIdx: index('idx_economic_indicators_indicator').on(table.indicator),
  dateIdx: index('idx_economic_indicators_date').on(table.date),
}));

// Public Companies (from Yahoo Finance)
export const publicCompanies = pgTable('public_companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticker: text('ticker').notNull().unique(),
  name: text('name').notNull(),
  sector: text('sector'),
  industry: text('industry'),
  marketCap: real('market_cap'),
  peRatio: real('pe_ratio'),
  revenue: real('revenue'),
  netIncome: real('net_income'),
  employees: integer('employees'),
  country: text('country'),
  website: text('website'),
  description: text('description'),
  lastPrice: real('last_price'),
  priceChange: real('price_change'),
  priceChangePercent: real('price_change_percent'),
  lastUpdated: timestamp('last_updated').defaultNow(),
  metadata: jsonb('metadata'),
}, (table) => ({
  tickerIdx: index('idx_public_companies_ticker').on(table.ticker),
  sectorIdx: index('idx_public_companies_sector').on(table.sector),
  industryIdx: index('idx_public_companies_industry').on(table.industry),
}));

// Industry Statistics (from Census Bureau)
export const industryStatistics = pgTable('industry_statistics', {
  id: uuid('id').primaryKey().defaultRandom(),
  naicsCode: text('naics_code').notNull(),
  naicsTitle: text('naics_title').notNull(),
  year: integer('year').notNull(),
  establishments: integer('establishments'),
  employment: integer('employment'),
  annualPayroll: real('annual_payroll'),          // In thousands USD
  averageWage: real('average_wage'),              // Per employee
  state: text('state'),                           // NULL for national data
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  naicsIdx: index('idx_industry_statistics_naics').on(table.naicsCode),
  yearIdx: index('idx_industry_statistics_year').on(table.year),
  stateIdx: index('idx_industry_statistics_state').on(table.state),
}));

// ============================================
// CHAT AGENT EVENTS & EVALUATIONS
// ============================================

// Chat Agent Events (for trace/debug display)
export const chatAgentEvents = pgTable('chat_agent_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull(),
  idx: integer('idx').notNull(),
  eventType: text('event_type').notNull(),
  agentId: text('agent_id'),
  message: text('message'),
  label: text('label'),
  level: text('level'),
  payloadJson: jsonb('payload_json'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  runIdIdx: index('idx_chat_agent_events_run_id').on(table.runId),
  createdAtIdx: index('idx_chat_agent_events_created_at').on(table.createdAt),
}));

// Chat Evaluations (response quality metrics)
export const chatEvaluations = pgTable('chat_evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  turnId: uuid('turn_id').notNull(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  qualityScore: real('quality_score'),
  relevanceScore: real('relevance_score'),
  groundednessScore: real('groundedness_score'),
  coherenceScore: real('coherence_score'),
  completenessScore: real('completeness_score'),
  hallucinationDetected: boolean('hallucination_detected'),
  judgeReasoning: text('judge_reasoning'),
  citationCoverage: real('citation_coverage'),
  contextUtilization: real('context_utilization'),
  evaluationLatencyMs: integer('evaluation_latency_ms'),
  evaluationCostUsd: real('evaluation_cost_usd'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  turnIdIdx: index('idx_chat_evaluations_turn_id').on(table.turnId),
  sessionIdIdx: index('idx_chat_evaluations_session_id').on(table.sessionId),
}));

// Types
export type User = typeof users.$inferSelect;
export type SessionFolder = typeof sessionFolders.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type SessionMemoryFact = typeof sessionMemoryFacts.$inferSelect;
export type UserMemoryFact = typeof userMemory.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type UserMemoryItem = typeof userMemories.$inferSelect;
export type DomainAgent = typeof domainAgents.$inferSelect;
export type AgentDataSource = typeof agentDataSources.$inferSelect;
export type ModelConfig = typeof modelConfigs.$inferSelect;
export type EtlJob = typeof etlJobs.$inferSelect;
export type EtlKnowledge = typeof etlKnowledge.$inferSelect;
export type FileUpload = typeof fileUploads.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type GeneratedImage = typeof generatedImages.$inferSelect;
export type OpenaiFile = typeof openaiFiles.$inferSelect;
export type KnowledgeGraphNode = typeof knowledgeGraphNodes.$inferSelect;
export type KnowledgeGraphEdge = typeof knowledgeGraphEdges.$inferSelect;
export type SemanticEntity = typeof semanticEntities.$inferSelect;
export type EntityAlias = typeof entityAliases.$inferSelect;
export type EtlJobRun = typeof etlJobRuns.$inferSelect;
export type DataSource = typeof dataSources.$inferSelect;
export type DataSourceAgent = typeof dataSourceAgents.$inferSelect;
export type NwCategory = typeof nwCategories.$inferSelect;
export type NwSupplier = typeof nwSuppliers.$inferSelect;
export type NwProduct = typeof nwProducts.$inferSelect;
export type NwRegion = typeof nwRegions.$inferSelect;
export type NwTerritory = typeof nwTerritories.$inferSelect;
export type NwShipper = typeof nwShippers.$inferSelect;
export type NwOrder = typeof nwOrders.$inferSelect;
export type NwOrderDetail = typeof nwOrderDetails.$inferSelect;
export type SampleCustomer = typeof sampleCustomers.$inferSelect;
export type SampleEmployee = typeof sampleEmployees.$inferSelect;
export type SampleOpportunity = typeof sampleOpportunities.$inferSelect;
export type SampleTicket = typeof sampleTickets.$inferSelect;
export type SampleProduct = typeof sampleProducts.$inferSelect;
export type SampleTransaction = typeof sampleTransactions.$inferSelect;
export type ChatAgentEvent = typeof chatAgentEvents.$inferSelect;
export type ChatEvaluation = typeof chatEvaluations.$inferSelect;
export type EconomicIndicator = typeof economicIndicators.$inferSelect;
export type PublicCompany = typeof publicCompanies.$inferSelect;
export type IndustryStatistic = typeof industryStatistics.$inferSelect;
