import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, sessions, messages, chatEvaluations, chatAgentEvents } from "@/lib/db/schema";
import { sql, desc, eq, count, avg, max } from "drizzle-orm";

// Helper to safely query a table (returns default if table doesn't exist)
async function safeQuery<T>(queryFn: () => Promise<T>, defaultValue: T): Promise<T> {
  try {
    return await queryFn();
  } catch (error: unknown) {
    // Check if error is due to missing table (42P01 = undefined_table)
    const errorCode = getErrorCode(error);
    if (errorCode === '42P01') {
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
    // Get users with their activity stats
    const userStats = await safeQuery(
      () => db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
        })
        .from(users),
      []
    );

    // For each user, get their session and message counts
    const usersWithStats = await Promise.all(
      userStats.map(async (user) => {
        // Session count
        const [sessionStats] = await safeQuery(
          () => db
            .select({
              sessionCount: count(),
              lastActive: max(sessions.updatedAt),
            })
            .from(sessions)
            .where(eq(sessions.userId, user.id)),
          [{ sessionCount: 0, lastActive: null }]
        );

        // Message count (user messages only)
        const [messageStats] = await safeQuery(
          () => db
            .select({ count: count() })
            .from(messages)
            .innerJoin(sessions, eq(messages.sessionId, sessions.id))
            .where(sql`${sessions.userId} = ${user.id} AND ${messages.role} = 'user'`),
          [{ count: 0 }]
        );

        // Average quality score for user's sessions
        const [qualityStats] = await safeQuery(
          () => db
            .select({ avgQuality: avg(chatEvaluations.qualityScore) })
            .from(chatEvaluations)
            .innerJoin(sessions, eq(chatEvaluations.sessionId, sessions.id))
            .where(eq(sessions.userId, user.id)),
          [{ avgQuality: null }]
        );

        // Get favorite mode for user
        const modeStats = await safeQuery(
          () => db
            .select({
              mode: sql<string>`${chatAgentEvents.payloadJson}->>'mode'`,
              count: count(),
            })
            .from(chatAgentEvents)
            .innerJoin(sessions, eq(chatAgentEvents.sessionId, sessions.id))
            .where(
              sql`${sessions.userId} = ${user.id} AND ${chatAgentEvents.eventType} = 'mode_selected'`
            )
            .groupBy(sql`${chatAgentEvents.payloadJson}->>'mode'`)
            .orderBy(desc(count()))
            .limit(1),
          []
        );

        // Get top domain agents for user
        const domainStats = await safeQuery(
          () => db
            .select({
              domain: sql<string>`${chatAgentEvents.payloadJson}->>'domain'`,
              count: count(),
            })
            .from(chatAgentEvents)
            .innerJoin(sessions, eq(chatAgentEvents.sessionId, sessions.id))
            .where(
              sql`${sessions.userId} = ${user.id} AND ${chatAgentEvents.eventType} = 'domain_agent_complete'`
            )
            .groupBy(sql`${chatAgentEvents.payloadJson}->>'domain'`)
            .orderBy(desc(count()))
            .limit(3),
          []
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          sessionCount: sessionStats?.sessionCount || 0,
          messageCount: messageStats?.count || 0,
          lastActive: sessionStats?.lastActive,
          avgQualityScore: qualityStats?.avgQuality ? Number(qualityStats.avgQuality) : null,
          favoriteMode: modeStats[0]?.mode || null,
          topDomainAgents: domainStats.map((d) => d.domain).filter(Boolean),
        };
      })
    );

    // Sort by last active descending
    usersWithStats.sort((a, b) => {
      if (!a.lastActive) return 1;
      if (!b.lastActive) return -1;
      return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
    });

    return NextResponse.json({ users: usersWithStats });
  } catch (error) {
    console.error("Failed to fetch user stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch user statistics" },
      { status: 500 }
    );
  }
}
