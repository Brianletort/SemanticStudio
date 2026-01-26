/**
 * Task Agent Framework Tests
 * 
 * Tests for the task agent registry, executor, and example agents.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  taskRegistry,
  TaskAgentRegistry,
  createTaskExecutor,
  TaskExecutor,
  echoAgent,
  mockUpdateAgent,
  slowAgent,
  failingAgent,
  registerExampleAgents,
  unregisterExampleAgents,
  DEFAULT_RETRY_POLICY,
  DEFAULT_TASK_TIMEOUT,
} from '@/lib/agents';
import type { TaskAgent, TaskParams, TaskContext, TaskResult } from '@/lib/agents';

// ============================================
// REGISTRY TESTS
// ============================================

describe('TaskAgentRegistry', () => {
  let registry: TaskAgentRegistry;

  beforeEach(() => {
    registry = new TaskAgentRegistry();
  });

  describe('register', () => {
    it('should register an agent', () => {
      registry.register(echoAgent);
      expect(registry.has(echoAgent.id)).toBe(true);
      expect(registry.get(echoAgent.id)).toBe(echoAgent);
    });

    it('should throw if agent with same ID is already registered', () => {
      registry.register(echoAgent);
      expect(() => registry.register(echoAgent)).toThrow(/already registered/);
    });

    it('should index agent by capabilities', () => {
      registry.register(echoAgent);
      const agents = registry.findByCapability('echo');
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe(echoAgent.id);
    });
  });

  describe('unregister', () => {
    it('should unregister an agent', () => {
      registry.register(echoAgent);
      const result = registry.unregister(echoAgent.id);
      expect(result).toBe(true);
      expect(registry.has(echoAgent.id)).toBe(false);
    });

    it('should return false for non-existent agent', () => {
      const result = registry.unregister('non_existent');
      expect(result).toBe(false);
    });

    it('should remove agent from capability index', () => {
      registry.register(echoAgent);
      registry.unregister(echoAgent.id);
      const agents = registry.findByCapability('echo');
      expect(agents).toHaveLength(0);
    });
  });

  describe('findByCapability', () => {
    beforeEach(() => {
      registry.register(echoAgent);
      registry.register(mockUpdateAgent);
    });

    it('should find agents by capability', () => {
      const agents = registry.findByCapability('echo');
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('echo_agent');
    });

    it('should return empty array for unknown capability', () => {
      const agents = registry.findByCapability('unknown');
      expect(agents).toHaveLength(0);
    });
  });

  describe('canHandle', () => {
    it('should return true if an agent can handle the task type', () => {
      registry.register(echoAgent);
      expect(registry.canHandle('echo')).toBe(true);
    });

    it('should return false if no agent can handle the task type', () => {
      expect(registry.canHandle('unknown')).toBe(false);
    });
  });

  describe('findBestAgent', () => {
    it('should return the first matching agent', () => {
      registry.register(echoAgent);
      registry.register(mockUpdateAgent);
      const agent = registry.findBestAgent('echo');
      expect(agent?.id).toBe('echo_agent');
    });

    it('should return undefined for unknown task type', () => {
      const agent = registry.findBestAgent('unknown');
      expect(agent).toBeUndefined();
    });
  });

  describe('getByExecutionMode', () => {
    beforeEach(() => {
      registry.register(echoAgent);
      registry.register(mockUpdateAgent);
    });

    it('should return agents by execution mode', () => {
      const humanInLoop = registry.getByExecutionMode('human_in_loop');
      expect(humanInLoop).toHaveLength(1);
      expect(humanInLoop[0].id).toBe('mock_update_agent');

      const humanOutOfLoop = registry.getByExecutionMode('human_out_of_loop');
      expect(humanOutOfLoop).toHaveLength(1);
      expect(humanOutOfLoop[0].id).toBe('echo_agent');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      registry.register(echoAgent);
      registry.register(mockUpdateAgent);
      
      const stats = registry.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.humanInLoopAgents).toBe(1);
      expect(stats.humanOutOfLoopAgents).toBe(1);
      expect(stats.totalCapabilities).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should remove all agents', () => {
      registry.register(echoAgent);
      registry.register(mockUpdateAgent);
      registry.clear();
      expect(registry.list()).toHaveLength(0);
    });
  });
});

// ============================================
// EXECUTOR TESTS
// ============================================

describe('TaskExecutor', () => {
  let executor: TaskExecutor;

  beforeEach(() => {
    // Clear the singleton registry and register example agents
    taskRegistry.clear();
    registerExampleAgents();
    executor = createTaskExecutor();
  });

  afterEach(() => {
    unregisterExampleAgents();
    taskRegistry.clear();
  });

  describe('execute', () => {
    it('should execute echo agent successfully', async () => {
      const result = await executor.execute({
        taskType: 'echo',
        params: { message: 'Hello, world!' },
      });

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('echo_agent');
      expect(result.requiresApproval).toBe(false);
      expect(result.data).toEqual({
        echoed: 'Hello, world!',
        timestamp: expect.any(String),
      });
    });

    it('should fail when no agent can handle task type', async () => {
      const result = await executor.execute({
        taskType: 'unknown_task',
        params: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No agent found');
    });

    it('should fail when preparation fails', async () => {
      const result = await executor.execute({
        taskType: 'echo',
        params: {}, // Missing required 'message' parameter
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('message');
    });
  });

  describe('human-in-loop approval', () => {
    it('should reject task when no approval callback provided', async () => {
      const result = await executor.execute({
        taskType: 'mock_update',
        params: { recordId: '123' },
      });

      expect(result.success).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approved).toBe(false);
      expect(result.error).toContain('rejected');
    });

    it('should execute when approval callback returns true', async () => {
      const onApprovalRequired = vi.fn().mockResolvedValue(true);

      const result = await executor.execute({
        taskType: 'mock_update',
        params: { recordId: '123', field: 'status', value: 'closed' },
        onApprovalRequired,
      });

      expect(onApprovalRequired).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.approved).toBe(true);
    });

    it('should reject when approval callback returns false', async () => {
      const onApprovalRequired = vi.fn().mockResolvedValue(false);

      const result = await executor.execute({
        taskType: 'mock_update',
        params: { recordId: '123' },
        onApprovalRequired,
      });

      expect(onApprovalRequired).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.approved).toBe(false);
    });

    it('should pass preparation to approval callback', async () => {
      const onApprovalRequired = vi.fn().mockResolvedValue(true);

      await executor.execute({
        taskType: 'mock_update',
        params: { recordId: '123', field: 'status', value: 'active' },
        onApprovalRequired,
      });

      expect(onApprovalRequired).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          description: expect.stringContaining('123'),
          warnings: expect.any(Array),
        }),
        expect.objectContaining({
          id: 'mock_update_agent',
        }),
      );
    });
  });

  describe('executeWithAutoApproval', () => {
    it('should auto-approve human-in-loop tasks', async () => {
      const result = await executor.executeWithAutoApproval({
        taskType: 'mock_update',
        params: { recordId: '456' },
      });

      expect(result.success).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.approved).toBe(true);
    });
  });

  describe('timeout handling', () => {
    it('should timeout slow tasks', async () => {
      const result = await executor.execute({
        taskType: 'slow_task',
        params: { delayMs: 5000 },
        timeout: 100, // Very short timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    }, 10000);
  });

  describe('error handling', () => {
    it('should handle failing agents', async () => {
      const result = await executor.execute({
        taskType: 'fail_task',
        params: { errorMessage: 'Something went wrong' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Something went wrong');
    });
  });

  describe('canHandle', () => {
    it('should return true for registered capabilities', () => {
      expect(executor.canHandle('echo')).toBe(true);
      expect(executor.canHandle('mock_update')).toBe(true);
    });

    it('should return false for unregistered capabilities', () => {
      expect(executor.canHandle('unknown')).toBe(false);
    });
  });

  describe('getAvailableTaskTypes', () => {
    it('should return all registered capabilities', () => {
      const taskTypes = executor.getAvailableTaskTypes();
      expect(taskTypes).toContain('echo');
      expect(taskTypes).toContain('test');
      expect(taskTypes).toContain('mock_update');
      expect(taskTypes).toContain('slow_task');
      expect(taskTypes).toContain('fail_task');
    });
  });
});

// ============================================
// EXAMPLE AGENTS TESTS
// ============================================

describe('Example Agents', () => {
  describe('echoAgent', () => {
    it('should have correct metadata', () => {
      expect(echoAgent.id).toBe('echo_agent');
      expect(echoAgent.executionMode).toBe('human_out_of_loop');
      expect(echoAgent.capabilities).toContain('echo');
    });

    it('should handle echo capability', () => {
      expect(echoAgent.canHandle('echo')).toBe(true);
      expect(echoAgent.canHandle('unknown')).toBe(false);
    });

    it('should prepare valid params', async () => {
      const prep = await echoAgent.prepare({
        taskType: 'echo',
        params: { message: 'test' },
      });
      expect(prep.valid).toBe(true);
      expect(prep.description).toContain('test');
    });

    it('should reject missing message', async () => {
      const prep = await echoAgent.prepare({
        taskType: 'echo',
        params: {},
      });
      expect(prep.valid).toBe(false);
    });

    it('should execute successfully', async () => {
      const result = await echoAgent.execute(
        { taskType: 'echo', params: { message: 'hello' } },
        { taskId: 'test', runId: 'test' },
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        echoed: 'hello',
        timestamp: expect.any(String),
      });
    });
  });

  describe('mockUpdateAgent', () => {
    it('should have correct metadata', () => {
      expect(mockUpdateAgent.id).toBe('mock_update_agent');
      expect(mockUpdateAgent.executionMode).toBe('human_in_loop');
      expect(mockUpdateAgent.capabilities).toContain('mock_update');
    });

    it('should prepare valid params', async () => {
      const prep = await mockUpdateAgent.prepare({
        taskType: 'mock_update',
        params: { recordId: '123' },
      });
      expect(prep.valid).toBe(true);
      expect(prep.warnings).toBeDefined();
    });

    it('should reject missing recordId', async () => {
      const prep = await mockUpdateAgent.prepare({
        taskType: 'mock_update',
        params: {},
      });
      expect(prep.valid).toBe(false);
    });
  });

  describe('slowAgent', () => {
    it('should wait for specified delay', async () => {
      const start = Date.now();
      const result = await slowAgent.execute(
        { taskType: 'slow_task', params: { delayMs: 200 } },
        { taskId: 'test', runId: 'test' },
      );
      const elapsed = Date.now() - start;
      
      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(200);
    });
  });

  describe('failingAgent', () => {
    it('should always fail', async () => {
      const result = await failingAgent.execute(
        { taskType: 'fail_task', params: { errorMessage: 'test error' } },
        { taskId: 'test', runId: 'test' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('test error');
    });
  });
});

// ============================================
// HELPER FUNCTION TESTS
// ============================================

describe('Helper Functions', () => {
  beforeEach(() => {
    taskRegistry.clear();
  });

  afterEach(() => {
    taskRegistry.clear();
  });

  describe('registerExampleAgents', () => {
    it('should register all example agents', () => {
      registerExampleAgents();
      expect(taskRegistry.has('echo_agent')).toBe(true);
      expect(taskRegistry.has('mock_update_agent')).toBe(true);
      expect(taskRegistry.has('slow_agent')).toBe(true);
      expect(taskRegistry.has('failing_agent')).toBe(true);
    });

    it('should not throw if called twice', () => {
      registerExampleAgents();
      expect(() => registerExampleAgents()).not.toThrow();
    });
  });

  describe('unregisterExampleAgents', () => {
    it('should unregister all example agents', () => {
      registerExampleAgents();
      unregisterExampleAgents();
      expect(taskRegistry.has('echo_agent')).toBe(false);
      expect(taskRegistry.has('mock_update_agent')).toBe(false);
    });
  });
});

// ============================================
// CONSTANTS TESTS
// ============================================

describe('Constants', () => {
  it('should have valid default retry policy', () => {
    expect(DEFAULT_RETRY_POLICY.maxRetries).toBeGreaterThan(0);
    expect(DEFAULT_RETRY_POLICY.initialDelayMs).toBeGreaterThan(0);
    expect(DEFAULT_RETRY_POLICY.maxDelayMs).toBeGreaterThan(DEFAULT_RETRY_POLICY.initialDelayMs);
    expect(DEFAULT_RETRY_POLICY.backoffMultiplier).toBeGreaterThan(1);
  });

  it('should have valid default timeout', () => {
    expect(DEFAULT_TASK_TIMEOUT).toBeGreaterThan(0);
  });
});
