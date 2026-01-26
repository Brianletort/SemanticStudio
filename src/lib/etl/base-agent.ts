/**
 * Base ETL Agent with PAR Loop
 * 
 * Implements the Plan-Act-Reflect pattern for self-correcting ETL operations.
 */

import { db } from '@/lib/db';
import { etlJobs, etlJobRuns, etlKnowledge } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { chat } from '@/lib/llm';
import type {
  ETLJobDefinition,
  JobRunResult,
  JobStatus,
  PARPerception,
  PARAction,
  PARReflection,
  ETLError,
  ETLAgentEvent,
  ETLAgentEventHandler,
} from './types';

export abstract class BaseETLAgent {
  protected jobId: string | null = null;
  protected runId: string | null = null;
  protected eventHandlers: ETLAgentEventHandler[] = [];

  constructor(protected jobDefinition: ETLJobDefinition) {}

  /**
   * Subscribe to agent events
   */
  onEvent(handler: ETLAgentEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Emit an event to all handlers
   */
  protected emit(event: ETLAgentEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }

  /**
   * Execute the ETL job with PAR loop
   */
  async execute(): Promise<JobRunResult> {
    const startedAt = new Date();
    let status: JobStatus = 'running';
    const errors: ETLError[] = [];
    let recordsProcessed = 0;
    let recordsFailed = 0;
    let parIterations = 0;
    const reflexionImprovements: string[] = [];

    try {
      // Create job record if not exists
      if (!this.jobId) {
        const [job] = await db.insert(etlJobs).values({
          jobType: this.jobDefinition.jobType,
          status: 'running',
          config: this.jobDefinition as unknown as Record<string, unknown>,
          startedAt,
        }).returning();
        this.jobId = job.id;
      } else {
        await db.update(etlJobs)
          .set({ status: 'running', startedAt })
          .where(eq(etlJobs.id, this.jobId));
      }

      // Create job run record
      const [run] = await db.insert(etlJobRuns).values({
        jobId: this.jobId,
        status: 'running',
        startedAt,
      }).returning();
      this.runId = run.id;

      this.emit({ type: 'job_started', jobId: this.jobId, runId: this.runId });

      // Execute PAR loop
      const result = await this.parLoop(
        () => this.perceive(),
        (perception) => this.act(perception),
        (action, perception) => this.reflect(action, perception),
        3 // Max iterations
      );

      if (result) {
        recordsProcessed = result.metrics?.recordsProcessed || 0;
        recordsFailed = result.metrics?.recordsFailed || 0;
        parIterations = result.parIterations || 0;
        reflexionImprovements.push(...(result.improvements || []));
        status = 'completed';
      } else {
        status = 'failed';
        errors.push({
          code: 'PAR_LOOP_FAILED',
          message: 'PAR loop did not complete successfully',
        });
      }
    } catch (error) {
      status = 'failed';
      errors.push({
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? { stack: error.stack } : undefined,
      });
      this.emit({ type: 'job_failed', error: errors[0] });
    }

    const completedAt = new Date();
    const runResult: JobRunResult = {
      jobId: this.jobId!,
      runId: this.runId!,
      status,
      startedAt,
      completedAt,
      recordsProcessed,
      recordsFailed,
      errors,
      parIterations,
      reflexionImprovements,
      metrics: {
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };

    // Update job and run records
    await this.updateJobStatus(runResult);

    this.emit({ type: 'job_completed', result: runResult });
    return runResult;
  }

  /**
   * PAR Loop - Plan-Act-Reflect with self-correction
   */
  protected async parLoop<T>(
    perceive: () => Promise<PARPerception<T>>,
    act: (perception: PARPerception<T>) => Promise<PARAction>,
    reflect: (action: PARAction, perception: PARPerception<T>) => Promise<PARReflection>,
    maxIterations: number = 3
  ): Promise<{ metrics: PARAction['metrics']; parIterations: number; improvements: string[] } | null> {
    let iteration = 0;
    let adjustment: unknown = undefined;
    const allImprovements: string[] = [];
    let lastAction: PARAction | null = null;

    while (iteration < maxIterations) {
      // PERCEIVE: Gather data and context
      const perception = await perceive();
      perception.iteration = iteration;
      perception.previousAdjustment = adjustment;
      
      this.emit({ type: 'perception_complete', data: perception.data });

      // ACT: Execute the transformation
      const action = await act(perception);
      lastAction = action;
      
      this.emit({ type: 'action_complete', metrics: action.metrics });

      // REFLECT: Evaluate results and determine if retry is needed
      const reflection = await reflect(action, perception);
      allImprovements.push(...reflection.improvements);
      
      this.emit({ type: 'reflection_complete', reflection });

      // Store lessons learned for future runs
      if (reflection.lessonsLearned) {
        await this.storeLessonsLearned(reflection.lessonsLearned);
      }

      if (reflection.success) {
        this.emit({ type: 'iteration_complete', iteration, success: true });
        return {
          metrics: action.metrics,
          parIterations: iteration + 1,
          improvements: allImprovements,
        };
      }

      if (!reflection.retry) {
        this.emit({ type: 'iteration_complete', iteration, success: false });
        break;
      }

      // Apply adjustment for next iteration
      adjustment = reflection.adjustment;
      iteration++;
      
      this.emit({ type: 'iteration_complete', iteration: iteration - 1, success: false });
    }

    // Return last action metrics even if not fully successful
    if (lastAction) {
      return {
        metrics: lastAction.metrics,
        parIterations: iteration,
        improvements: allImprovements,
      };
    }

    return null;
  }

  /**
   * Store lessons learned for future runs (self-learning)
   */
  protected async storeLessonsLearned(lesson: string): Promise<void> {
    try {
      await db.insert(etlKnowledge).values({
        pattern: `${this.jobDefinition.jobType}:${this.jobDefinition.name}`,
        lessonsLearned: lesson,
        successRate: 0.5, // Initial neutral rate
      });
    } catch (error) {
      console.error('Failed to store lessons learned:', error);
    }
  }

  /**
   * Get previous lessons learned for this job type
   */
  protected async getPreviousLessons(): Promise<string[]> {
    try {
      const lessons = await db.select()
        .from(etlKnowledge)
        .where(eq(etlKnowledge.pattern, `${this.jobDefinition.jobType}:${this.jobDefinition.name}`));
      return lessons.map(l => l.lessonsLearned).filter((l): l is string => l !== null);
    } catch {
      return [];
    }
  }

  /**
   * Update job status in database
   */
  protected async updateJobStatus(result: JobRunResult): Promise<void> {
    try {
      // Update job
      await db.update(etlJobs)
        .set({
          status: result.status,
          completedAt: result.completedAt,
          result: result as unknown as Record<string, unknown>,
          errorMessage: result.errors.length > 0 ? result.errors[0].message : null,
        })
        .where(eq(etlJobs.id, result.jobId));

      // Update job run
      await db.update(etlJobRuns)
        .set({
          status: result.status,
          completedAt: result.completedAt,
          recordsProcessed: result.recordsProcessed,
          recordsFailed: result.recordsFailed,
          errors: result.errors as unknown as Record<string, unknown>[],
          parIterations: result.parIterations,
          reflexionImprovements: result.reflexionImprovements,
          metrics: result.metrics as Record<string, unknown>,
        })
        .where(eq(etlJobRuns.id, result.runId));
    } catch (error) {
      console.error('Failed to update job status:', error);
    }
  }

  /**
   * Use LLM to plan extraction strategy
   */
  protected async planExtraction(data: unknown, schema?: string): Promise<string> {
    const prompt = `You are an ETL planning assistant. Analyze the following data and suggest the best extraction strategy.

Data sample:
${JSON.stringify(data, null, 2).slice(0, 2000)}

${schema ? `Target schema:\n${schema}\n` : ''}

Previous lessons learned:
${(await this.getPreviousLessons()).join('\n') || 'None'}

Provide a brief extraction plan with:
1. Key fields to extract
2. Transformations needed
3. Potential issues to watch for`;

    const response = await chat(
      'planner',
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 500 }
    );

    return response.content;
  }

  /**
   * Use LLM to parse complex data structures
   */
  protected async parseWithLLM<T>(
    data: string,
    targetStructure: string
  ): Promise<T | null> {
    const prompt = `Parse the following data into the specified JSON structure.

Data:
${data.slice(0, 3000)}

Target structure:
${targetStructure}

Return ONLY valid JSON matching the target structure. No explanation.`;

    try {
      const response = await chat(
        'planner',
        [{ role: 'user', content: prompt }],
        { temperature: 0.1, maxTokens: 2000 }
      );

      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
    } catch (error) {
      console.error('LLM parsing failed:', error);
    }
    return null;
  }

  /**
   * Use LLM to evaluate extraction quality
   */
  protected async evaluateQuality(
    extracted: unknown,
    expected?: unknown
  ): Promise<{ score: number; issues: string[] }> {
    const prompt = `Evaluate the quality of this extracted data.

Extracted data:
${JSON.stringify(extracted, null, 2).slice(0, 2000)}

${expected ? `Expected format:\n${JSON.stringify(expected, null, 2).slice(0, 1000)}\n` : ''}

Rate the extraction quality from 0.0 to 1.0 and list any issues.
Return JSON: { "score": 0.0-1.0, "issues": ["issue1", "issue2"] }`;

    try {
      const response = await chat(
        'planner',
        [{ role: 'user', content: prompt }],
        { temperature: 0.1, maxTokens: 500 }
      );

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Quality evaluation failed:', error);
    }
    return { score: 0.5, issues: ['Could not evaluate quality'] };
  }

  // Abstract methods to be implemented by specific agents
  abstract perceive(): Promise<PARPerception>;
  abstract act(perception: PARPerception): Promise<PARAction>;
  abstract reflect(action: PARAction, perception: PARPerception): Promise<PARReflection>;
}
