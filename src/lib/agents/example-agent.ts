/**
 * Example Task Agents
 * 
 * Mock agents for testing the task agent framework.
 * Demonstrates both human-in-loop and human-out-of-loop patterns.
 * 
 * These agents are NOT for production use - they exist to:
 * 1. Test the framework infrastructure
 * 2. Demonstrate the agent interface
 * 3. Provide examples for implementing real agents
 */

import type { 
  TaskAgent, 
  TaskParams, 
  TaskPreparation, 
  TaskResult, 
  TaskContext,
} from './types';
import { taskRegistry } from './registry';

// ============================================
// ECHO AGENT (Human-out-of-loop)
// ============================================

/**
 * Echo Agent
 * 
 * A simple autonomous agent that echoes back its input.
 * Useful for testing the framework without any side effects.
 * 
 * Capabilities: 'echo', 'test'
 */
export const echoAgent: TaskAgent = {
  id: 'echo_agent',
  name: 'Echo Agent',
  description: 'Echoes back the input (for testing)',
  version: '1.0.0',
  executionMode: 'human_out_of_loop',
  capabilities: ['echo', 'test'],
  
  canHandle(taskType: string): boolean {
    return this.capabilities.includes(taskType);
  },
  
  async prepare(params: TaskParams): Promise<TaskPreparation> {
    const message = params.params.message as string | undefined;
    
    if (!message) {
      return {
        valid: false,
        description: 'No message provided',
        error: 'The "message" parameter is required',
      };
    }
    
    return {
      valid: true,
      description: `Echo: "${message}"`,
      estimatedDuration: '~100ms',
    };
  },
  
  async execute(params: TaskParams, context: TaskContext): Promise<TaskResult> {
    const start = Date.now();
    const message = params.params.message as string;
    
    // Emit progress event if event bus is available
    if (context.eventBus) {
      await context.eventBus.emit({
        type: 'agent_progress',
        runId: context.runId,
        agentId: this.id,
        message: 'Echoing message...',
      });
    }
    
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      data: { 
        echoed: message,
        timestamp: new Date().toISOString(),
      },
      durationMs: Date.now() - start,
    };
  },
};

// ============================================
// MOCK UPDATE AGENT (Human-in-loop)
// ============================================

/**
 * Mock Update Agent
 * 
 * Simulates an update operation that requires human approval.
 * Demonstrates the human-in-loop approval workflow.
 * 
 * Capabilities: 'mock_update', 'mock_delete'
 */
export const mockUpdateAgent: TaskAgent = {
  id: 'mock_update_agent',
  name: 'Mock Update Agent',
  description: 'Simulates an update operation (requires approval)',
  version: '1.0.0',
  executionMode: 'human_in_loop',
  capabilities: ['mock_update', 'mock_delete'],
  
  canHandle(taskType: string): boolean {
    return this.capabilities.includes(taskType);
  },
  
  async prepare(params: TaskParams): Promise<TaskPreparation> {
    const { taskType } = params;
    const { recordId, field, value } = params.params as {
      recordId?: string;
      field?: string;
      value?: unknown;
    };
    
    // Validate required parameters
    if (!recordId) {
      return {
        valid: false,
        description: 'Missing record ID',
        error: 'The "recordId" parameter is required',
      };
    }
    
    // Build description based on task type
    let description: string;
    const warnings: string[] = ['This is a mock agent - no actual update will occur'];
    
    if (taskType === 'mock_delete') {
      description = `Delete record: ${recordId}`;
      warnings.push('Delete operations cannot be undone');
    } else {
      description = field && value !== undefined
        ? `Update record ${recordId}: set ${field} = ${JSON.stringify(value)}`
        : `Update record: ${recordId}`;
    }
    
    return {
      valid: true,
      description,
      estimatedDuration: '~500ms',
      warnings,
    };
  },
  
  async execute(params: TaskParams, context: TaskContext): Promise<TaskResult> {
    const start = Date.now();
    const { recordId, field, value } = params.params as {
      recordId: string;
      field?: string;
      value?: unknown;
    };
    
    // Emit progress event
    if (context.eventBus) {
      await context.eventBus.emit({
        type: 'agent_progress',
        runId: context.runId,
        agentId: this.id,
        message: `Processing ${params.taskType} for record ${recordId}...`,
      });
    }
    
    // Simulate async work (database call, API request, etc.)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      data: {
        operation: params.taskType,
        recordId,
        field,
        value,
        timestamp: new Date().toISOString(),
        mock: true,
      },
      durationMs: Date.now() - start,
      metadata: {
        note: 'This was a mock operation - no actual changes were made',
      },
    };
  },
};

