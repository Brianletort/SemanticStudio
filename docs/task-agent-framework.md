# Task Agent Framework

## Overview

The Task Agent Framework provides infrastructure for orchestrating task-based agents from within the chat system. It supports both **human-in-the-loop** (requires approval) and **human-out-of-the-loop** (autonomous) execution patterns.

This framework enables future integrations like:
- Salesforce CRM updates
- Email/Calendar lookups
- Oracle pricing queries
- Any external system that agents can interact with

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CHAT SYSTEM                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   Chat Route    │───▶│   Orchestrator  │───▶│    Composer     │          │
│  │   /api/chat     │    │                 │    │                 │          │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘          │
│                                  │                                           │
│                                  │ (Future Integration Point)                │
│                                  ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      TASK AGENT FRAMEWORK                              │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │  │
│  │  │  Task Executor  │───▶│  Task Registry  │───▶│   Task Agents   │   │  │
│  │  │                 │    │                 │    │                 │   │  │
│  │  │ • Routing       │    │ • Registration  │    │ • Salesforce    │   │  │
│  │  │ • Approval      │    │ • Discovery     │    │ • Calendar      │   │  │
│  │  │ • Timeout/Retry │    │ • Capabilities  │    │ • Oracle        │   │  │
│  │  └────────┬────────┘    └─────────────────┘    │ • Custom...     │   │  │
│  │           │                                     └─────────────────┘   │  │
│  │           │                                                           │  │
│  │           ▼                                                           │  │
│  │  ┌─────────────────┐                                                  │  │
│  │  │   Event Bus     │◀──────────── All events for observability        │  │
│  │  │ (Observability) │                                                  │  │
│  │  └────────┬────────┘                                                  │  │
│  └───────────│───────────────────────────────────────────────────────────┘  │
│              │                                                               │
└──────────────│───────────────────────────────────────────────────────────────┘
               │
               ▼
        ┌─────────────────┐    ┌─────────────────┐
        │   PostgreSQL    │    │   SSE Stream    │
        │ (Event Storage) │    │   (UI Updates)  │
        └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Task Agent Interface

Every task agent implements this interface:

```typescript
interface TaskAgent {
  id: string;                              // Unique identifier
  name: string;                            // Human-readable name
  description: string;                     // What this agent does
  version: string;                         // Semantic version
  executionMode: 'human_in_loop' | 'human_out_of_loop';
  capabilities: string[];                  // Task types it can handle

  canHandle(taskType: string): boolean;    // Check capability
  prepare(params): Promise<TaskPreparation>;  // Validate & describe
  execute(params, context): Promise<TaskResult>;  // Do the work
}
```

### 2. Task Registry

Central registration point for all agents:

```typescript
import { taskRegistry } from '@/lib/agents';

// Register an agent
taskRegistry.register(salesforceAgent);

// Find agents by capability
const agents = taskRegistry.findByCapability('salesforce_update');

// Check if any agent can handle a task
taskRegistry.canHandle('calendar_lookup'); // true/false
```

### 3. Task Executor

Orchestrates task execution with full lifecycle management:

```typescript
import { createTaskExecutor } from '@/lib/agents';

const executor = createTaskExecutor(eventBus);

const result = await executor.execute({
  taskType: 'salesforce_update',
  params: { accountId: '123', status: 'closed' },
  onApprovalRequired: async (prep, agent) => {
    // Show UI, get user approval
    return userApproved;
  },
});
```

## Execution Flows

### Human-Out-of-Loop (Autonomous)

```
User Message ──▶ LLM determines task needed
                         │
                         ▼
              ┌──────────────────┐
              │ task_requested   │ Event
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Find Agent       │
              │ (Registry Lookup)│
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ task_routed      │ Event
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ agent.prepare()  │ Validate params
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ task_executing   │ Event
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ agent.execute()  │ Do the work
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ task_result      │ Event
              └────────┬─────────┘
                       │
                       ▼
                Return to Chat
```

### Human-In-Loop (Requires Approval)

```
User Message ──▶ LLM determines task needed
                         │
                         ▼
              ┌──────────────────┐
              │ task_requested   │ Event
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Find Agent       │
              │ (Registry Lookup)│
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ task_routed      │ Event (mode: human_in_loop)
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ agent.prepare()  │ Build description for UI
              └────────┬─────────┘
                       │
                       ▼
              ┌────────────────────────┐
              │ task_pending_approval  │ Event
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │     Approval UI        │
              │ "Update Acme to Closed"│
              │   [Approve] [Reject]   │
              └────────────┬───────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
     ┌────────────────┐       ┌────────────────┐
     │ task_approved  │       │ task_rejected  │
     └───────┬────────┘       └───────┬────────┘
             │                        │
             ▼                        ▼
     ┌────────────────┐       Return to Chat
     │ task_executing │       (task cancelled)
     └───────┬────────┘
             │
             ▼
     ┌────────────────┐
     │ agent.execute()│
     └───────┬────────┘
             │
             ▼
     ┌────────────────┐
     │ task_result    │
     └───────┬────────┘
             │
             ▼
       Return to Chat
```

## Event Types

The framework emits these events to the Event Bus for observability:

