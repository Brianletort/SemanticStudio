import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, messages, chatEvaluations, users } from "@/lib/db/schema";
import { sql, count, avg, gte } from "drizzle-orm";

// Helper to safely query a table (returns default if table doesn't exist)
async function safeQuery<T>(queryFn: () => Promise<T>, defaultValue: T): Promise<T> {
  try {
    return await queryFn();
  } catch (error: unknown) {
    // Check if error is due to missing table (42P01 = undefined_table)
    // The error code can be on the error itself or nested in cause
    const errorCode = getErrorCode(error);
    if (errorCode === '42P01') {
      console.log('[Observability] Table does not exist, returning default');
      return defaultValue;
    }
    throw error;
  }
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  
  // Check for code directly on the error
  if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  
  // Check for code in cause (common for wrapped database errors)
  if ('cause' in error && error.cause && typeof error.cause === 'object') {
    const cause = error.cause as Record<string, unknown>;
    if ('code' in cause && typeof cause.code === 'string') {
      return cause.code;
    }
  }
  
  return null;
}

export async function GET() {
  try {
    // Get total counts (these tables should always exist)
    const [sessionCount] = await safeQuery(
      () => db.select({ count: count() }).from(sessions),
      [{ count: 0 }]
    );

    const [messageCount] = await safeQuery(
      () => db.select({ count: count() }).from(messages),
      [{ count: 0 }]
    );

    const [userCount] = await safeQuery(
      () => db.select({ count: count() }).from(users),
      [{ count: 0 }]
    );

    // Get today's message count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [todayMessageCount] = await safeQuery(
      () => db.select({ count: count() }).from(messages).where(gte(messages.createdAt, today)),
      [{ count: 0 }]
    );

    // Get active users (sessions updated in last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const [activeUsersCount] = await safeQuery(
      () => db.select({ count: sql<number>`COUNT(DISTINCT ${sessions.userId})` }).from(sessions).where(gte(sessions.updatedAt, fifteenMinutesAgo)),
      [{ count: 0 }]
    );

    // Get quality metrics (table may not exist)
    const [qualityMetrics] = await safeQuery(
      () => db.select({
        avgQuality: avg(chatEvaluations.qualityScore),
        avgRelevance: avg(chatEvaluations.relevanceScore),
        avgGroundedness: avg(chatEvaluations.groundednessScore),
        avgCoherence: avg(chatEvaluations.coherenceScore),
        avgCompleteness: avg(chatEvaluations.completenessScore),
        totalEvaluations: count(),
      }).from(chatEvaluations),
      [{ avgQuality: null, avgRelevance: null, avgGroundedness: null, avgCoherence: null, avgCompleteness: null, totalEvaluations: 0 }]
    );

    // Get hallucination count
    const [hallucinationCount] = await safeQuery(
      () => db.select({ count: count() }).from(chatEvaluations).where(sql`${chatEvaluations.hallucinationDetected} = true`),
      [{ count: 0 }]
    );

    const totalEvaluations = qualityMetrics?.totalEvaluations || 0;
    const hallucinationRate = totalEvaluations > 0 
      ? (hallucinationCount?.count || 0) / totalEvaluations 
      : 0;

    return NextResponse.json({
      totalUsers: userCount?.count || 0,
      totalSessions: sessionCount?.count || 0,
      totalMessages: messageCount?.count || 0,
      todayMessages: todayMessageCount?.count || 0,
      activeUsersNow: activeUsersCount?.count || 0,
      avgQualityScore: qualityMetrics?.avgQuality ? Number(qualityMetrics.avgQuality) : null,
      hallucinationRate: hallucinationRate,
      qualityBreakdown: {
        relevance: qualityMetrics?.avgRelevance ? Number(qualityMetrics.avgRelevance) : null,
        groundedness: qualityMetrics?.avgGroundedness ? Number(qualityMetrics.avgGroundedness) : null,
        coherence: qualityMetrics?.avgCoherence ? Number(qualityMetrics.avgCoherence) : null,
        completeness: qualityMetrics?.avgCompleteness ? Number(qualityMetrics.avgCompleteness) : null,
      },
      totalEvaluations,
    });
  } catch (error) {
    console.error("Failed to fetch observability stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch observability stats" },
      { status: 500 }
    );
  }
}
