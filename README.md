<p align="center">
  <h1 align="center">SemanticStudio</h1>
  <p align="center">
    An enterprise-ready, data-first multi-agent chat platform with configurable domain agents, multiple LLM provider support, and self-learning ETL pipelines.
  </p>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#customization">Customization</a> •
  <a href="#api-reference">API</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/postgresql-16+-blue.svg" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/next.js-16-black.svg" alt="Next.js">
</p>

---

<p align="center">
  <img src="docs/images/hero-chat.png" alt="SemanticStudio Chat Interface" width="800">
</p>

## Overview

SemanticStudio is a production-ready multi-agent chat platform that enables intelligent conversations across your organization's data. It combines the power of modern LLMs with a sophisticated domain agent architecture to provide contextual, accurate responses grounded in your data.

**Why SemanticStudio?**

- **Get running fast** — Clone, configure one API key, and have a working enterprise AI assistant in minutes
- **Enterprise-class architecture** — Built for scale with PostgreSQL, vector search, and streaming responses
- **Full observability** — Every step of reasoning is traced and visible in real-time
- **Secure by design** — Role-based access, input validation, and no hardcoded secrets
- **Extensible** — Add your own domain agents and integrations without changing core code

**Key Capabilities:**

- **Complete Chat Interface** with voice input, file attachments, image generation, and real-time trace panel
- **28 Pre-configured Domain Agents** covering all business functions
- **4 Chat Modes** (Quick, Think, Deep, Research) with configurable pipelines
- **4-Tier Memory System** for personalized, context-aware conversations with knowledge graph linking
- **GraphRAG-lite** for relationship discovery across your data
- **Multi-provider LLM Support** (OpenAI, Anthropic, Ollama)
- **Self-learning ETL Pipelines** with Plan-Act-Reflect pattern
- **Task Agent Framework** for orchestrating human-in-loop and autonomous agent actions
- **27 Reusable UI Components** built on Radix UI with Tailwind CSS
- **45+ REST API Endpoints** for full programmatic control
- **Full Observability** with 38 event types streamed in real-time

---

## Features

### Complete Chat Interface

A modern, responsive chat interface with everything you need for enterprise AI conversations.

<p align="center">
  <img src="docs/images/hero-chat.png" alt="Chat Interface" width="800">
</p>

| Feature | Description |
|---------|-------------|
| **Smart Text Input** | Auto-resizing textarea with keyboard shortcuts |
| **Voice Input** | Speech-to-text via Web Speech API |
| **File Attachments** | Drag & drop support for documents (PDF, DOCX, CSV, JSON) |
| **Image Generation** | Create and edit images with AI directly in chat |
| **Markdown Rendering** | Full markdown with syntax-highlighted code blocks |
| **Session Management** | Folders, search, pin, and archive conversations |
| **Real-time Trace Panel** | See every step of agent reasoning as it happens |
| **Quality Scores** | Automatic response evaluation with hallucination detection |

### Intelligent Mode Selection

Four configurable modes with distinct processing pipelines, each optimized for different use cases.

<p align="center">
  <img src="docs/images/chat-modes.png" alt="Chat Modes" width="600">
</p>

| Mode | Purpose | Depth | Speed |
|------|---------|-------|-------|
| **Quick** | Simple lookups, quick facts | Surface | Fast |
| **Think** | Analysis, insights | Moderate | Balanced |
| **Deep** | Comprehensive research | Deep | Thorough |
| **Research** | Complex investigations | Exhaustive | Extended |

Each mode controls:
- Maximum results retrieved
- Knowledge graph traversal depth (0-3 hops)
- Which memory tiers are included
- Whether reflection/self-critique is enabled
- Which LLM model is used

**All parameters are configurable via the admin UI without code changes.**

### 27 Reusable UI Components