| Event | Description |
|-------|-------------|
| `task_requested` | Task execution requested |
| `task_routed` | Task routed to specific agent |
| `task_pending_approval` | Awaiting human approval |
| `task_approved` | Human approved the task |
| `task_rejected` | Human rejected the task |
| `task_executing` | Agent is executing |
| `task_result` | Task completed successfully |
| `task_failed` | Task failed with error |

All events include:
- `taskId` - Unique task identifier
- `runId` - Correlates with chat run
- `agentId` - Which agent handled it
- `timestamp` - When it occurred

## Creating a New Agent

### Example: Salesforce Agent

```typescript
// src/lib/agents/integrations/salesforce-agent.ts

import type { TaskAgent, TaskParams, TaskPreparation, TaskResult, TaskContext } from '@/lib/agents';

export const salesforceAgent: TaskAgent = {
  id: 'salesforce_agent',
  name: 'Salesforce Agent',
  description: 'Updates and queries Salesforce CRM data',
  version: '1.0.0',
  executionMode: 'human_in_loop', // Requires approval for mutations
  capabilities: ['salesforce_update', 'salesforce_query'],

  canHandle(taskType: string): boolean {
    return this.capabilities.includes(taskType);
  },

  async prepare(params: TaskParams): Promise<TaskPreparation> {
    const { recordId, field, value } = params.params;
    
    // Validate required parameters
    if (!recordId) {
      return {
        valid: false,
        description: 'Missing record ID',
        error: 'The recordId parameter is required',
      };
    }

    // Build human-readable description for approval UI
    return {
      valid: true,
      description: `Update Salesforce record ${recordId}: set ${field} = "${value}"`,
      estimatedDuration: '~2 seconds',
      warnings: ['This will modify production Salesforce data'],
    };
  },

  async execute(params: TaskParams, context: TaskContext): Promise<TaskResult> {
    const start = Date.now();
    
    try {
      // Emit progress event
      if (context.eventBus) {
        await context.eventBus.emit({
          type: 'agent_progress',
          runId: context.runId,
          agentId: this.id,
          message: 'Connecting to Salesforce...',
        });
      }

      // Call Salesforce API
      const sfClient = await getSalesforceClient();
      const result = await sfClient.update(params.params);

      return {
        success: true,
        data: result,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        durationMs: Date.now() - start,
      };
    }
  },
};

// Register on import
import { taskRegistry } from '@/lib/agents';
taskRegistry.register(salesforceAgent);
```

## File Structure

```
src/lib/agents/
├── index.ts           # Public exports
├── types.ts           # Type definitions
├── registry.ts        # TaskAgentRegistry class
├── executor.ts        # TaskExecutor class
├── example-agent.ts   # Mock agents for testing
└── integrations/      # Real agent implementations (future)
    ├── salesforce-agent.ts
    ├── calendar-agent.ts
    └── oracle-agent.ts
```

## Integration Points

### Where to Wire Up (Future)

The framework will be invoked from the Chat Orchestrator when the LLM determines a task is needed:

```typescript
// In src/lib/chat/orchestrator.ts or composition step

import { createTaskExecutor, taskRegistry } from '@/lib/agents';

// In the chat pipeline, after LLM determines a task:
if (llmResponse.requiresTask) {
  const executor = createTaskExecutor(eventBus);
  
  const result = await executor.execute({
    taskType: llmResponse.taskType,
    params: llmResponse.taskParams,
    onApprovalRequired: async (prep, agent) => {
      // Stream approval request to UI
      // Wait for user response
      return userResponse.approved;
    },
  });
  
  // Include result in context for final response
  context.taskResults.push(result);
}
```

### UI Integration (Future)

The UI will need to:
1. Listen for `task_pending_approval` events via SSE
2. Render an approval dialog with the task description
3. Send approval/rejection back to the server
4. Display task results in the chat

## Configuration

### Retry Policy

```typescript
const DEFAULT_RETRY_POLICY = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};
```

### Timeouts

```typescript
const DEFAULT_TASK_TIMEOUT = 30000; // 30 seconds
```

Both can be overridden per-task:

```typescript
executor.execute({
  taskType: 'slow_task',
  params: { ... },
  timeout: 60000, // 60 seconds
  retryPolicy: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 1.5,
  },
});
```

## Testing

Run the framework tests:

```bash
npm test -- --run tests/unit/agents/task-agent-framework.test.ts
```

The test suite includes:
- Registry operations (register, unregister, find)
- Executor flows (success, failure, timeout)
- Human-in-loop approval workflow
- Error handling and retry logic

## Current Status

| Component | Status |
|-----------|--------|
| Types & Interfaces | ✅ Complete |
| Task Registry | ✅ Complete |
| Task Executor | ✅ Complete |
| Event Integration | ✅ Complete |
| Example Agents | ✅ Complete |
| Unit Tests | ✅ 43 tests passing |
| Real Integrations | 🔮 Future |
| Chat Integration | 🔮 Future |
| Approval UI | 🔮 Future |

## Next Steps

1. **Implement Real Agents** - Build Salesforce, Calendar, Oracle agents
2. **Chat Integration** - Wire executor into the chat orchestrator
3. **Approval UI** - Build React component for human-in-loop approval
4. **Tool Calling** - Enable LLM to invoke tasks via function calling
