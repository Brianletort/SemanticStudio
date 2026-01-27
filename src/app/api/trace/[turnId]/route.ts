import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatAgentEvents } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/trace/[turnId]
 * 
 * Fetch all agent events for a specific turn (response)
 * Returns events ordered by their sequence index
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ turnId: string }> }
) {
  try {
    const { turnId } = await params;

    if (!turnId) {
      return NextResponse.json(
        { error: "turnId is required" },
        { status: 400 }
      );
    }

    const events = await db
      .select()
      .from(chatAgentEvents)
      .where(eq(chatAgentEvents.turnId, turnId))
      .orderBy(asc(chatAgentEvents.idx));

    if (events.length === 0) {
      return NextResponse.json(
        { error: "No events found for this turn", events: [] },
        { status: 404 }
      );
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching trace events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