A complete component library built on [Radix UI](https://www.radix-ui.com/) with [Tailwind CSS](https://tailwindcss.com/) styling. All components are accessible, themeable, and production-ready.

| Category | Components |
|----------|------------|
| **Overlays** | Dialog, Alert Dialog, Sheet, Popover, Tooltip |
| **Forms** | Input, Textarea, Select, Checkbox, Switch, Slider, Label |
| **Data Display** | Table, Card, Badge, Avatar, Progress, Skeleton |
| **Navigation** | Tabs, Command (⌘K), Dropdown Menu, Sidebar |
| **Layout** | Separator, Scroll Area, Collapsible |
| **Feedback** | Sonner (toasts), Button |

### Domain Agent Coverage

28 pre-configured agents organized into 6 categories, each with custom system prompts and configurable data sources.

<table>
<tr>
<td width="33%">

**Customer Domain**
- Customer Intelligence
- Sales Pipeline
- Customer Support
- Customer Success
- Marketing Analytics

</td>
<td width="33%">

**Product & Engineering**
- Product Management
- Engineering
- Quality Assurance
- Design
- Data Analytics

</td>
<td width="33%">

**Operations**
- Operations
- Supply Chain
- Inventory
- Procurement
- Facilities

</td>
</tr>
<tr>
<td>

**Finance & Legal**
- Finance
- Accounting
- Legal
- Compliance
- Risk Management

</td>
<td>

**People**
- Human Resources
- Talent Acquisition
- Learning & Development
- IT Support
- Communications

</td>
<td>

**Intelligence**
- Competitive Intelligence
- Business Intelligence
- Strategic Planning

</td>
</tr>
</table>

### Full Admin Dashboard

Manage every aspect of your AI assistant from a unified admin interface.

<p align="center">
  <img src="docs/images/admin-dashboard.png" alt="Admin Dashboard" width="800">
</p>

| Section | Capabilities |
|---------|--------------|
| **Model Configuration** | Assign models to 9 different LLM roles |
| **Domain Agents** | Create, edit, and configure agents without code |
| **Mode Configuration** | Visual pipeline flow diagrams, parameter tuning |
| **Data Sources** | Connect databases, files, APIs with semantic entity mapping |
| **ETL Jobs** | Manage pipelines with execution history |
| **Knowledge Graph** | Interactive 3D visualization |
| **Observability** | Usage analytics, quality metrics, user activity |

### Knowledge Graph Visualization

Explore entity relationships with an interactive 3D knowledge graph.

<p align="center">
  <img src="docs/images/admin-graph.png" alt="Knowledge Graph" width="800">
</p>

### ETL Pipeline Management

Self-learning pipelines with Plan-Act-Reflect (PAR) loop for reliable data ingestion.

<p align="center">
  <img src="docs/images/admin-etl.png" alt="ETL Pipelines" width="800">
</p>

**Supported Sources:**
- CSV files
- JSON files
- REST APIs
- Database tables

**Key Feature:** Lessons learned are stored and referenced in future runs, so pipelines improve over time.

### Usage Analytics & Observability

Comprehensive observability dashboard for monitoring your AI assistant's performance and usage patterns.

**Overview Dashboard** — Real-time stats on sessions, messages, quality scores, and mode distribution.

<p align="center">
  <img src="docs/images/admin-observability.png" alt="Observability Overview" width="800">
</p>

**Quality Metrics** — Track response quality trends with relevance, groundedness, coherence, and completeness scores. Automatic hallucination detection alerts you to potential issues.

<p align="center">
  <img src="docs/images/admin-observability-quality.png" alt="Quality Metrics" width="800">
</p>

**User Activity** — Deep dive into individual user sessions and domain agent utilization.

<p align="center">
  <img src="docs/images/admin-observability-users.png" alt="User Activity" width="800">
</p>

---

## Event Bus & Full Observability

Every action in the system emits events for complete traceability. **38 event types** covering:

| Category | Events |
|----------|--------|
| **Pipeline** | `mode_classified`, `mode_selected`, `pipeline_started`, `pipeline_complete` |
| **Retrieval** | `retrieval_started`, `retrieval_complete`, `domain_agent_started`, `domain_agent_complete` |
| **Graph** | `graph_traversal_started`, `graph_traversal_complete` |
| **Memory** | `memory_retrieved`, `memory_saved` |
| **Quality** | `reflection_started`, `reflection_complete`, `judge_evaluation` |
| **Task** | `task_requested`, `task_routed`, `task_pending_approval`, `task_approved`, `task_rejected`, `task_executing`, `task_result`, `task_failed` |
| **Content** | `image_generated`, `image_edited`, `document_processed` |
| **Web Search** | `web_search_started`, `web_search_complete` |
| **Context** | `source_used`, `context_built` |

All events are:
- **Streamed to the UI in real-time** (visible in the trace panel)
- **Persisted to the database** for historical analysis
- **Correlated by run, session, and turn** for debugging

<p align="center">
  <img src="docs/images/reasoning-pane.png" alt="Reasoning Pane" width="600">
</p>

---

## Quick Start

Get SemanticStudio running in under 5 minutes.

### Prerequisites

- **Node.js** 18+ 
- **Docker** and Docker Compose
- **API Key** from OpenAI, Anthropic, or local Ollama installation

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Brianletort/SemanticStudio.git
   cd semanticstudio
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the database**

   ```bash
   cd docker
   docker compose up -d
   cd ..
   ```

   This starts PostgreSQL 16 with pgvector extension on port 5433.

4. **Configure environment**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your API keys:

   ```env
   # Required: At least one LLM provider
   OPENAI_API_KEY=sk-your-openai-key
   
   # Optional: Additional providers
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
   OLLAMA_BASE_URL=http://localhost:11434
   ```

5. **Run database migrations**

   ```bash
   npm run db:migrate
   ```

6. **Start the development server**

   ```bash
   npm run dev
   ```

7. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000)

