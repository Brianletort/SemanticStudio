# SemanticStudio Chat System Architecture

This document describes the architecture of the SemanticStudio multi-agent chat system, including its configurable modes, extensible domain agents, and the complete request flow.

## Table of Contents

- [System Overview](#system-overview)
- [High-Level Architecture](#high-level-architecture)
- [Chat Modes](#chat-modes)
- [Domain Agents](#domain-agents)
- [Configuration System](#configuration-system)
- [Adding New Domain Agents](#adding-new-domain-agents)
- [Event System](#event-system)
- [Key Files Reference](#key-files-reference)

---

## System Overview

SemanticStudio is a fully configurable, multi-agent chat platform designed for enterprise data access. Key features:

- **4 Chat Modes**: quick, think, deep, research - each with different depth/speed tradeoffs
- **28 Default Domain Agents**: Covering 6 business categories
- **GraphRAG-lite**: Knowledge graph traversal for relationship discovery
- **3-Tier Memory System**: Working context, session memory, and long-term memory
- **Extensible Architecture**: Add unlimited domain agents via API or Admin UI
- **Multi-Provider LLM Support**: OpenAI, Anthropic, Ollama

---

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client [Client Layer]
        UI[Chat UI]
        Admin[Admin Panel]
    end

    subgraph API [API Layer]
        ChatAPI["/api/chat"]
        AgentsAPI["/api/agents"]
        ModelsAPI["/api/models"]
        SettingsAPI["/api/settings"]
    end

    subgraph Orchestration [Orchestration Layer]
        ModeClassifier[Mode Classifier]
        Orchestrator[Pipeline Orchestrator]
        EventBus[Event Bus]
    end

    subgraph Retrieval [Retrieval Layer]
        EntityResolver[Entity Resolver]
        DomainRetriever[Domain Retriever]
        GraphRAG[GraphRAG-lite]
        WebSearch[Web Search]
    end

    subgraph Agents [Domain Agents]
        CustomerAgents[Customer Domain]
        ProductAgents[Product Domain]
        OpsAgents[Operations Domain]
        FinanceAgents[Finance Domain]
        PeopleAgents[People Domain]
        IntelAgents[Intelligence Domain]
    end

    subgraph Memory [Memory System]
        Tier1[Tier 1: Working Context]
        Tier2[Tier 2: Session Memory]
        Tier3[Tier 3: Long-term Memory]
    end

    subgraph Composition [Composition Layer]
        LLMComposer[LLM Composer]
        Reflection[Reflection Agent]
        Judge[LLM Judge]
    end

    subgraph Storage [Storage Layer]
        PostgreSQL[(PostgreSQL)]
        SemanticEntities[(Semantic Entities)]
        KnowledgeGraph[(Knowledge Graph)]
    end

    UI --> ChatAPI
    Admin --> AgentsAPI
    Admin --> ModelsAPI
    Admin --> SettingsAPI

    ChatAPI --> ModeClassifier
    ModeClassifier --> Orchestrator
    Orchestrator --> EventBus

    Orchestrator --> EntityResolver
    EntityResolver --> DomainRetriever
    DomainRetriever --> GraphRAG
    DomainRetriever --> WebSearch

    DomainRetriever --> CustomerAgents
    DomainRetriever --> ProductAgents
    DomainRetriever --> OpsAgents
    DomainRetriever --> FinanceAgents
    DomainRetriever --> PeopleAgents
    DomainRetriever --> IntelAgents

    Orchestrator --> Tier1
    Orchestrator --> Tier2
    Orchestrator --> Tier3

    DomainRetriever --> LLMComposer
    Memory --> LLMComposer
    LLMComposer --> Reflection
    Reflection --> Judge

    CustomerAgents --> PostgreSQL
    ProductAgents --> PostgreSQL
    OpsAgents --> PostgreSQL
    FinanceAgents --> PostgreSQL
    PeopleAgents --> PostgreSQL
    IntelAgents --> PostgreSQL

    EntityResolver --> SemanticEntities
    GraphRAG --> KnowledgeGraph
```

### Request Flow Sequence

The following sequence diagram shows the complete flow of a chat request through the system:

```mermaid
sequenceDiagram
    participant User
    participant ChatAPI as Chat API
    participant Mode as Mode Classifier
    participant Memory as Memory System
    participant Entity as Entity Resolver
    participant Domain as Domain Retriever
    participant Graph as GraphRAG-lite
    participant Web as Web Search
    participant LLM as LLM Composer
    participant Reflect as Reflection Agent
    participant Judge as LLM Judge

    User->>ChatAPI: Send query
    ChatAPI->>Mode: Classify query (if auto mode)
    Mode-->>ChatAPI: Return mode + confidence

    ChatAPI->>Memory: Retrieve relevant memories
    Memory-->>ChatAPI: Return context from tiers

    ChatAPI->>Entity: Extract entities from query
    Entity-->>ChatAPI: Return resolved entities

    ChatAPI->>Domain: Retrieve domain data
    
    loop For each detected domain
        Domain->>Domain: Query domain agent tables
    end

    alt Graph enabled (think/deep/research)
        Domain->>Graph: Expand with graph traversal
        Graph-->>Domain: Return related entities
    end

    alt Web search enabled
        ChatAPI->>Web: Search external sources
        Web-->>ChatAPI: Return web results
    end

    Domain-->>ChatAPI: Return aggregated context

    ChatAPI->>LLM: Compose response
    LLM-->>ChatAPI: Return draft response

    alt Reflection enabled (think/deep/research)
        ChatAPI->>Reflect: Analyze and improve
        Reflect-->>ChatAPI: Return improved response
    end

    ChatAPI->>Judge: Evaluate quality
    Judge-->>ChatAPI: Return scores

    ChatAPI->>Memory: Save new memories
    ChatAPI-->>User: Stream response + evaluation
```

---

## Chat Modes

SemanticStudio provides 4 chat modes, each optimized for different use cases. Users can select a mode explicitly or use "auto" mode for automatic classification.

### Mode Comparison

| Mode | Model | Max Results | Graph Hops | Memory Tiers | Reflection | Clarification |
|------|-------|-------------|------------|--------------|------------|---------------|
| **quick** | gpt-5-mini | 5 | 0 | Tier 1 | No | No |
| **think** | gpt-5.2 | 15 | 1 | Tier 1-2 | Yes | No |
| **deep** | gpt-5.2 | 30 | 2 | Tier 1-3 | Yes | No |
| **research** | o3-deep-research | 50 | 3 | Tier 1-3 | Yes | Yes |

### Mode Flow Diagram

```mermaid
flowchart LR
    subgraph Input [User Input]
        Query[User Query]
        ModeSelect[Mode Selection]
    end

    subgraph Classification [Mode Classification]
        Auto{Auto Mode?}
        Heuristics[Heuristic Analysis]
        LLMClass[LLM Classification]
        Confidence{Confidence >= 0.75?}
    end

    subgraph Modes [Chat Modes]
        Quick[Quick Mode]
        Think[Think Mode]
        Deep[Deep Mode]
        Research[Research Mode]
    end

    subgraph Config [Mode Configuration]
        QuickCfg["model: gpt-5-mini<br/>maxResults: 5<br/>graphHops: 0<br/>memory: Tier1"]
        ThinkCfg["model: gpt-5.2<br/>maxResults: 15<br/>graphHops: 1<br/>memory: Tier1-2"]
        DeepCfg["model: gpt-5.2<br/>maxResults: 30<br/>graphHops: 2<br/>memory: Tier1-3"]
        ResearchCfg["model: o3-deep-research<br/>maxResults: 50<br/>graphHops: 3<br/>clarification: true"]
    end

    Query --> Auto
    ModeSelect --> Auto

    Auto -->|Yes| Heuristics
    Auto -->|No| Think

    Heuristics --> Confidence
    Confidence -->|No| LLMClass
    Confidence -->|Yes| Quick
    Confidence -->|Yes| Think
    Confidence -->|Yes| Deep
    Confidence -->|Yes| Research

    LLMClass --> Quick
    LLMClass --> Think
    LLMClass --> Deep
    LLMClass --> Research

    Quick --> QuickCfg
    Think --> ThinkCfg
    Deep --> DeepCfg
    Research --> ResearchCfg
```

### Mode Configuration Details

Each mode has configurable parameters that can be overridden at the user level:

```typescript
interface ModeConfig {
  // Retrieval settings
  maxResults: number;           // Max chunks/rows to retrieve
  useGraph: boolean;            // Use GraphRAG-lite for domain detection
  graphHops: number;            // 0=entity match only, 1-3=relationship expansion
  webResultsIfEnabled: number;  // Web results when toggle is on
  
  // Memory settings
  memoryTiers: MemoryTier[];    // Which memory tiers to use ['tier1', 'tier2', 'tier3']
  
  // Pipeline settings
  enableReflection: boolean;    // Run reflection agent
  enableClarification: boolean; // Run clarification (research mode only)
  
  // Model settings
  composerRole: string;         // Which model role for composition
  
  // Display settings
  showEvaluationByDefault: boolean; // Show evaluation card in UI
}
```

### Auto Mode Classification

When "auto" mode is selected, the system classifies queries using:

1. **Heuristic Analysis** (fast path):
   - Pattern matching for simple questions vs complex analysis
   - Domain counting to estimate scope
   - Keyword detection for research indicators

2. **LLM Classification** (if confidence < 0.75):
   - Full semantic analysis of query intent
   - Returns recommended mode with reasoning

```typescript
interface ModeClassification {
  recommendedMode: 'quick' | 'think' | 'deep' | 'research';
  confidence: number;        // 0-1 confidence score
  reasoning: string;         // Explanation for UI
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDomains: string[]; // Detected domain areas
}
```

---

## Domain Agents

Domain agents are specialized data access components that understand specific business domains. The system is designed to support unlimited domain agents, dynamically loaded from the database.

### Domain Agent Architecture

```mermaid
flowchart TB
    subgraph Registry [Agent Registry - PostgreSQL]
        AgentTable[(domain_agents table)]
        EntityTable[(semantic_entities table)]
        DataSources[(data_sources table)]
    end

    subgraph Categories [Agent Categories]
        subgraph Customer [Customer Domain]
            C1[Customer Agent]
            C2[Sales Agent]
            C3[Support Agent]
            C4[Success Agent]
            C5[Marketing Agent]
        end

        subgraph Product [Product Domain]
            P1[Product Mgmt Agent]
            P2[Engineering Agent]
            P3[QA Agent]
            P4[Design Agent]
            P5[Analytics Agent]
        end

        subgraph Operations [Operations Domain]
            O1[Operations Agent]
            O2[Supply Chain Agent]
            O3[Inventory Agent]
            O4[Procurement Agent]
            O5[Facilities Agent]
        end

        subgraph Finance [Finance Domain]
            F1[Finance Agent]
            F2[Accounting Agent]
            F3[Legal Agent]
            F4[Compliance Agent]
            F5[Risk Mgmt Agent]
        end

        subgraph People [People Domain]
            H1[HR Agent]
            H2[Talent Agent]
            H3[L&D Agent]
            H4[IT Support Agent]
            H5[Comms Agent]
        end

        subgraph Intelligence [Intelligence Domain]
            I1[Competitive Intel]
            I2[Business Intel]
            I3[Strategic Planning]
        end
    end

    subgraph Semantic [Semantic Layer]
        Entities[Semantic Entities]
        Aliases[Entity Aliases]
        Relationships[FK Relationships]
    end

    AgentTable --> Customer
    AgentTable --> Product
    AgentTable --> Operations
    AgentTable --> Finance
    AgentTable --> People
    AgentTable --> Intelligence

    EntityTable --> Entities
    Entities --> Aliases
    Entities --> Relationships

    Customer --> Entities
    Product --> Entities
    Operations --> Entities
    Finance --> Entities
    People --> Entities
    Intelligence --> Entities
```

### Default Domain Agents (28 Total)

| Category | Agents | Description |
|----------|--------|-------------|
| **Customer** | Customer, Sales, Customer Support, Customer Success, Marketing | Customer-facing data: profiles, pipeline, tickets, health scores, campaigns |
| **Product** | Product Management, Engineering, QA, Design, Data Analytics | Product development: roadmap, sprints, bugs, designs, reports |
| **Operations** | Operations, Supply Chain, Inventory, Procurement, Facilities | Business operations: KPIs, suppliers, stock, vendors, locations |
| **Finance** | Finance, Accounting, Legal, Compliance, Risk Management | Financial data: budgets, GL, contracts, policies, risk register |
| **People** | HR, Talent Acquisition, L&D, IT Support, Communications | People operations: employees, recruiting, training, assets, announcements |
| **Intelligence** | Competitive Intel, Business Intel, Strategic Planning | Cross-domain: competitors, analytics, OKRs |

### Agent Data Model

```typescript
interface DomainAgent {
  id: string;                    // UUID
  name: string;                  // Unique identifier (e.g., "customer", "sales")
  displayName: string;           // Human-readable name
  description: string;           // Agent purpose
  category: AgentCategory;       // One of 6 categories
  status: 'active' | 'inactive' | 'experimental';
  config: Record<string, any>;   // Agent-specific configuration
  schemaTables?: string[];       // Associated database tables
  systemPrompt?: string;         // Custom system prompt
  createdAt: Date;
  updatedAt: Date;
}

type AgentCategory = 
  | 'customer' 
  | 'product' 
  | 'operations' 
  | 'finance' 
  | 'people' 
  | 'intelligence';
```

### Semantic Entity Mapping

Each domain agent is linked to semantic entities that define its data access:

```typescript
interface SemanticEntity {
  id: string;
  name: string;                  // Entity identifier
  displayName: string;           // Human-readable name
  description: string;
  sourceTable: string;           // Database table name
  domainAgent: string;           // Owning agent name
  fields: FieldMapping[];        // Column mappings
  aliases: string[];             // Alternative names for entity resolution
  relationships: Relationship[]; // FK relationships to other entities
  status: 'active' | 'inactive';
}
```

### How Domain Agents Process Queries

```mermaid
sequenceDiagram
    participant Query as User Query
    participant Resolver as Entity Resolver
    participant Retriever as Domain Retriever
    participant Agent as Domain Agent
    participant DB as PostgreSQL
    participant Graph as Knowledge Graph

    Query->>Resolver: Extract entities
    Resolver->>Resolver: Match aliases
    Resolver-->>Retriever: Resolved entities with domains

    loop For each domain
        Retriever->>Agent: Activate domain agent
        Agent->>DB: Query source tables
        DB-->>Agent: Return rows
        Agent-->>Retriever: Domain results
    end

    alt Graph traversal enabled
        Retriever->>Graph: Expand relationships
        Graph-->>Retriever: Related entities
    end

    Retriever-->>Query: Aggregated context
```

---

## Configuration System

SemanticStudio uses a 3-layer configuration system that allows customization at multiple levels.

### Configuration Hierarchy

```mermaid
flowchart TB
    subgraph Layer1 [Layer 1: Environment Variables]
        ENV[".env.local"]
        DB_URL["DATABASE_URL"]
        LLM_KEYS["LLM API Keys"]
        SEARCH_KEYS["Search API Keys"]
        DEFAULTS["Default Provider Settings"]
    end

    subgraph Layer2 [Layer 2: Database Configuration]
        ModelConfigs["model_configs table"]
        UserSettings["user_settings table"]
        AgentConfigs["domain_agents.config"]
    end

    subgraph Layer3 [Layer 3: Runtime Overrides]
        ModeOverrides["Per-Mode Overrides"]
        SessionConfig["Session-level Config"]
        RequestParams["Request Parameters"]
    end

    subgraph Resolved [Resolved Configuration]
        Final["Final Config for Request"]
    end

    ENV --> Layer2
    Layer2 --> Layer3
    Layer3 --> Final

    DB_URL --> ModelConfigs
    LLM_KEYS --> ModelConfigs
    DEFAULTS --> UserSettings
```

### Layer 1: Environment Variables

Environment variables provide base configuration for infrastructure and API access.

```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5433/semanticstudio

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_LLM_PROVIDER=openai    # openai | anthropic | ollama

# Search Providers
BRAVE_API_KEY_AI_GROUNDING=...
AZURE_SEARCH_ENDPOINT=https://...search.windows.net
AZURE_SEARCH_API_KEY=...

# Optional Features
ENABLE_WEB_SEARCH=true
ENABLE_IMAGE_GENERATION=true
```

### Layer 2: Database Configuration

Database tables store persistent configuration that can be managed via the Admin UI.

#### Model Configurations (`model_configs` table)

Configure which models are used for different roles in the system:

| Role | Description | Default Model |
|------|-------------|---------------|
| `composer` | Main response generation (think/deep modes) | gpt-5.2 |
| `composer_fast` | Quick mode responses | gpt-5-mini |
| `research` | Research mode (long-form analysis) | o3-deep-research |
| `planner` | Query planning | gpt-5-mini |
| `reflection` | Response improvement | gpt-5.2 |
| `mode_classifier` | Auto mode detection | gpt-5-mini |
| `memory_extractor` | Memory fact extraction | gpt-5-mini |
| `embeddings` | Vector embeddings | text-embedding-3-large |
| `image_generation` | Image creation | gpt-image-1.5 |

```typescript
interface ModelConfig {
  id: string;
  role: string;           // Role identifier
  provider: string;       // openai | anthropic | ollama
  model: string;          // Model name
  temperature: number;    // 0-2
  maxTokens: number;
  systemPrompt?: string;  // Role-specific system prompt
}
```

#### User Settings (`user_settings` table)

Per-user customization of the chat experience:

```typescript
interface UserSettings {
  userId: string;
  
  // Mode configuration overrides
  modeConfigOverrides?: {
    quick?: Partial<ModeConfig>;
    think?: Partial<ModeConfig>;
    deep?: Partial<ModeConfig>;
    research?: Partial<ModeConfig>;
  };
  
  // Memory tier settings
  memoryTierConfig?: {
    tier1WorkingContext: boolean;   // Default: true
    tier2SessionMemory: boolean;    // Default: true  
    tier3LongTermMemory: boolean;   // Default: true
  };
  
  // Pipeline settings
  pipelineConfig?: {
    enableReflection: boolean;      // Default: true
    enableClarification: boolean;   // Default: true
    showEvaluationInChat: boolean;  // Default: true
    autoModeDefault: ChatMode;      // Default: 'think'
  };
  
  // Feature toggles
  memoryEnabled: boolean;           // Default: true
  autoSaveMemories: boolean;        // Default: true
  webSearchEnabled: boolean;        // Default: true
}
```

### Layer 3: Runtime Overrides

Configuration can be overridden at request time:

```typescript
// Chat API request body
interface ChatRequest {
  message: string;
  sessionId: string;
  
  // Mode override
  mode?: 'auto' | 'quick' | 'think' | 'deep' | 'research';
  
  // Feature toggles for this request
  webSearchEnabled?: boolean;
  memoryEnabled?: boolean;
  
  // Advanced overrides
  modeConfig?: Partial<ModeConfig>;
}
```

### Configuration Resolution

The final configuration is resolved by merging all layers:

```typescript
function resolveConfig(userId: string, request: ChatRequest): ResolvedConfig {
  // 1. Start with environment defaults
  const base = getEnvDefaults();
  
  // 2. Apply database configuration
  const userSettings = await getUserSettings(userId);
  const modeOverrides = userSettings.modeConfigOverrides?.[request.mode];
  
  // 3. Apply runtime overrides
  const resolved = {
    ...DEFAULT_MODE_CONFIGS[request.mode],
    ...modeOverrides,
    ...request.modeConfig,
  };
  
  return resolved;
}
```

---

## Adding New Domain Agents

The system is designed for easy extension. New domain agents can be added without code changes using the Admin UI or API.

### Extension Architecture

```mermaid
flowchart LR
    subgraph Methods [Creation Methods]
        AdminUI[Admin UI<br/>/admin/agents]
        API[REST API<br/>POST /api/agents]
        SQL[Direct SQL<br/>INSERT INTO domain_agents]
    end

    subgraph Steps [Setup Steps]
        Step1[1. Create Agent Record]
        Step2[2. Register Semantic Entities]
        Step3[3. Link Data Sources]
        Step4[4. Configure Retrieval]
    end

    subgraph Result [Result]
        Active[Active Domain Agent]
        Queries[Handles User Queries]
        Events[Emits Trace Events]
    end

    AdminUI --> Step1
    API --> Step1
    SQL --> Step1

    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
    Step4 --> Active

    Active --> Queries
    Active --> Events
```

### Step 1: Create Agent Record

**Option A: Admin UI**

Navigate to `/admin/agents` and click "Create Agent":
- Name: Unique identifier (e.g., `my_custom_agent`)
- Display Name: Human-readable name
- Description: What the agent handles
- Category: Select from 6 categories
- Status: active, inactive, or experimental
- System Prompt: Custom instructions for this agent

**Option B: REST API**

```bash
POST /api/agents
Content-Type: application/json

{
  "name": "inventory_forecasting",
  "displayName": "Inventory Forecasting",
  "description": "Predictive inventory analysis and demand forecasting",
  "category": "operations",
  "status": "active",
  "systemPrompt": "You are an inventory forecasting specialist...",
  "config": {
    "enablePredictions": true,
    "forecastHorizonDays": 90
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "inventory_forecasting",
  "displayName": "Inventory Forecasting",
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Step 2: Register Semantic Entities

Link database tables to your agent by creating semantic entities:

```bash
POST /api/semantic-entities
Content-Type: application/json

{
  "name": "forecast",
  "displayName": "Inventory Forecast",
  "description": "Predicted inventory levels and demand",
  "sourceTable": "inventory_forecasts",
  "domainAgent": "inventory_forecasting",
  "fields": [
    { "name": "product_id", "displayName": "Product", "type": "reference" },
    { "name": "forecast_date", "displayName": "Date", "type": "date" },
    { "name": "predicted_demand", "displayName": "Predicted Demand", "type": "number" },
    { "name": "confidence", "displayName": "Confidence", "type": "number" }
  ],
  "aliases": ["prediction", "demand forecast", "inventory prediction"],
  "relationships": [
    { "targetEntity": "product", "type": "many_to_one", "foreignKey": "product_id" }
  ]
}
```

### Step 3: Link Data Sources (Optional)

Configure how the agent retrieves data:

```bash
POST /api/agents/{agentId}/data-sources
Content-Type: application/json

{
  "sourceType": "table",
  "sourceName": "inventory_forecasts",
  "retrievalConfig": {
    "enableSqlQueries": true,
    "enableSemanticSearch": true,
    "maxResults": 20,
    "defaultOrderBy": "forecast_date DESC"
  }
}
```

### Step 4: Configure Retrieval Behavior

Customize how your agent participates in queries:

```typescript
// Agent config options
{
  // Retrieval settings
  "maxResultsOverride": 25,        // Override mode default
  "alwaysInclude": false,          // Include in all queries
  "requireExplicitMention": true,  // Only activate when mentioned
  
  // Context building
  "contextTemplate": "Forecast data:\n{results}",
  "summarizeResults": true,
  
  // Graph integration
  "graphEnabled": true,
  "relationshipDepth": 2
}
```

### Complete Example: Custom Agent

Here's a complete example of adding a "Sustainability" domain agent:

```bash
# 1. Create the agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sustainability",
    "displayName": "Sustainability",
    "description": "Environmental metrics, carbon footprint, and ESG data",
    "category": "operations",
    "status": "active",
    "systemPrompt": "You are a sustainability and ESG specialist. Help users understand environmental impact metrics, carbon emissions, and sustainability initiatives."
  }'

# 2. Create the database table (if needed)
psql $DATABASE_URL <<EOF
CREATE TABLE sustainability_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  unit TEXT,
  category TEXT, -- emissions, water, waste, energy
  reporting_period DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
EOF

# 3. Register semantic entities
curl -X POST http://localhost:3000/api/semantic-entities \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sustainability_metric",
    "displayName": "Sustainability Metric",
    "sourceTable": "sustainability_metrics",
    "domainAgent": "sustainability",
    "aliases": ["ESG", "carbon footprint", "emissions", "environmental metric"],
    "fields": [
      {"name": "metric_name", "displayName": "Metric", "type": "text"},
      {"name": "metric_value", "displayName": "Value", "type": "number"},
      {"name": "category", "displayName": "Category", "type": "text"}
    ]
  }'
```

Now queries like "What are our carbon emissions?" will automatically route to the Sustainability agent.

---

## Event System

The chat system emits 15+ event types for tracing and debugging. Events are streamed to the frontend via Server-Sent Events (SSE).

### Event Categories

```mermaid
flowchart TB
    subgraph Lifecycle [Agent Lifecycle]
        E1[agent_started]
        E2[agent_progress]
        E3[agent_finished]
    end

    subgraph Mode [Mode Events]
        E4[mode_classified]
        E5[mode_selected]
        E6[pipeline_started]
        E7[pipeline_complete]
    end

    subgraph Retrieval [Retrieval Events]
        E8[retrieval_started]
        E9[retrieval_complete]
        E10[domain_agent_started]
        E11[domain_agent_complete]
    end

    subgraph Graph [Graph Events]
        E12[graph_traversal_started]
        E13[graph_traversal_complete]
    end

    subgraph Memory [Memory Events]
        E14[memory_retrieved]
        E15[memory_saved]
    end

    subgraph Quality [Quality Events]
        E16[reflection_started]
        E17[reflection_complete]
        E18[judge_evaluation]
    end
```

### Event Payload Examples

```typescript
// Domain agent activation
{
  type: 'domain_agent_started',
  runId: 'run_abc123',
  agentId: 'domain_customer',
  domain: 'customer',
  query: 'Show me customer segments...',
  timestamp: 1705312345678
}

// Retrieval completion
{
  type: 'domain_agent_complete',
  runId: 'run_abc123',
  agentId: 'domain_customer',
  domain: 'customer',
  resultsCount: 15,
  durationMs: 234
}

// Quality evaluation
{
  type: 'judge_evaluation',
  runId: 'run_abc123',
  qualityScore: 0.87,
  relevance: 0.92,
  groundedness: 0.85,
  coherence: 0.90,
  completeness: 0.81
}
```

---

## Key Files Reference

### Core Chat System

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | Main chat API endpoint |
| `src/lib/chat/orchestrator.ts` | Pipeline orchestration |
| `src/lib/chat/mode-config.ts` | Mode configuration definitions |
| `src/lib/chat/mode-classifier.ts` | Auto mode detection |
| `src/lib/chat/types.ts` | TypeScript types and events |
| `src/lib/chat/event-bus.ts` | Event emission system |

### Retrieval & Agents

| File | Purpose |
|------|---------|
| `src/lib/retrieval/domain-retriever.ts` | Domain agent retrieval |
| `src/lib/semantic/entity-resolver.ts` | Entity extraction and resolution |
| `src/lib/graph/graphrag-lite.ts` | Knowledge graph traversal |

### Configuration

| File | Purpose |
|------|---------|
| `.env.local` | Environment variables |
| `src/lib/db/schema.ts` | Database schema (agents, entities, settings) |
| `src/app/api/agents/route.ts` | Agent CRUD API |
| `src/app/api/settings/route.ts` | User settings API |

### Admin UI

| File | Purpose |
|------|---------|
| `src/app/admin/agents/page.tsx` | Agent management UI |
| `src/app/admin/modes/page.tsx` | Mode configuration UI |
| `src/app/admin/models/page.tsx` | Model configuration UI |

---

## Summary

SemanticStudio's architecture enables:

1. **Flexible Query Processing**: 4 modes from quick lookups to deep research
2. **Unlimited Domain Agents**: Database-driven agent registry with 28 defaults
3. **Full Configurability**: 3-layer config system from env vars to runtime overrides
4. **Extensibility**: Add new agents without code changes via API or Admin UI
5. **Observability**: 15+ event types for tracing and debugging
6. **Multi-Provider LLM Support**: OpenAI, Anthropic, and Ollama

The system is designed to scale with your data and adapt to your organization's unique domain structure.
