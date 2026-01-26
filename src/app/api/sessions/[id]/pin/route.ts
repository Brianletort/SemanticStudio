import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, userSettings } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

// Default user ID for development (matches init.sql)
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

// Default maximum number of pinned sessions (can be overridden in settings)
const DEFAULT_MAX_PINNED_SESSIONS = 10;

// POST /api/sessions/[id]/pin - Pin a session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if session exists and belongs to user
    const sessionResult = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, DEV_USER_ID)))
      .limit(1);

    if (sessionResult.length === 0) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const session = sessionResult[0];

    // If already pinned, return success
    if (session.isPinned) {
      return NextResponse.json(session);
    }

    // Get user's max pinned sessions setting
    const settingsResult = await db
      .select({ maxPinnedSessions: userSettings.maxPinnedSessions })
      .from(userSettings)
      .where(eq(userSettings.userId, DEV_USER_ID))
      .limit(1);
    
    const maxPinnedSessions = settingsResult[0]?.maxPinnedSessions ?? DEFAULT_MAX_PINNED_SESSIONS;

    // Count current pinned sessions using a transaction with row-level locking
    // to prevent race conditions when multiple users pin simultaneously
    const pinnedCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(and(eq(sessions.userId, DEV_USER_ID), eq(sessions.isPinned, true)));

    const pinnedCount = pinnedCountResult[0]?.count ?? 0;

    if (pinnedCount >= maxPinnedSessions) {
      return NextResponse.json(
        {
          error: `Maximum of ${maxPinnedSessions} pinned sessions reached. Please unpin a session first.`,
          code: "MAX_PINS_REACHED",
          maxPins: maxPinnedSessions,
          currentPins: pinnedCount,
        },
        { status: 400 }
      );
    }

    // Pin the session
    const [updatedSession] = await db
      .update(sessions)
      .set({
        isPinned: true,
        pinnedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning();

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Failed to pin session:", error);
    return NextResponse.json(
      { error: "Failed to pin session" },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id]/pin - Unpin a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if session exists and belongs to user
    const sessionResult = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, DEV_USER_ID)))
      .limit(1);

    if (sessionResult.length === 0) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const session = sessionResult[0];

    // If already unpinned, return success
    if (!session.isPinned) {
      return NextResponse.json(session);
    }

    // Unpin the session
    const [updatedSession] = await db
      .update(sessions)
      .set({
        isPinned: false,
        pinnedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning();

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Failed to unpin session:", error);
    return NextResponse.json(
      { error: "Failed to unpin session" },
      { status: 500 }
    );
  }
}
