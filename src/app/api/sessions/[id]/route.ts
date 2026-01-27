import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isValidUUID } from '@/lib/utils';

// GET /api/sessions/[id] - Get a single session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format to prevent invalid input errors
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Failed to fetch session:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

// PUT /api/sessions/[id] - Update a session (rename, move to folder, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format to prevent invalid input errors
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    const body = await request.json();
    const { title, metadata, folderId } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) {
      updateData.title = title;
    }
    if (metadata !== undefined) {
      updateData.metadata = metadata;
    }
    // folderId can be null (to remove from folder) or a valid UUID
    if (folderId !== undefined) {
      updateData.folderId = folderId;
    }

    const result = await db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Failed to update session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

// DELETE /api/sessions/[id] - Delete a session and its messages
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format to prevent invalid input errors
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    // Delete messages first (cascade not always reliable)
    await db.delete(messages).where(eq(messages.sessionId, id));
    
    // Then delete the session
    const result = await db.delete(sessions).where(eq(sessions.id, id)).returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to delete session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
