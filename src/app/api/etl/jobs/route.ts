import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { etlJobs } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

// GET /api/etl/jobs - List all ETL jobs
export async function GET() {
  try {
    const jobs = await db.select().from(etlJobs).orderBy(desc(etlJobs.createdAt));
    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Failed to fetch ETL jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch ETL jobs' }, { status: 500 });
  }
}

// POST /api/etl/jobs - Create a new ETL job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobType, config } = body;

    if (!jobType) {
      return NextResponse.json({ error: 'jobType is required' }, { status: 400 });
    }

    const [job] = await db.insert(etlJobs).values({
      jobType,
      config: config || {},
      status: 'pending',
    }).returning();

    return NextResponse.json(job);
  } catch (error) {
    console.error('Failed to create ETL job:', error);
    return NextResponse.json({ error: 'Failed to create ETL job' }, { status: 500 });
  }
}
