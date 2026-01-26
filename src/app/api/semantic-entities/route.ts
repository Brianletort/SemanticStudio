import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { semanticEntities } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

// GET /api/semantic-entities - List all semantic entities
export async function GET() {
  try {
    const entities = await db.select().from(semanticEntities).orderBy(desc(semanticEntities.createdAt));
    return NextResponse.json(entities);
  } catch (error) {
    console.error('Failed to fetch semantic entities:', error);
    return NextResponse.json({ error: 'Failed to fetch semantic entities' }, { status: 500 });
  }
}