### First Run

On first launch, SemanticStudio will:
- Initialize the database schema
- Create 28 default domain agents
- Set up sample data for demonstration

You can start chatting immediately or configure your own data sources through the Admin panel at `/admin`.

### Connect Your Enterprise Data

1. Navigate to **Admin → Data Sources** (`/admin/data`)
2. Add your data sources:
   - **Database**: PostgreSQL connection string + table/view selection
   - **Files**: Upload CSV, JSON, or documents
   - **APIs**: Configure REST endpoint with auth
3. Create an **ETL Job** to import and process the data
4. Run the job — SemanticStudio will extract entities and build the knowledge graph
5. Link data sources to domain agents for querying

### Production Deployment

For production deployments:

```bash
# Build the application
npm run build

# Start production server
npm start
```

**Environment variables for production:**

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/semanticstudio
OPENAI_API_KEY=sk-...

# Optional: Enable specific features
BRAVE_API_KEY_AI_GROUNDING=...  # Web search
AZURE_SEARCH_ENDPOINT=...       # Azure Cognitive Search
```

**Docker Deployment:**

```bash
docker build -t semanticstudio .
docker run -p 3000:3000 --env-file .env.production semanticstudio
```

---

## Architecture

SemanticStudio uses a layered architecture designed for extensibility and performance.

### High-Level Overview

```mermaid
flowchart TB
    subgraph Client[Client Layer]
        UI[Chat UI]
        Admin[Admin Panel]
    end
    
    subgraph API[API Layer]
        ChatAPI[Chat API]
        AdminAPI[Admin APIs]
    end
    
    subgraph Core[Core Services]
        ModeClassifier[Mode Classifier]
        MemorySystem[4-Tier Memory]
        DomainAgents[28 Domain Agents]
        GraphRAG[GraphRAG-lite]
        EventBus[Event Bus]
    end
    
    subgraph LLM[LLM Providers]
        OpenAI[OpenAI]
        Anthropic[Anthropic]
        Ollama[Ollama]
    end
    
    subgraph Storage[Storage]
        PostgreSQL[(PostgreSQL + pgvector)]
        KnowledgeGraph[(Knowledge Graph)]
    end
    
    UI --> ChatAPI
    Admin --> AdminAPI
    ChatAPI --> ModeClassifier
    ChatAPI --> MemorySystem
    ChatAPI --> DomainAgents
    DomainAgents --> GraphRAG
    Core --> LLM
    Core --> Storage
    Core --> EventBus
