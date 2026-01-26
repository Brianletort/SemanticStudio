import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatEvaluations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/evaluations/[turnId]
 * 
 * Fetch evaluation for a specific turn
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

    const result = await db
      .select()
      .from(chatEvaluations)
      .where(eq(chatEvaluations.turnId, turnId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Evaluation not found", pending: true },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error fetching evaluation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
