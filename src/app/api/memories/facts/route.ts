/**
 * Memory Facts API
 * 
 * Provides access to auto-extracted memory facts:
 * - Session facts (session_memory_facts table)
 * - User facts (user_memory table)
 * 
 * Used for testing and verification of the memory system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionMemoryFacts, userMemory, sessions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * GET /api/memories/facts
 * 
 * Query params:
 * - type: 'session' | 'user' | 'all' (default: 'all')
 * - sessionId: Required for type='session'
 * - limit: Max results (default: 50)
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || DEV_USER_ID;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  const sessionId = searchParams.get('sessionId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const result: {
    sessionFacts: Array<Record<string, unknown>>;
    userFacts: Array<Record<string, unknown>>;
  } = {
    sessionFacts: [],
    userFacts: [],
  };

  try {
    // Get session facts
    if ((type === 'session' || type === 'all') && sessionId) {
      // Verify session belongs to user
      const session = await db.select()
        .from(sessions)
        .where(and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, userId)
        ))
        .limit(1);

      if (session.length > 0) {
        const facts = await db.select({
          id: sessionMemoryFacts.id,
          sessionId: sessionMemoryFacts.sessionId,
          factType: sessionMemoryFacts.factType,
          key: sessionMemoryFacts.key,
          value: sessionMemoryFacts.value,
          importance: sessionMemoryFacts.importance,
          createdAt: sessionMemoryFacts.createdAt,
        })
          .from(sessionMemoryFacts)
          .where(eq(sessionMemoryFacts.sessionId, sessionId))
          .orderBy(desc(sessionMemoryFacts.importance))
          .limit(limit);

        result.sessionFacts = facts;
      }
    } else if (type === 'session' && !sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required for type=session' },
        { status: 400 }
      );
    }
  } catch (sessionError) {
    console.error('Failed to get session facts:', sessionError);
  }

  try {
    // Get user facts (auto-extracted cross-session)
    if (type === 'user' || type === 'all') {
      const facts = await db.select({
        id: userMemory.id,
        userId: userMemory.userId,
        factType: userMemory.factType,
        key: userMemory.key,
        value: userMemory.value,
        importance: userMemory.importance,
        sourceSessionId: userMemory.sourceSessionId,
        createdAt: userMemory.createdAt,
      })
        .from(userMemory)
        .where(eq(userMemory.userId, userId))
        .orderBy(desc(userMemory.importance))
        .limit(limit);

      result.userFacts = facts;
    }
  } catch (userError) {
    console.error('Failed to get user facts:', userError);
  }

  return NextResponse.json(result);
}

/**
 * GET /api/memories/facts/count
 * 
 * Get counts of facts for verification
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const body = await request.json();
    const { sessionId } = body;

    let sessionFactCount = 0;
    let userFactCount = 0;

    // Count session facts
    if (sessionId) {
      const session = await db.select()
        .from(sessions)
        .where(and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, userId)
        ))
        .limit(1);

      if (session.length > 0) {
        const sessionFacts = await db.select({ id: sessionMemoryFacts.id })
          .from(sessionMemoryFacts)
          .where(eq(sessionMemoryFacts.sessionId, sessionId));
        sessionFactCount = sessionFacts.length;
      }
    }

    // Count user facts
    const userFacts = await db.select({ id: userMemory.id })
      .from(userMemory)
      .where(eq(userMemory.userId, userId));
    userFactCount = userFacts.length;

    return NextResponse.json({
      sessionFactCount,
      userFactCount,
      total: sessionFactCount + userFactCount,
    });
  } catch (error) {
    console.error('Failed to count memory facts:', error);
    return NextResponse.json(
      { error: 'Failed to count memory facts' },
      { status: 500 }
    );
  }
}