```

### Request Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Chat API
    participant M as Mode Classifier
    participant Mem as Memory System
    participant E as Entity Resolver
    participant D as Domain Agents
    participant G as GraphRAG
    participant L as LLM Composer

    U->>C: Send query
    C->>M: Classify mode (if auto)
    M-->>C: Mode + confidence
    
    C->>Mem: Retrieve memories
    Note over Mem: Tier 1: Working context<br/>Tier 2: Session memory<br/>Tier 3: Long-term memory<br/>Tier 4: Context Graph
    Mem-->>C: Relevant context
    
    C->>E: Extract entities
    E-->>C: Resolved entities
    
    C->>D: Query domain agents
    D->>G: Expand via GraphRAG
    G-->>D: Related entities
    D-->>C: Domain context
    
    C->>L: Compose response
    L-->>U: Stream response
```

### Project Structure

```
semanticstudio/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (chat)/             # Chat interface routes
│   │   ├── admin/              # Admin dashboard
│   │   │   ├── agents/         # Agent management
│   │   │   ├── models/         # Model configuration
│   │   │   ├── modes/          # Mode pipeline config
│   │   │   ├── graph/          # Knowledge graph viewer
│   │   │   └── etl/            # ETL pipeline management
│   │   └── api/                # REST API endpoints (45+)
│   │       ├── chat/           # Chat endpoint (SSE streaming)
│   │       ├── agents/         # Agent CRUD
│   │       ├── etl/            # ETL operations
│   │       ├── graph/          # Knowledge graph APIs
│   │       ├── memories/       # Memory system APIs
│   │       └── ...
│   ├── lib/
│   │   ├── agents/             # Task Agent Framework
│   │   ├── chat/               # Chat orchestration + Event Bus
│   │   ├── llm/                # LLM provider abstraction
│   │   ├── memory/             # 4-tier memory system
│   │   ├── retrieval/          # Domain retrieval
│   │   ├── graph/              # GraphRAG-lite
│   │   └── etl/                # ETL pipeline system
│   └── components/             # React UI components (27+)
├── docker/                     # Docker configuration
├── docs/                       # Documentation
└── tests/                      # Test suites
```

For detailed architecture documentation, see [docs/architecture.md](docs/architecture.md).

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | One required | OpenAI API key |
| `ANTHROPIC_API_KEY` | One required | Anthropic API key |
| `OLLAMA_BASE_URL` | One required | Ollama server URL |
| `DEFAULT_LLM_PROVIDER` | No | Default provider: `openai`, `anthropic`, or `ollama` |
| `BRAVE_API_KEY_AI_GROUNDING` | No | Brave Search API key for web search |
| `AZURE_SEARCH_ENDPOINT` | No | Azure Cognitive Search endpoint |
| `AZURE_SEARCH_API_KEY` | No | Azure Search API key |

### Model Configuration

Configure which models are used for each role via the Admin UI at `/admin/models`:

| Role | Purpose | Default Model |
|------|---------|---------------|
| `composer` | Main response generation | gpt-4o |
| `composer_fast` | Quick mode responses | gpt-4o-mini |
| `research` | Research mode (extended) | o3-mini |
| `planner` | Query planning | gpt-4o-mini |
| `reflection` | Response improvement | gpt-4o |
| `mode_classifier` | Auto mode detection | gpt-4o-mini |
| `memory_extractor` | Memory fact extraction | gpt-4o-mini |
| `embeddings` | Vector embeddings | text-embedding-3-large |
| `image_generation` | Image creation | dall-e-3 |

<p align="center">
  <img src="docs/images/admin-models.png" alt="Model Configuration" width="800">
</p>

### Chat Mode Configuration

Each mode has configurable parameters that can be customized per-user:

| Parameter | Quick | Think | Deep | Research |
|-----------|-------|-------|------|----------|
| Max Results | 5 | 15 | 30 | 50 |
| Graph Hops | 0 | 1 | 2 | 3 |
| Memory Tiers | 1 | 1-2 | 1-3 | 1-3 |
| Reflection | No | Yes | Yes | Yes |
| Clarification | No | No | No | Yes |

---

## Memory System

SemanticStudio implements a MemGPT-inspired **4-tier memory system** for personalized, context-aware conversations with knowledge graph integration.

### Memory Tiers

