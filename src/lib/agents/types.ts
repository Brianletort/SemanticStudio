/**
 * Task Agent Framework Types
 * 
 * Core types for task-based agent orchestration.
 * Supports both human-in-loop and human-out-of-loop execution patterns.
 */

import type { AgentEventBus } from '@/lib/chat/event-bus';
import type { ToolDefinition } from '@/lib/tools/types';

// ============================================
// EXECUTION MODES
// ============================================

/**
 * Execution mode for task agents
 * - human_in_loop: Requires approval before execution
 * - human_out_of_loop: Executes autonomously
 */
export type TaskExecutionMode = 'human_in_loop' | 'human_out_of_loop';

// ============================================
// TASK AGENT INTERFACE
// ============================================

/**
 * Task Agent definition
 * 
 * Agents register with the registry and can be discovered
 * by their capabilities (task types they can handle).
 */
export interface TaskAgent {
  /** Unique identifier for this agent */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description of what this agent does */
  description: string;
  
  /** Version string (semver recommended) */
  version: string;
  
  /** Execution behavior - determines if approval is required */
  executionMode: TaskExecutionMode;
  
  /** Task types this agent can handle (e.g., 'salesforce_update', 'calendar_lookup') */
  capabilities: string[];
  
  /** Optional: Tool definitions this agent can use */
  tools?: ToolDefinition[];
  
  /**
   * Check if this agent can handle a specific task type
   * @param taskType - The task type to check
   * @returns true if this agent can handle the task
   */
  canHandle(taskType: string): boolean;
  
  /**
   * Prepare a task for execution
   * Validates parameters and builds a human-readable description for approval
   * @param params - Task parameters
   * @returns Preparation result with description and validation status
   */
  prepare(params: TaskParams): Promise<TaskPreparation>;
  
  /**
   * Execute the task
   * @param params - Task parameters
   * @param context - Execution context with event bus, timeout, etc.
   * @returns Task execution result
   */
  execute(params: TaskParams, context: TaskContext): Promise<TaskResult>;
}

// ============================================
// TASK PARAMETERS AND RESULTS
// ============================================

/**
 * Task parameters passed to agents
 */
export interface TaskParams {
  /** The type of task to execute */
  taskType: string;
  
  /** Task-specific parameters */
  params: Record<string, unknown>;
  
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of prepare() - used for approval UI and validation
 */
export interface TaskPreparation {
  /** Whether the parameters are valid */
  valid: boolean;
  
  /** Human-readable description (e.g., "Update Acme account status to Closed") */
  description: string;
  
  /** Estimated execution duration (e.g., "~5 seconds") */
  estimatedDuration?: string;
  
  /** Warnings to show the user before approval */
  warnings?: string[];
  
  /** Error message if valid=false */
  error?: string;
}

/**
 * Task execution result
 */
export interface TaskResult {
  /** Whether the task completed successfully */
  success: boolean;
  
  /** Result data (task-specific) */
  data?: unknown;
  
  /** Error message if success=false */
  error?: string;
  
  /** Execution duration in milliseconds */
  durationMs: number;
  
  /** Optional metadata about the execution */
  metadata?: Record<string, unknown>;
}

// ============================================
// EXECUTION CONTEXT
// ============================================

/**
 * Context passed to agents during execution
 */
export interface TaskContext {
  /** Unique ID for this task execution */
  taskId: string;
  
  /** Run ID for event correlation */
  runId: string;
  
  /** Optional session ID */
  sessionId?: string;
  
  /** Optional user ID */
  userId?: string;
  
  /** Event bus for emitting observability events */
  eventBus?: AgentEventBus;
  
  /** Execution timeout in milliseconds */
  timeout?: number;
  
  /** Retry policy for failed executions */
  retryPolicy?: RetryPolicy;
}

// ============================================
// RETRY POLICY
// ============================================

/**
 * Retry policy for failed task executions
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Initial delay between retries in milliseconds */
  initialDelayMs: number;
  
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Default task timeout (30 seconds)
 */
export const DEFAULT_TASK_TIMEOUT = 30000;

// ============================================
// REGISTRY TYPES
// ============================================

/**
 * Agent registration info
 */
export interface AgentRegistration {
  agent: TaskAgent;
  registeredAt: Date;
}

/**
 * Registry query options
 */
export interface RegistryQueryOptions {
  /** Filter by execution mode */
  executionMode?: TaskExecutionMode;
  
  /** Filter by capability */
  capability?: string;
}
