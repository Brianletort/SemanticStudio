import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userMemories } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// Default user ID for development
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

// GET /api/memories - Get all user memories
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let query = db
      .select()
      .from(userMemories)
      .where(
        activeOnly
          ? and(eq(userMemories.userId, userId), eq(userMemories.isActive, true))
          : eq(userMemories.userId, userId)
      )
      .orderBy(desc(userMemories.createdAt));

    const memories = await query;
    return NextResponse.json(memories);
  } catch (error) {
    console.error('Failed to get memories:', error);
    return NextResponse.json({ error: 'Failed to get memories' }, { status: 500 });
  }
}

// POST /api/memories - Create a new memory
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const body = await request.json();

    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const [memory] = await db
      .insert(userMemories)
      .values({
        userId,
        content: body.content.trim(),
        source: body.source || 'user',
        isActive: body.isActive !== false,
      })
      .returning();

    return NextResponse.json(memory);
  } catch (error) {
    console.error('Failed to create memory:', error);
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 });
  }
}

// PUT /api/memories - Update a memory (by id in body)
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Memory ID is required' }, { status: 400 });
    }

    // Verify memory belongs to user
    const existing = await db
      .select()
      .from(userMemories)
      .where(and(eq(userMemories.id, body.id), eq(userMemories.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    const [updated] = await db
      .update(userMemories)
      .set({
        content: body.content !== undefined ? body.content.trim() : existing[0].content,
        isActive: body.isActive !== undefined ? body.isActive : existing[0].isActive,
        updatedAt: new Date(),
      })
      .where(eq(userMemories.id, body.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update memory:', error);
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 });
  }
}

// DELETE /api/memories - Delete a memory
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get('id');

    if (!memoryId) {
      return NextResponse.json({ error: 'Memory ID is required' }, { status: 400 });
    }

    // Verify memory belongs to user
    const existing = await db
      .select()
      .from(userMemories)
      .where(and(eq(userMemories.id, memoryId), eq(userMemories.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    await db.delete(userMemories).where(eq(userMemories.id, memoryId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete memory:', error);
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
  }
}