| Tier | Scope | Contents |
|------|-------|----------|
| **Tier 1** | Working Context | Recent conversation turns (last 3 exchanges), session summary |
| **Tier 2** | Session Memory | Relevant past turns from current session, extracted session facts |
| **Tier 3** | Long-term Memory | User profile facts across all sessions, saved memories |
| **Tier 4** | Context Graph | Links user context to domain knowledge graph entities |

### Context Graph (Tier 4)

The Context Graph bridges user conversations with your domain knowledge graph, enabling powerful queries like "What did I discuss about Customer X?"

**Key Capabilities:**
- **Auto-linking**: Automatically detects and links mentioned entities to the knowledge graph
- **Cross-session tracking**: Tracks which entities you've discussed, queried, or analyzed
- **Collaboration detection**: Identifies when multiple users are working on the same entities
- **Entity interaction history**: "What have I discussed about [entity]?" queries

**Reference Types:**
| Type | Description |
|------|-------------|
| `discussed` | User discussed this entity in depth |
| `queried` | User asked about this entity |
| `mentioned` | Entity was mentioned in passing |
| `interested_in` | User expressed interest |
| `analyzed` | Entity was analyzed in detail |

### Fact Types Extracted

The memory system automatically extracts and categorizes facts from conversations:

| Fact Type | Description | Example |
|-----------|-------------|---------|
| **Preferences** | Format, style, communication preferences | "User prefers bullet points over paragraphs" |
| **Constraints** | Temporary filters | "Only interested in Texas customers" |
| **Context** | Situational information | "Working on Q4 planning" |
| **Topics** | What's being discussed | "Focused on revenue metrics" |
| **Expertise** | User's knowledge areas | "Expert in financial modeling" |
| **Goals** | User's objectives | "Trying to reduce churn by 10%" |

### Configurable Extraction Modes

| Mode | Description |
|------|-------------|
| **Conservative** | Only highly confident, explicit facts |
| **Balanced** | Clear facts with moderate confidence (default) |
| **Aggressive** | All potential facts including implicit ones |

Configure memory behavior in **Settings → Memory Configuration**.

---

## Task Agent Framework

SemanticStudio includes a powerful **Task Agent Framework** for orchestrating agents that perform real-world actions. This enables the chat system to not just answer questions, but to **take action** on behalf of users—updating CRMs, scheduling meetings, querying databases, and more.

### The Power of Agent Coordination

Traditional chatbots answer questions. SemanticStudio goes further by enabling **agentic workflows** where:

- **Chat identifies intent** → "Close the Acme deal in Salesforce"
- **Framework routes to agent** → Salesforce Agent selected
- **Human approves if needed** → "Update Acme status to Closed? [Approve]"
- **Agent executes** → API call to Salesforce
- **Result returns to chat** → "Done! Acme deal marked as closed."

This transforms your AI assistant from an information retrieval system into an **intelligent automation platform**.

### Two Execution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Human-in-Loop** | Requires user approval before execution | Mutations, deletions, external API calls |
| **Human-out-of-Loop** | Executes autonomously | Lookups, read-only queries, low-risk operations |

### Key Capabilities

- **Capability-based Routing**: Agents register what task types they handle; framework routes automatically
- **Preparation Step**: Agents validate parameters and generate human-readable descriptions before execution
- **Event Observability**: All task lifecycle events stream through the Event Bus for tracing
- **Configurable Retry**: Exponential backoff with configurable retry policies
- **Timeout Protection**: Prevent runaway tasks with per-task timeout configuration

### Creating Custom Agents

```typescript
import type { TaskAgent } from '@/lib/agents';
import { taskRegistry } from '@/lib/agents';

const salesforceAgent: TaskAgent = {
  id: 'salesforce_agent',
  name: 'Salesforce Agent',
  description: 'Updates and queries Salesforce CRM data',
  version: '1.0.0',
  executionMode: 'human_in_loop',
  capabilities: ['salesforce_update', 'salesforce_query'],

  canHandle(taskType) {
    return this.capabilities.includes(taskType);
  },

  async prepare(params) {
    return {
      valid: true,
      description: `Update ${params.params.recordId}: ${params.params.field} → ${params.params.value}`,
      warnings: ['This will modify production data'],
    };
  },

  async execute(params, context) {
    // Call Salesforce API...
    return { success: true, data: result, durationMs: 1200 };
  },
};

taskRegistry.register(salesforceAgent);
```

