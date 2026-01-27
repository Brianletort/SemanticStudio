-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Folders (for organizing chat sessions)
CREATE TABLE IF NOT EXISTS session_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  summary_text TEXT,
  summary_embedding VECTOR(1536),
  -- Pinning support
  is_pinned BOOLEAN DEFAULT false,
  pinned_at TIMESTAMPTZ,
  -- Folder organization
  folder_id UUID REFERENCES session_folders(id) ON DELETE SET NULL
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Progressive summarization fields
  compression_level TEXT DEFAULT 'full' CHECK (compression_level IN ('full', 'compressed', 'archived')),
  compressed_content TEXT,
  token_count INTEGER
);

-- Session Memory Facts
CREATE TABLE IF NOT EXISTS session_memory_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  importance FLOAT DEFAULT 0.5,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Memory (long-term)
CREATE TABLE IF NOT EXISTS user_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  importance FLOAT DEFAULT 0.5,
  source_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domain Agents
CREATE TABLE IF NOT EXISTS domain_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'experimental')),
  config JSONB DEFAULT '{}',
  schema_tables TEXT[] DEFAULT '{}',
  system_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Data Sources
CREATE TABLE IF NOT EXISTS agent_data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES domain_agents(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('table', 'view', 'api', 'file', 'vector')),
  source_name TEXT NOT NULL,
  source_config JSONB DEFAULT '{}',
  embedding_table TEXT,
  -- Retrieval configuration for this data source
  retrieval_config JSONB DEFAULT '{
    "enableSqlQueries": true,
    "enableSemanticSearch": true,
    "searchBackend": "postgres",
    "searchMode": "hybrid",
    "azureIndexName": null,
    "maxResults": 10,
    "similarityThreshold": 0.7
  }',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Configurations
CREATE TABLE IF NOT EXISTS model_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  fallback_provider TEXT,
  fallback_model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ETL Jobs
