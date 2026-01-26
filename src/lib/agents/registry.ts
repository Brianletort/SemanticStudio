/**
 * Task Agent Registry
 * 
 * Central registry for task agents. Agents register themselves
 * and can be discovered by capability/task type.
 * 
 * Usage:
 *   import { taskRegistry } from '@/lib/agents';
 *   
 *   // Register an agent
 *   taskRegistry.register(myAgent);
 *   
 *   // Find agents that can handle a task
 *   const agents = taskRegistry.findByCapability('salesforce_update');
 */

import type { 
  TaskAgent, 
  AgentRegistration, 
  RegistryQueryOptions,
  TaskExecutionMode,
} from './types';

/**
 * Task Agent Registry
 * 
 * Manages registration and discovery of task agents.
 */
export class TaskAgentRegistry {
  /** Map of agent ID to registration */
  private agents: Map<string, AgentRegistration> = new Map();
  
  /** Index of capability to agent IDs for fast lookup */
  private capabilityIndex: Map<string, Set<string>> = new Map();

  /**
   * Register an agent with the registry
   * @param agent - The agent to register
   * @throws Error if an agent with the same ID is already registered
   */
  register(agent: TaskAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID '${agent.id}' is already registered`);
    }

    // Store the registration
    this.agents.set(agent.id, {
      agent,
      registeredAt: new Date(),
    });

    // Index by capabilities
    for (const capability of agent.capabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability)!.add(agent.id);
    }

    console.log(`[TaskRegistry] Registered agent: ${agent.id} (${agent.name}) with capabilities: [${agent.capabilities.join(', ')}]`);
  }

  /**
   * Unregister an agent from the registry
   * @param agentId - The ID of the agent to unregister
   * @returns true if the agent was unregistered, false if not found
   */
  unregister(agentId: string): boolean {
    const registration = this.agents.get(agentId);
    if (!registration) {
      return false;
    }

    // Remove from capability index
    for (const capability of registration.agent.capabilities) {
      const agentIds = this.capabilityIndex.get(capability);
      if (agentIds) {
        agentIds.delete(agentId);
        if (agentIds.size === 0) {
          this.capabilityIndex.delete(capability);
        }
      }
    }

    // Remove from agents map
    this.agents.delete(agentId);

    console.log(`[TaskRegistry] Unregistered agent: ${agentId}`);
    return true;
  }

  /**
   * Get an agent by ID
   * @param agentId - The agent ID
   * @returns The agent or undefined if not found
   */
  get(agentId: string): TaskAgent | undefined {
    return this.agents.get(agentId)?.agent;
  }

  /**
   * Check if an agent is registered
   * @param agentId - The agent ID
   * @returns true if the agent is registered
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Find agents that can handle a specific task type
   * @param taskType - The task type to find agents for
   * @returns Array of agents that can handle the task
   */
  findByCapability(taskType: string): TaskAgent[] {
    const agentIds = this.capabilityIndex.get(taskType);
    if (!agentIds || agentIds.size === 0) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id)?.agent)
      .filter((agent): agent is TaskAgent => agent !== undefined);
  }

  /**
   * Find agents matching query options
   * @param options - Query options
   * @returns Array of matching agents
   */
  find(options: RegistryQueryOptions = {}): TaskAgent[] {
    let agents = this.list();

    if (options.capability) {
      agents = agents.filter(agent => agent.capabilities.includes(options.capability!));
    }

    if (options.executionMode) {
      agents = agents.filter(agent => agent.executionMode === options.executionMode);
    }

    return agents;
  }

  /**
   * List all registered agents
   * @returns Array of all registered agents
   */
  list(): TaskAgent[] {
    return Array.from(this.agents.values()).map(reg => reg.agent);
  }

  /**
   * Get all registered capabilities
   * @returns Array of all capability strings
   */
  listCapabilities(): string[] {
    return Array.from(this.capabilityIndex.keys());
  }

  /**
   * Check if any agent can handle a task type
   * @param taskType - The task type to check
   * @returns true if at least one agent can handle the task
   */
  canHandle(taskType: string): boolean {
    const agentIds = this.capabilityIndex.get(taskType);
    return agentIds !== undefined && agentIds.size > 0;
  }

  /**
   * Find the best agent for a task type
   * Currently returns the first agent found; can be extended with scoring
   * @param taskType - The task type
   * @returns The best agent or undefined if none found
   */
  findBestAgent(taskType: string): TaskAgent | undefined {
    const agents = this.findByCapability(taskType);
    return agents[0]; // Simple: return first match
  }

  /**
   * Get agents by execution mode
   * @param mode - The execution mode
   * @returns Array of agents with the specified mode
   */
  getByExecutionMode(mode: TaskExecutionMode): TaskAgent[] {
    return this.list().filter(agent => agent.executionMode === mode);
  }

  /**
   * Get registry statistics
   * @returns Stats about the registry
   */
  getStats(): {
    totalAgents: number;
    totalCapabilities: number;
    humanInLoopAgents: number;
    humanOutOfLoopAgents: number;
  } {
    const agents = this.list();
    return {
      totalAgents: agents.length,
      totalCapabilities: this.capabilityIndex.size,
      humanInLoopAgents: agents.filter(a => a.executionMode === 'human_in_loop').length,
      humanOutOfLoopAgents: agents.filter(a => a.executionMode === 'human_out_of_loop').length,
    };
  }

  /**
   * Clear all registered agents
   * Useful for testing
   */
  clear(): void {
    this.agents.clear();
    this.capabilityIndex.clear();
    console.log('[TaskRegistry] Cleared all agents');
  }
}

/**
 * Singleton instance of the task agent registry
 */
export const taskRegistry = new TaskAgentRegistry();