For complete documentation, see [docs/task-agent-framework.md](docs/task-agent-framework.md).

---

## Quality Evaluation System

Every response is automatically evaluated on multiple dimensions:

| Metric | Description |
|--------|-------------|
| **Relevance** | How well the response addresses the query |
| **Groundedness** | Whether claims are supported by retrieved data |
| **Coherence** | Logical flow and clarity |
| **Completeness** | Coverage of the query scope |
| **Hallucination Detection** | Flags unsupported claims |

Scores are displayed in the UI and stored for trend analysis in the observability dashboard.

---

## Database Schema

PostgreSQL 16 with pgvector extension for vector similarity search. The schema includes:

| Category | Tables |
|----------|--------|
| **Chat History** | `chat_sessions`, `chat_messages` |
| **Agent Configuration** | `domain_agents`, `agent_data_sources` |
| **Data Sources** | `data_sources`, `semantic_entities` |
| **Knowledge Graph** | `kg_nodes`, `kg_edges` |
| **Event Bus** | `chat_agent_events` |
| **Memory System** | `session_memories`, `user_memories`, `memory_facts` |
| **ETL System** | `etl_jobs`, `etl_runs`, `etl_learned_knowledge` |
| **Quality** | `evaluations` |
| **Configuration** | `model_configs`, `mode_configs`, `user_settings` |

---

## API Reference

### Core Endpoints (45+)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Main chat endpoint (SSE streaming) |
| `GET` | `/api/sessions` | List chat sessions |
| `POST` | `/api/sessions` | Create new session |
| `GET` | `/api/sessions/search` | Search sessions |
| `GET` | `/api/agents` | List domain agents |
| `POST` | `/api/agents` | Create domain agent |
| `GET` | `/api/graph/data` | Get knowledge graph data |
| `POST` | `/api/graph/build` | Build/rebuild knowledge graph |
| `GET` | `/api/etl/jobs` | List ETL jobs |
| `POST` | `/api/etl/jobs/{id}/run` | Execute ETL job |
| `GET` | `/api/memories` | Get user memories |
| `GET` | `/api/memories/facts` | Get extracted facts |
| `GET` | `/api/trace/{turnId}` | Get events for a turn |
| `POST` | `/api/images/generate` | Generate image |
| `GET` | `/api/models` | List model configurations |
| `PUT` | `/api/models/{role}` | Update model for role |
| ... | ... | [See full API docs](docs/api-reference.md) |

### Chat Request

```typescript
POST /api/chat
Content-Type: application/json

{
  "message": "What are our top customers by revenue?",
  "sessionId": "session-uuid",
  "mode": "think",              // auto | quick | think | deep | research
  "webSearchEnabled": false,
  "memoryEnabled": true
}
```

### Chat Response (SSE)

The chat endpoint returns Server-Sent Events with the following event types:

```typescript
// Content chunks
event: content
data: {"content": "Based on the data..."}

// Agent events (for tracing)
event: agent_event  
data: {"type": "domain_agent_started", "domain": "customer"}

// Completion
event: done
data: {"messageId": "msg-uuid", "turnId": "turn-uuid"}
```

For complete API documentation, see the [API Reference](docs/api-reference.md).

---

## Technology Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Radix UI
- **State Management**: Zustand for global state (session activity tracking, cross-component state)
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL 16 with pgvector
- **ORM**: Drizzle ORM
- **LLM Providers**: OpenAI, Anthropic, Ollama
- **Search**: Brave Search, Azure Cognitive Search
- **Visualization**: react-force-graph (3D), Three.js, Recharts

---

## Development

### Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests (Playwright)
npm run test:e2e
```

### Database Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate
```

### Building for Production

```bash
npm run build
npm start
```

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines on:

- Setting up your development environment
- Code style and conventions
- Pull request process
- Testing requirements

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [Zustand](https://zustand-demo.pmnd.rs/) - Lightweight state management
- [PostgreSQL](https://www.postgresql.org/) - Database
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM

---

<p align="center">
  Made with care for the developer community
</p>