CREATE TABLE IF NOT EXISTS etl_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES domain_agents(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  config JSONB DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ETL Knowledge Base (for self-learning)
CREATE TABLE IF NOT EXISTS etl_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern TEXT NOT NULL,
  success_rate FLOAT DEFAULT 0.0,
  lessons_learned TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- File Uploads
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'embedded', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Chunks (for RAG)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES domain_agents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Images
CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  revised_prompt TEXT,
  image_url TEXT NOT NULL,
  model TEXT NOT NULL,
  size TEXT,
  quality TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_folders_user_id ON session_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_is_pinned ON sessions(is_pinned);
CREATE INDEX IF NOT EXISTS idx_sessions_folder_id ON sessions(folder_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_session_memory_facts_session_id ON session_memory_facts(session_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_agents_category ON domain_agents(category);
CREATE INDEX IF NOT EXISTS idx_domain_agents_status ON domain_agents(status);
CREATE INDEX IF NOT EXISTS idx_etl_jobs_agent_id ON etl_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_etl_jobs_status ON etl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_file_id ON document_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_agent_id ON document_chunks(agent_id);

-- Vector indexes for similarity search
CREATE INDEX IF NOT EXISTS idx_sessions_summary_embedding ON sessions USING ivfflat (summary_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_session_memory_facts_embedding ON session_memory_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_user_memory_embedding ON user_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Insert default model configurations (GPT-5.2 series)
-- gpt-5.2: Main reasoning model (standard tasks)
-- gpt-5.2-pro: Complex reasoning (deep mode)
-- gpt-5-mini: Cost-optimized (quick tasks, background operations)
-- o3-deep-research: Research mode (long-form analysis)
INSERT INTO model_configs (role, provider, model_name, config) VALUES
  ('composer', 'openai', 'gpt-5.2', '{"temperature": 0.7, "max_tokens": 4096}'),
  ('composer_fast', 'openai', 'gpt-5-mini', '{"temperature": 0.7, "max_tokens": 2048}'),
  ('planner', 'openai', 'gpt-5-mini', '{"temperature": 0.3, "max_tokens": 1024}'),
  ('reflection', 'openai', 'gpt-5.2', '{"temperature": 0.5, "max_tokens": 2048}'),
  ('mode_classifier', 'openai', 'gpt-5-mini', '{"temperature": 0.1, "max_tokens": 256}'),
  ('memory_extractor', 'openai', 'gpt-5-mini', '{"temperature": 0.3, "max_tokens": 1024}'),
  ('embeddings', 'openai', 'text-embedding-3-large', '{"dimensions": 1536}'),
  ('image_generation', 'openai', 'gpt-image-1.5', '{"size": "1024x1024", "quality": "medium"}'),
  ('research', 'openai', 'o3-deep-research', '{"temperature": 0.7, "max_tokens": 16384}')
ON CONFLICT (role) DO NOTHING;

-- Insert default user for development
INSERT INTO users (id, email, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'dev@semanticstudio.local', 'Development User')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- USER SETTINGS & MEMORIES
-- ============================================

-- User Settings (profile, preferences, personalization, memory configuration)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  nickname TEXT,
  occupation TEXT,
  about_me TEXT,
  conversation_style TEXT DEFAULT 'professional' CHECK (conversation_style IN ('professional', 'friendly', 'candid', 'efficient', 'quirky', 'nerdy', 'cynical')),
  characteristics JSONB DEFAULT '{"use_emojis": false, "use_headers": true, "enthusiastic": false, "formal": false, "detailed": true}',
  -- Memory configuration
  memory_enabled BOOLEAN DEFAULT true,
  reference_saved_memories BOOLEAN DEFAULT true,
  reference_chat_history BOOLEAN DEFAULT true,
  auto_save_memories BOOLEAN DEFAULT false,
  memory_extraction_mode TEXT DEFAULT 'balanced' CHECK (memory_extraction_mode IN ('conservative', 'balanced', 'aggressive')),
  max_memories_in_context INTEGER DEFAULT 10,
  include_session_summaries BOOLEAN DEFAULT false,
  -- Chat organization
  max_pinned_sessions INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Memories (ChatGPT-style long-term memories)
CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'user' CHECK (source IN ('user', 'chat', 'system')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user settings and memories
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_active ON user_memories(user_id, is_active) WHERE is_active = true;

-- Insert default settings for development user
INSERT INTO user_settings (user_id, theme, conversation_style) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system', 'professional')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- KNOWLEDGE GRAPH TABLES
-- ============================================

-- Knowledge Graph Nodes
CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL, -- customer, product, employee, opportunity, department, etc.
  name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  embedding VECTOR(1536),
  importance_score FLOAT DEFAULT 0.5,
  source_table TEXT, -- Which table this node came from
  source_id TEXT, -- Original ID in source table
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Graph Edges
CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  target_id UUID REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- WORKS_FOR, PURCHASED, MANAGES, BELONGS_TO, etc.
  weight FLOAT DEFAULT 1.0,
  confidence FLOAT DEFAULT 1.0,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTEXT REFERENCES (Bridge Layer)
-- ============================================
-- Links user context (sessions, facts) to domain knowledge graph
-- Enables cross-graph queries like "What did I discuss about Customer X?"
-- User-isolated: each user's context references are private

CREATE TABLE IF NOT EXISTS context_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- User isolation - required for privacy
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  -- Link to session where reference occurred
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  -- Link to knowledge graph entity
  kg_node_id UUID REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  -- Optional link to specific memory fact
  memory_fact_id UUID REFERENCES session_memory_facts(id) ON DELETE SET NULL,
  -- Type of reference: 'discussed', 'queried', 'mentioned', 'interested_in', 'analyzed'
  ref_type TEXT NOT NULL,
  -- Snippet of context (what was said about the entity)
  context TEXT,
  -- Importance score (0-1)
  importance FLOAT DEFAULT 0.5,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SEMANTIC LAYER TABLES
-- ============================================

-- Semantic Entities Registry
CREATE TABLE IF NOT EXISTS semantic_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- customer, product, employee
  display_name TEXT NOT NULL, -- Customer, Product, Employee
  description TEXT,
  source_table TEXT NOT NULL, -- sample_customers, sample_products
  domain_agent TEXT, -- Which domain agent owns this entity
  fields JSONB DEFAULT '[]', -- Field mappings
  aliases JSONB DEFAULT '[]', -- Alternative names
  relationships JSONB DEFAULT '[]', -- FK relationships
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity Aliases for Resolution
CREATE TABLE IF NOT EXISTS entity_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID REFERENCES semantic_entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_type TEXT DEFAULT 'synonym', -- synonym, abbreviation, common_name
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ETL JOB TRACKING
-- ============================================

-- ETL Job Runs (individual executions)
CREATE TABLE IF NOT EXISTS etl_job_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES etl_jobs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  par_iterations INTEGER DEFAULT 0,
  reflexion_improvements JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DATA SOURCE MANAGEMENT
-- ============================================

-- Data Sources (extends agent_data_sources with more metadata)
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'json', 'api', 'database', 'web')),
  config JSONB DEFAULT '{}', -- Connection config, API keys, file paths
  schema_info JSONB DEFAULT '{}', -- Discovered schema
  -- Storage targets configuration (SQL table, postgres vector, azure search)
  storage_targets JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_sync_at TIMESTAMPTZ,
  sync_frequency TEXT, -- manual, hourly, daily, weekly
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Source to Agent mapping
CREATE TABLE IF NOT EXISTS data_source_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES domain_agents(id) ON DELETE CASCADE,
  access_type TEXT DEFAULT 'read' CHECK (access_type IN ('read', 'write', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data_source_id, agent_id)
);

-- ============================================
-- NORTHWIND-STYLE SAMPLE DATA TABLES
-- ============================================

-- Categories
CREATE TABLE IF NOT EXISTS nw_categories (
  id SERIAL PRIMARY KEY,
  category_name TEXT NOT NULL,
  description TEXT
);

-- Suppliers
CREATE TABLE IF NOT EXISTS nw_suppliers (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_title TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country TEXT,
  phone TEXT,
  fax TEXT,
  homepage TEXT
);

-- Products
CREATE TABLE IF NOT EXISTS nw_products (
  id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  supplier_id INTEGER REFERENCES nw_suppliers(id),
  category_id INTEGER REFERENCES nw_categories(id),
  quantity_per_unit TEXT,
  unit_price DECIMAL(10,2),
  units_in_stock INTEGER DEFAULT 0,
  units_on_order INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  discontinued BOOLEAN DEFAULT false
);

-- Regions
CREATE TABLE IF NOT EXISTS nw_regions (
  id SERIAL PRIMARY KEY,
  region_description TEXT NOT NULL
);

-- Territories
CREATE TABLE IF NOT EXISTS nw_territories (
  id TEXT PRIMARY KEY,
  territory_description TEXT NOT NULL,
  region_id INTEGER REFERENCES nw_regions(id)
);

-- Shippers
CREATE TABLE IF NOT EXISTS nw_shippers (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  phone TEXT
);

-- Orders
CREATE TABLE IF NOT EXISTS nw_orders (
  id SERIAL PRIMARY KEY,
  customer_id UUID REFERENCES sample_customers(id),
  employee_id UUID REFERENCES sample_employees(id),
  order_date DATE,
  required_date DATE,
  shipped_date DATE,
  shipper_id INTEGER REFERENCES nw_shippers(id),
  freight DECIMAL(10,2),
  ship_name TEXT,
  ship_address TEXT,
  ship_city TEXT,
  ship_region TEXT,
  ship_postal_code TEXT,
  ship_country TEXT
);

-- Order Details
CREATE TABLE IF NOT EXISTS nw_order_details (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES nw_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES nw_products(id),
  unit_price DECIMAL(10,2),
  quantity INTEGER,
  discount DECIMAL(4,2) DEFAULT 0
);

-- ============================================
-- INDEXES FOR NEW TABLES
-- ============================================

-- Knowledge Graph indexes
CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON knowledge_graph_nodes(type);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_name ON knowledge_graph_nodes(name);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_source ON knowledge_graph_nodes(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON knowledge_graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON knowledge_graph_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_type ON knowledge_graph_edges(relationship_type);

-- Context References indexes (Bridge Layer)
CREATE INDEX IF NOT EXISTS idx_context_refs_user_id ON context_references(user_id);
CREATE INDEX IF NOT EXISTS idx_context_refs_session_id ON context_references(session_id);
CREATE INDEX IF NOT EXISTS idx_context_refs_kg_node_id ON context_references(kg_node_id);
CREATE INDEX IF NOT EXISTS idx_context_refs_user_kg ON context_references(user_id, kg_node_id);

-- Semantic layer indexes
CREATE INDEX IF NOT EXISTS idx_semantic_entities_name ON semantic_entities(name);
CREATE INDEX IF NOT EXISTS idx_semantic_entities_domain ON semantic_entities(domain_agent);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias ON entity_aliases(alias);

-- ETL indexes
CREATE INDEX IF NOT EXISTS idx_etl_job_runs_job_id ON etl_job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_etl_job_runs_status ON etl_job_runs(status);

-- Data source indexes
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);

-- Northwind indexes
CREATE INDEX IF NOT EXISTS idx_nw_products_supplier ON nw_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_nw_products_category ON nw_products(category_id);
CREATE INDEX IF NOT EXISTS idx_nw_orders_customer ON nw_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_nw_orders_employee ON nw_orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_nw_order_details_order ON nw_order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_nw_order_details_product ON nw_order_details(product_id);

-- Vector index for KG nodes
CREATE INDEX IF NOT EXISTS idx_kg_nodes_embedding ON knowledge_graph_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- SEED ETL JOBS
-- ============================================

-- Insert sample ETL jobs for demo
INSERT INTO etl_jobs (job_type, status, config) VALUES
  ('csv_import', 'completed', '{"name": "Sample Customer Data Import", "targetTable": "sample_customers", "description": "Import customer data from CSV"}'),
  ('csv_import', 'completed', '{"name": "Sample Product Data Import", "targetTable": "sample_products", "description": "Import product catalog from CSV"}'),
  ('json_import', 'completed', '{"name": "Northwind Data Import", "targetTable": "nw_products", "description": "Import Northwind sample data"}'),
  ('kg_build', 'completed', '{"name": "Knowledge Graph Build", "description": "Build knowledge graph from all entities"}')
ON CONFLICT DO NOTHING;

-- ============================================
-- CHAT AGENT EVENTS & EVALUATIONS
-- ============================================

-- Chat Agent Events (for trace/debug display)
CREATE TABLE IF NOT EXISTS chat_agent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL,
  idx INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  agent_id TEXT,
  message TEXT,
  label TEXT,
  level TEXT,
  payload_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Evaluations (response quality metrics)
CREATE TABLE IF NOT EXISTS chat_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turn_id UUID NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  quality_score REAL,
  relevance_score REAL,
  groundedness_score REAL,
  coherence_score REAL,
  completeness_score REAL,
  hallucination_detected BOOLEAN,
  judge_reasoning TEXT,
  citation_coverage REAL,
  context_utilization REAL,
  evaluation_latency_ms INTEGER,
  evaluation_cost_usd REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat events and evaluations
CREATE INDEX IF NOT EXISTS idx_chat_agent_events_run_id ON chat_agent_events(run_id);
CREATE INDEX IF NOT EXISTS idx_chat_agent_events_created_at ON chat_agent_events(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_evaluations_turn_id ON chat_evaluations(turn_id);
CREATE INDEX IF NOT EXISTS idx_chat_evaluations_session_id ON chat_evaluations(session_id);

-- ============================================
-- VECTOR SEARCH FUNCTIONS FOR MEMORY SYSTEM
-- ============================================

-- Search session memory facts by semantic similarity
CREATE OR REPLACE FUNCTION search_session_facts(
  target_session_id UUID,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
) RETURNS TABLE (
  fact_id UUID,
  fact_type TEXT,
  key TEXT,
  value TEXT,
  importance REAL,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    smf.id as fact_id,
    smf.fact_type,
    smf.key,
    smf.value,
    smf.importance::REAL,
    (1 - (smf.embedding <=> query_embedding))::FLOAT as similarity
  FROM session_memory_facts smf
  WHERE smf.session_id = target_session_id
    AND smf.embedding IS NOT NULL
    AND (1 - (smf.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Search user memory facts by semantic similarity
CREATE OR REPLACE FUNCTION search_user_memory(
  target_user_id UUID,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
) RETURNS TABLE (
  memory_id UUID,
  fact_type TEXT,
  key TEXT,
  value TEXT,
  importance REAL,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    um.id as memory_id,
    um.fact_type,
    um.key,
    um.value,
    um.importance::REAL,
    (1 - (um.embedding <=> query_embedding))::FLOAT as similarity
  FROM user_memory um
  WHERE um.user_id = target_user_id
    AND um.embedding IS NOT NULL
    AND (1 - (um.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Search similar messages within a session by semantic similarity
CREATE OR REPLACE FUNCTION search_similar_messages(
  target_session_id UUID,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3
) RETURNS TABLE (
  message_id UUID,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
) AS $$
BEGIN
  -- Note: This function requires messages table to have an embedding column
  -- If embedding column doesn't exist, this will return empty results
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.role,
    m.content,
    m.created_at,
    0.0::FLOAT as similarity  -- Placeholder until messages have embeddings
  FROM messages m
  WHERE m.session_id = target_session_id
  ORDER BY m.created_at DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Search sessions by summary embedding similarity
CREATE OR REPLACE FUNCTION search_similar_sessions(
  target_user_id UUID,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
) RETURNS TABLE (
  session_id UUID,
  title TEXT,
  summary_text TEXT,
  similarity FLOAT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.title,
    s.summary_text,
    (1 - (s.summary_embedding <=> query_embedding))::FLOAT as similarity,
    s.updated_at
  FROM sessions s
  WHERE s.user_id = target_user_id
    AND s.summary_embedding IS NOT NULL
    AND (1 - (s.summary_embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
