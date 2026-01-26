/**
 * Task Executor
 * 
 * Executes tasks through registered agents with:
 * - Routing to appropriate agent
 * - Human-in-loop approval workflow
 * - Timeout and retry handling
 * - Event bus integration for observability
 * 
 * Usage:
 *   const executor = createTaskExecutor(eventBus);
 *   const result = await executor.execute({
 *     taskType: 'salesforce_update',
 *     params: { accountId: '123', status: 'closed' },
 *   });
 */

import { v4 as uuidv4 } from 'uuid';
import type { AgentEventBus } from '@/lib/chat/event-bus';
import type {
  TaskAgent,
  TaskParams,
  TaskResult,
  TaskContext,
  TaskPreparation,
  RetryPolicy,
} from './types';
import { DEFAULT_RETRY_POLICY, DEFAULT_TASK_TIMEOUT } from './types';
import { taskRegistry } from './registry';

// ============================================
// EXECUTOR OPTIONS
// ============================================

/**
 * Options for task execution
 */
export interface ExecuteOptions {
  /** The type of task to execute */
  taskType: string;
  
  /** Task-specific parameters */
  params: Record<string, unknown>;
  
  /** Optional: Specific agent ID to use (skips routing) */
  agentId?: string;
  
  /** Execution timeout in milliseconds */
  timeout?: number;
  
  /** Retry policy for failed executions */
  retryPolicy?: RetryPolicy;
  
  /** Optional metadata to pass through */
  metadata?: Record<string, unknown>;
  
  /**
   * Callback when approval is required (human-in-loop agents)
   * Return true to approve, false to reject
   * If not provided, human-in-loop agents will be rejected
   */
  onApprovalRequired?: (preparation: TaskPreparation, agent: TaskAgent) => Promise<boolean>;
  
  /**
   * Optional: User ID for approval tracking
   */
  userId?: string;
}

/**
 * Extended execution result with additional metadata
 */
export interface ExecuteResult extends TaskResult {
  /** The task ID */
  taskId: string;
  
  /** The agent that executed the task */
  agentId: string;
  
  /** Whether approval was required */
  requiresApproval: boolean;
  
  /** Whether the task was approved (only set if requiresApproval is true) */
  approved?: boolean;
}

// ============================================
// TASK EXECUTOR
// ============================================

/**
 * Task Executor
 * 
 * Orchestrates task execution through registered agents.
 */
export class TaskExecutor {
  constructor(
    private eventBus?: AgentEventBus,
    private defaultTimeout: number = DEFAULT_TASK_TIMEOUT,
    private defaultRetryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
  ) {}

