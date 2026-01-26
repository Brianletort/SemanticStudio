import { NextRequest, NextResponse } from "next/server";
import { db, sessions } from "@/lib/db";
import { desc, eq, sql } from "drizzle-orm";

// Default user ID for development (matches init.sql)
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

// GET /api/sessions - List all sessions
// Returns sessions ordered: pinned first (by pinned_at desc), then by updated_at desc
export async function GET() {
  try {
    const allSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, DEV_USER_ID))
      .orderBy(
        // Pinned sessions come first
        desc(sessions.isPinned),
        // Within pinned, most recently pinned first
        desc(sessions.pinnedAt),
        // Then by most recently updated
        desc(sessions.updatedAt)
      );

    return NextResponse.json(allSessions);
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title = "New Chat" } = body;

    const [newSession] = await db
      .insert(sessions)
      .values({
        userId: DEV_USER_ID,
        title,
      })
      .returning();

    return NextResponse.json(newSession);
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
