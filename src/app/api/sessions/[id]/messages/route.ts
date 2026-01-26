import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { messages, sessions } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

// GET /api/sessions/[id]/messages - Get all messages for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First check if session exists
    const sessionCheck = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    
    if (sessionCheck.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get all messages for this session, ordered by creation time
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(asc(messages.createdAt));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST /api/sessions/[id]/messages - Add a message to a session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { role, content, metadata } = body;

    if (!role || !content) {
      return NextResponse.json(
        { error: 'role and content are required' },
        { status: 400 }
      );
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return NextResponse.json(
        { error: 'role must be one of: user, assistant, system' },
        { status: 400 }
      );
    }

    // Insert the message
    const [message] = await db.insert(messages).values({
      sessionId: id,
      role,
      content,
      metadata: metadata || {},
    }).returning();

    // Update session's updatedAt
    await db.update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, id));

    return NextResponse.json(message);
  } catch (error) {
    console.error('Failed to add message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}