  /**
   * Execute a task
   * 
   * Flow:
   * 1. Find agent for task type
   * 2. Emit task_requested event
   * 3. Call agent.prepare()
   * 4. If human_in_loop: emit task_pending_approval, await callback
   * 5. Emit task_executing
   * 6. Call agent.execute() with timeout/retry
   * 7. Emit task_result or task_failed
   * 8. Return result
   */
  async execute(options: ExecuteOptions, context?: Partial<TaskContext>): Promise<ExecuteResult> {
    const taskId = uuidv4();
    const runId = context?.runId || uuidv4();
    const startTime = Date.now();

    // Build task params
    const taskParams: TaskParams = {
      taskType: options.taskType,
      params: options.params,
      metadata: options.metadata,
    };

    // Build full context
    const fullContext: TaskContext = {
      taskId,
      runId,
      sessionId: context?.sessionId,
      userId: options.userId || context?.userId,
      eventBus: this.eventBus,
      timeout: options.timeout || this.defaultTimeout,
      retryPolicy: options.retryPolicy || this.defaultRetryPolicy,
    };

    try {
      // Step 1: Find agent
      const agent = await this.findAgent(options.taskType, options.agentId);
      const requiresApproval = agent.executionMode === 'human_in_loop';

      // Step 2: Emit task_requested
      await this.emitTaskRequested(taskId, runId, options.taskType, agent.id, taskParams.params, requiresApproval);

      // Step 3: Emit task_routed
      await this.emitTaskRouted(taskId, runId, options.taskType, agent);

      // Step 4: Prepare the task
      const preparation = await agent.prepare(taskParams);
      
      if (!preparation.valid) {
        const error = preparation.error || 'Task preparation failed';
        await this.emitTaskFailed(taskId, runId, agent.id, error, false, Date.now() - startTime);
        return this.buildFailureResult(taskId, agent.id, error, Date.now() - startTime, requiresApproval);
      }

      // Step 5: Handle human-in-loop approval
      if (requiresApproval) {
        const approved = await this.handleApproval(
          taskId,
          runId,
          agent,
          preparation,
          taskParams,
          options.onApprovalRequired,
          options.userId,
        );

        if (!approved) {
          return this.buildFailureResult(
            taskId,
            agent.id,
            'Task rejected by user',
            Date.now() - startTime,
            requiresApproval,
            false, // approved = false
          );
        }
      }

      // Step 6: Execute the task
      await this.emitTaskExecuting(taskId, runId, agent.id, preparation.estimatedDuration);

      const result = await this.executeWithRetry(agent, taskParams, fullContext);

      // Step 7: Emit result
      if (result.success) {
        await this.emitTaskResult(taskId, runId, agent.id, result);
      } else {
        const retriable = this.isRetriable(result);
        await this.emitTaskFailed(taskId, runId, agent.id, result.error || 'Unknown error', retriable, result.durationMs);
      }

      // Step 8: Return result
      return {
        ...result,
        taskId,
        agentId: agent.id,
        requiresApproval,
        approved: requiresApproval ? true : undefined,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const durationMs = Date.now() - startTime;
      
      await this.emitTaskFailed(taskId, runId, options.agentId || 'unknown', errorMessage, false, durationMs);
      
      return this.buildFailureResult(
        taskId,
        options.agentId || 'unknown',
        errorMessage,
        durationMs,
        false,
      );
    }
  }

  /**
   * Execute with automatic approval (for testing or trusted contexts)
   * Human-in-loop agents will be auto-approved
   */
  async executeWithAutoApproval(options: ExecuteOptions, context?: Partial<TaskContext>): Promise<ExecuteResult> {
    return this.execute({
      ...options,
      onApprovalRequired: async () => true,
    }, context);
  }

  /**
   * Check if any agent can handle a task type
   */
  canHandle(taskType: string): boolean {
    return taskRegistry.canHandle(taskType);
  }

  /**
   * Get available task types
   */
  getAvailableTaskTypes(): string[] {
    return taskRegistry.listCapabilities();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async findAgent(taskType: string, specificAgentId?: string): Promise<TaskAgent> {
    if (specificAgentId) {
      const agent = taskRegistry.get(specificAgentId);
      if (!agent) {
        throw new Error(`Agent '${specificAgentId}' not found`);
      }
      if (!agent.canHandle(taskType)) {
        throw new Error(`Agent '${specificAgentId}' cannot handle task type '${taskType}'`);
      }
      return agent;
    }

    const agent = taskRegistry.findBestAgent(taskType);
    if (!agent) {
      throw new Error(`No agent found for task type '${taskType}'`);
    }
    return agent;
  }

  private async handleApproval(
    taskId: string,
    runId: string,
    agent: TaskAgent,
    preparation: TaskPreparation,
    params: TaskParams,
    onApprovalRequired?: (prep: TaskPreparation, agent: TaskAgent) => Promise<boolean>,
    userId?: string,
  ): Promise<boolean> {
    // Emit pending approval event
    await this.emitTaskPendingApproval(taskId, runId, agent.id, preparation, params);

    // If no callback, reject
    if (!onApprovalRequired) {
      await this.emitTaskRejected(taskId, runId, agent.id, userId, 'No approval callback provided');
      return false;
    }

    // Wait for approval
    const approved = await onApprovalRequired(preparation, agent);

    if (approved) {
      await this.emitTaskApproved(taskId, runId, agent.id, userId);
    } else {
      await this.emitTaskRejected(taskId, runId, agent.id, userId);
    }

    return approved;
  }

  private async executeWithRetry(
    agent: TaskAgent,
    params: TaskParams,
    context: TaskContext,
  ): Promise<TaskResult> {
    const retryPolicy = context.retryPolicy || this.defaultRetryPolicy;
    let lastError: Error | undefined;
    let delay = retryPolicy.initialDelayMs;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(agent, params, context);
        
        // If successful or non-retriable error, return
        if (result.success || !this.isRetriable(result)) {
          return result;
        }

        // Store error for potential retry
        lastError = new Error(result.error || 'Unknown error');

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }

      // Don't sleep after the last attempt
      if (attempt < retryPolicy.maxRetries) {
        await this.sleep(delay);
        delay = Math.min(delay * retryPolicy.backoffMultiplier, retryPolicy.maxDelayMs);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Max retries exceeded',
      durationMs: 0, // Will be set by caller
    };
  }

  private async executeWithTimeout(
    agent: TaskAgent,
    params: TaskParams,
    context: TaskContext,
  ): Promise<TaskResult> {
    const timeout = context.timeout || this.defaultTimeout;
    const startTime = Date.now();

    const timeoutPromise = new Promise<TaskResult>((_, reject) => {
      setTimeout(() => reject(new Error(`Task timed out after ${timeout}ms`)), timeout);
    });

    const executePromise = agent.execute(params, context);

    try {
      const result = await Promise.race([executePromise, timeoutPromise]);
      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  private isRetriable(result: TaskResult): boolean {
    // Simple heuristic: timeout errors are retriable
    if (result.error?.includes('timed out')) {
      return true;
    }
    // Network errors are typically retriable
    if (result.error?.includes('network') || result.error?.includes('ECONNREFUSED')) {
      return true;
    }
    return false;
  }

  private buildFailureResult(
    taskId: string,
    agentId: string,
    error: string,
    durationMs: number,
    requiresApproval: boolean,
    approved?: boolean,
  ): ExecuteResult {
    return {
      success: false,
      error,
      durationMs,
      taskId,
      agentId,
      requiresApproval,
      approved,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // EVENT EMISSION HELPERS
  // ============================================

  private async emitTaskRequested(
    taskId: string,
    runId: string,
    taskType: string,
    agentId: string,
    params: Record<string, unknown>,
    requiresApproval: boolean,
  ): Promise<void> {
    if (!this.eventBus) return;
    await this.eventBus.emit({
      type: 'task_requested',
      runId,
      taskId,
      taskType,
      agentId,
      params,
      requiresApproval,
    });
  }

  private async emitTaskRouted(
    taskId: string,
    runId: string,
    taskType: string,
    agent: TaskAgent,
  ): Promise<void> {
    if (!this.eventBus) return;
    await this.eventBus.emit({
      type: 'task_routed',
      runId,
      taskId,
      taskType,
      agentId: agent.id,
      agentName: agent.name,
      executionMode: agent.executionMode,
    });
  }

  private async emitTaskPendingApproval(
    taskId: string,
    runId: string,
    agentId: string,
    preparation: TaskPreparation,
    params: TaskParams,
  ): Promise<void> {
    if (!this.eventBus) return;
    await this.eventBus.emit({
      type: 'task_pending_approval',
      runId,
      taskId,
      agentId,
      description: preparation.description,
      params: params.params,
      warnings: preparation.warnings,
    });
  }

  private async emitTaskApproved(
    taskId: string,
    runId: string,
    agentId: string,
    approvedBy?: string,
  ): Promise<void> {
    if (!this.eventBus) return;
    await this.eventBus.emit({
      type: 'task_approved',
      runId,
      taskId,
      agentId,
      approvedBy,
    });
  }

  private async emitTaskRejected(
    taskId: string,
    runId: string,
    agentId: string,
    rejectedBy?: string,
    reason?: string,
  ): Promise<void> {
    if (!this.eventBus) return;
    await this.eventBus.emit({
      type: 'task_rejected',
      runId,
      taskId,
      agentId,
      rejectedBy,
      reason,
    });
  }

  private async emitTaskExecuting(
    taskId: string,
    runId: string,
    agentId: string,
    estimatedDuration?: string,
  ): Promise<void> {
    if (!this.eventBus) return;
    await this.eventBus.emit({
      type: 'task_executing',
      runId,
      taskId,
      agentId,
      estimatedDuration,
    });
  }

  private async emitTaskResult(
    taskId: string,
    runId: string,
    agentId: string,
    result: TaskResult,
  ): Promise<void> {
    if (!this.eventBus) return;
    await this.eventBus.emit({
      type: 'task_result',
      runId,
      taskId,
      agentId,
      success: result.success,
      data: result.data,
      durationMs: result.durationMs,
    });
  }

  private async emitTaskFailed(
    taskId: string,
    runId: string,
    agentId: string,
    error: string,
    retriable: boolean,
    durationMs: number,
  ): Promise<void> {
    if (!this.eventBus) return;
    await this.eventBus.emit({
      type: 'task_failed',
      runId,
      taskId,
      agentId,
      error,
      retriable,
      durationMs,
    });
  }
}

/**
 * Factory function to create a TaskExecutor
 */
export function createTaskExecutor(
  eventBus?: AgentEventBus,
  defaultTimeout?: number,
  defaultRetryPolicy?: RetryPolicy,
): TaskExecutor {
  return new TaskExecutor(eventBus, defaultTimeout, defaultRetryPolicy);
}
