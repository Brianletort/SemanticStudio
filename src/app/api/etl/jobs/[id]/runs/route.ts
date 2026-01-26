import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { etlJobRuns } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/etl/jobs/[id]/runs - Get runs for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const runs = await db.select()
      .from(etlJobRuns)
      .where(eq(etlJobRuns.jobId, id))
      .orderBy(desc(etlJobRuns.createdAt));
    
    return NextResponse.json(runs);
  } catch (error) {
    console.error('Failed to fetch job runs:', error);
    return NextResponse.json({ error: 'Failed to fetch job runs' }, { status: 500 });
  }
}
