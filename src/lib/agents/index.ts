/**
 * Task Agent Framework
 * 
 * Provides infrastructure for task-based agent orchestration.
 * Agents can be human-in-loop (requires approval) or 
 * human-out-of-loop (autonomous execution).
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { 
 *   taskRegistry, 
 *   createTaskExecutor, 
 *   registerExampleAgents,
 * } from '@/lib/agents';
 * 
 * // Register example agents for testing
 * registerExampleAgents();
 * 
 * // Create an executor with event bus for observability
 * const executor = createTaskExecutor(eventBus);
 * 
 * // Execute a task
 * const result = await executor.execute({
 *   taskType: 'echo',
 *   params: { message: 'Hello, world!' },
 * });
 * ```
 * 
 * ## Creating Custom Agents
 * 
 * ```typescript
 * import type { TaskAgent } from '@/lib/agents';
 * import { taskRegistry } from '@/lib/agents';
 * 
 * const myAgent: TaskAgent = {
 *   id: 'my_agent',
 *   name: 'My Agent',
 *   description: 'Does something useful',
 *   version: '1.0.0',
 *   executionMode: 'human_out_of_loop', // or 'human_in_loop'
 *   capabilities: ['my_task'],
 *   
 *   canHandle(taskType) {
 *     return this.capabilities.includes(taskType);
 *   },
 *   
 *   async prepare(params) {
 *     return {
 *       valid: true,
 *       description: 'Execute my task',
 *     };
 *   },
 *   
 *   async execute(params, context) {
 *     // Do work...
 *     return { success: true, durationMs: 100 };
 *   },
 * };
 * 
 * taskRegistry.register(myAgent);
 * ```
 */

// ============================================
// TYPES
// ============================================

export type {
  TaskExecutionMode,
  TaskAgent,
  TaskParams,
  TaskPreparation,
  TaskResult,
  TaskContext,
  RetryPolicy,
  AgentRegistration,
  RegistryQueryOptions,
} from './types';

export {
  DEFAULT_RETRY_POLICY,
  DEFAULT_TASK_TIMEOUT,
} from './types';

// ============================================
// REGISTRY
// ============================================

export { 
  TaskAgentRegistry,
  taskRegistry,
} from './registry';

// ============================================
// EXECUTOR
// ============================================

export {
  TaskExecutor,
  createTaskExecutor,
} from './executor';

export type {
  ExecuteOptions,
  ExecuteResult,
} from './executor';

// ============================================
// EXAMPLE AGENTS
// ============================================

export {
  echoAgent,
  mockUpdateAgent,
  slowAgent,
  failingAgent,
  registerExampleAgents,
  unregisterExampleAgents,
} from './example-agent';
