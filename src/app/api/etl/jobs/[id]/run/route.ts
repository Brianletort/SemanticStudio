import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { etlJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ETLOrchestrator } from '@/lib/etl';
// Import agents to register them with the orchestrator
import '@/lib/etl/agents';

// POST /api/etl/jobs/[id]/run - Execute a job using PAR loop agents
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if job exists
    const jobs = await db.select().from(etlJobs).where(eq(etlJobs.id, id));
    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if job is already running
    if (ETLOrchestrator.isJobRunning(id)) {
      return NextResponse.json({ error: 'Job is already running' }, { status: 409 });
    }

    // Execute the job using the orchestrator (this uses the PAR loop agents)
    // Note: This is synchronous for now. In production, use a job queue.
    try {
      const result = await ETLOrchestrator.executeJob(id);
      
      return NextResponse.json({
        message: 'Job completed',
        jobId: id,
        runId: result.runId,
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
        parIterations: result.parIterations,
        reflexionImprovements: result.reflexionImprovements,
        durationMs: result.metrics.durationMs,
      });
    } catch (execError) {
      console.error('Job execution failed:', execError);
      
      // Update job status to failed
      await db.update(etlJobs)
        .set({ 
          status: 'failed', 
          errorMessage: execError instanceof Error ? execError.message : 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(etlJobs.id, id));
      
      return NextResponse.json({ 
        error: 'Job execution failed',
        details: execError instanceof Error ? execError.message : 'Unknown error',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to run ETL job:', error);
    return NextResponse.json({ error: 'Failed to run ETL job' }, { status: 500 });
  }
}