// ============================================
// SLOW AGENT (For testing timeouts)
// ============================================

/**
 * Slow Agent
 * 
 * An agent that takes a configurable amount of time to execute.
 * Useful for testing timeout behavior.
 * 
 * Capabilities: 'slow_task'
 */
export const slowAgent: TaskAgent = {
  id: 'slow_agent',
  name: 'Slow Agent',
  description: 'Takes a configurable time to execute (for testing timeouts)',
  version: '1.0.0',
  executionMode: 'human_out_of_loop',
  capabilities: ['slow_task'],
  
  canHandle(taskType: string): boolean {
    return this.capabilities.includes(taskType);
  },
  
  async prepare(params: TaskParams): Promise<TaskPreparation> {
    const delayMs = (params.params.delayMs as number) || 1000;
    
    return {
      valid: true,
      description: `Wait for ${delayMs}ms`,
      estimatedDuration: `~${delayMs}ms`,
    };
  },
  
  async execute(params: TaskParams, context: TaskContext): Promise<TaskResult> {
    const start = Date.now();
    const delayMs = (params.params.delayMs as number) || 1000;
    
    // Emit progress
    if (context.eventBus) {
      await context.eventBus.emit({
        type: 'agent_progress',
        runId: context.runId,
        agentId: this.id,
        message: `Waiting for ${delayMs}ms...`,
      });
    }
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    return {
      success: true,
      data: {
        requestedDelay: delayMs,
        actualDelay: Date.now() - start,
      },
      durationMs: Date.now() - start,
    };
  },
};

// ============================================
// FAILING AGENT (For testing error handling)
// ============================================

/**
 * Failing Agent
 * 
 * An agent that always fails. Useful for testing error handling
 * and retry logic.
 * 
 * Capabilities: 'fail_task', 'fail_retriable'
 */
export const failingAgent: TaskAgent = {
  id: 'failing_agent',
  name: 'Failing Agent',
  description: 'Always fails (for testing error handling)',
  version: '1.0.0',
  executionMode: 'human_out_of_loop',
  capabilities: ['fail_task', 'fail_retriable'],
  
  canHandle(taskType: string): boolean {
    return this.capabilities.includes(taskType);
  },
  
  async prepare(params: TaskParams): Promise<TaskPreparation> {
    return {
      valid: true,
      description: `Will fail with error: "${params.params.errorMessage || 'Task failed'}"`,
      estimatedDuration: '~100ms',
      warnings: ['This agent is designed to fail for testing purposes'],
    };
  },
  
  async execute(params: TaskParams, context: TaskContext): Promise<TaskResult> {
    const start = Date.now();
    const errorMessage = (params.params.errorMessage as string) || 'Task failed';
    const isRetriable = params.taskType === 'fail_retriable';
    
    // Simulate some work before failing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // If retriable, include keywords that make it retriable
    const error = isRetriable
      ? `network error: ${errorMessage}`
      : errorMessage;
    
    return {
      success: false,
      error,
      durationMs: Date.now() - start,
    };
  },
};

// ============================================
// REGISTRATION HELPER
// ============================================

/**
 * Register all example agents with the task registry
 * 
 * Call this to set up the example agents for testing:
 * 
 *   import { registerExampleAgents } from '@/lib/agents';
 *   registerExampleAgents();
 */
export function registerExampleAgents(): void {
  const agents = [echoAgent, mockUpdateAgent, slowAgent, failingAgent];
  
  for (const agent of agents) {
    if (!taskRegistry.has(agent.id)) {
      taskRegistry.register(agent);
    }
  }
  
  console.log(`[ExampleAgents] Registered ${agents.length} example agents`);
}

/**
 * Unregister all example agents
 * Useful for cleanup after testing
 */
export function unregisterExampleAgents(): void {
  const agents = [echoAgent, mockUpdateAgent, slowAgent, failingAgent];
  
  for (const agent of agents) {
    taskRegistry.unregister(agent.id);
  }
  
  console.log(`[ExampleAgents] Unregistered ${agents.length} example agents`);
}
