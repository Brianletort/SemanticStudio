/**
 * ETL Orchestrator
 * 
 * Manages ETL job execution, scheduling, and coordination.
 */

import { db } from '@/lib/db';
import { etlJobs, etlJobRuns, dataSources } from '@/lib/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { ETLJobDefinition, JobRunResult, JobType, ETLAgentEvent } from './types';
import { BaseETLAgent } from './base-agent';

// Agent registry - maps job types to their implementations
type AgentConstructor = new (job: ETLJobDefinition) => BaseETLAgent;
const agentRegistry = new Map<JobType, AgentConstructor>();

/**
 * Register an ETL agent for a job type
 */
export function registerAgent(jobType: JobType, agentClass: AgentConstructor): void {
  agentRegistry.set(jobType, agentClass);
}

/**
 * ETL Orchestrator - Singleton pattern
 */
class ETLOrchestratorClass {
  private runningJobs = new Map<string, BaseETLAgent>();
  private eventListeners: Array<(event: ETLAgentEvent & { jobId: string }) => void> = [];

  /**
   * Subscribe to all orchestrator events
   */
  onEvent(listener: (event: ETLAgentEvent & { jobId: string }) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const idx = this.eventListeners.indexOf(listener);
      if (idx !== -1) this.eventListeners.splice(idx, 1);
    };
  }

  private emitEvent(jobId: string, event: ETLAgentEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener({ ...event, jobId });
      } catch (error) {
        console.error('Orchestrator event listener error:', error);
      }
    }
  }

  /**
   * Create a new ETL job
   */
  async createJob(definition: ETLJobDefinition): Promise<string> {
    const [job] = await db.insert(etlJobs).values({
      jobType: definition.jobType,
      status: 'pending',
      config: definition as unknown as Record<string, unknown>,
    }).returning();
    return job.id;
  }

  /**
   * Execute a job by ID
   */
  async executeJob(jobId: string): Promise<JobRunResult> {
    // Get job from database
    const jobs = await db.select().from(etlJobs).where(eq(etlJobs.id, jobId));
    if (jobs.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const job = jobs[0];
    const definition = job.config as unknown as ETLJobDefinition;

    // Get the agent class for this job type
    const AgentClass = agentRegistry.get(definition.jobType);
    if (!AgentClass) {
      throw new Error(`No agent registered for job type: ${definition.jobType}`);
    }

    // Create and execute agent
    const agent = new AgentClass(definition);
    this.runningJobs.set(jobId, agent);

    // Forward agent events
    agent.onEvent((event) => this.emitEvent(jobId, event));

    try {
      const result = await agent.execute();
      return result;
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * Execute a job directly from definition (without storing first)
   */
  async executeJobDirect(definition: ETLJobDefinition): Promise<JobRunResult> {
    const AgentClass = agentRegistry.get(definition.jobType);
    if (!AgentClass) {
      throw new Error(`No agent registered for job type: ${definition.jobType}`);
    }

    const agent = new AgentClass(definition);
    
    // Generate a temporary ID
    const tempId = `temp-${Date.now()}`;
    this.runningJobs.set(tempId, agent);
    agent.onEvent((event) => this.emitEvent(tempId, event));

    try {
      return await agent.execute();
    } finally {
      this.runningJobs.delete(tempId);
    }
  }

  /**
   * Get list of running jobs
   */
  getRunningJobs(): string[] {
    return Array.from(this.runningJobs.keys());
  }

  /**
   * Check if a job is running
   */
  isJobRunning(jobId: string): boolean {
    return this.runningJobs.has(jobId);
  }

  /**
   * Get all jobs with optional filters
   */
  async getJobs(options?: {
    status?: string[];
    jobType?: string[];
    limit?: number;
  }) {
    let query = db.select().from(etlJobs);
    
    const conditions = [];
    if (options?.status?.length) {
      conditions.push(inArray(etlJobs.status, options.status));
    }
    if (options?.jobType?.length) {
      conditions.push(inArray(etlJobs.jobType, options.jobType));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const results = await query
      .orderBy(desc(etlJobs.createdAt))
      .limit(options?.limit || 100);
    
    return results;
  }

  /**
   * Get job runs for a job
   */
  async getJobRuns(jobId: string, limit: number = 10) {
    return db.select({
      id: etlJobRuns.id,
      status: etlJobRuns.status,
      startedAt: etlJobRuns.startedAt,
      completedAt: etlJobRuns.completedAt,
      recordsProcessed: etlJobRuns.recordsProcessed,
      parIterations: etlJobRuns.parIterations,
    })
      .from(etlJobRuns)
      .where(eq(etlJobRuns.jobId, jobId))
      .orderBy(desc(etlJobRuns.createdAt))
      .limit(limit);
  }

  /**
   * Get all data sources
   */
  async getDataSources() {
    return db.select({
      id: dataSources.id,
      name: dataSources.name,
      displayName: dataSources.displayName,
      sourceType: dataSources.sourceType,
      status: dataSources.status,
      lastSyncAt: dataSources.lastSyncAt,
    }).from(dataSources);
  }

  /**
   * Create a data source
   */
  async createDataSource(data: {
    name: string;
    displayName: string;
    sourceType: string;
    config?: Record<string, unknown>;
    syncFrequency?: string;
  }): Promise<string> {
    const [source] = await db.insert(dataSources).values({
      name: data.name,
      displayName: data.displayName,
      sourceType: data.sourceType,
      config: data.config || {},
      syncFrequency: data.syncFrequency,
    }).returning();
    return source.id;
  }

  /**
   * Update data source sync timestamp
   */
  async updateDataSourceSync(sourceId: string): Promise<void> {
    await db.update(dataSources)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(dataSources.id, sourceId));
  }

  /**
   * Get registered job types
   */
  getRegisteredJobTypes(): JobType[] {
    return Array.from(agentRegistry.keys());
  }
}

// Export singleton instance
export const ETLOrchestrator = new ETLOrchestratorClass();
