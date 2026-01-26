import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, messages, chatEvaluations, chatAgentEvents } from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Get all sessions for this user
    const userSessions = await safeQuery(
      () => db
        .select({
          id: sessions.id,
          title: sessions.title,
          createdAt: sessions.createdAt,
          updatedAt: sessions.updatedAt,
        })
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(desc(sessions.updatedAt))
        .limit(50),
      []
    );

    // For each session, get messages, evaluations, and metadata
    const sessionsWithDetails = await Promise.all(
      userSessions.map(async (session) => {
        // Get messages for this session
        const sessionMessages = await safeQuery(
          () => db
            .select({
              id: messages.id,
              role: messages.role,
              content: messages.content,
              createdAt: messages.createdAt,
              metadata: messages.metadata,
            })
            .from(messages)
            .where(eq(messages.sessionId, session.id))
            .orderBy(messages.createdAt),
          []
        );

        // Get latest evaluation for this session
        const [evaluation] = await safeQuery(
          () => db
            .select({
              qualityScore: chatEvaluations.qualityScore,
              relevanceScore: chatEvaluations.relevanceScore,
              groundednessScore: chatEvaluations.groundednessScore,
              coherenceScore: chatEvaluations.coherenceScore,
              completenessScore: chatEvaluations.completenessScore,
              hallucinationDetected: chatEvaluations.hallucinationDetected,
              judgeReasoning: chatEvaluations.judgeReasoning,
            })
            .from(chatEvaluations)
            .where(eq(chatEvaluations.sessionId, session.id))
            .orderBy(desc(chatEvaluations.createdAt))
            .limit(1),
          [null]
        );

        // Get mode used for this session
        const [modeEvent] = await safeQuery(
          () => db
            .select({
              mode: sql<string>`${chatAgentEvents.payloadJson}->>'mode'`,
            })
            .from(chatAgentEvents)
            .where(
              and(
                eq(chatAgentEvents.sessionId, session.id),
                eq(chatAgentEvents.eventType, "mode_selected")
              )
            )
            .orderBy(desc(chatAgentEvents.createdAt))
            .limit(1),
          [null]
        );

        // Check if web search was used
        const [webSearchEvent] = await safeQuery(
          () => db
            .select({ count: sql<number>`1` })
            .from(chatAgentEvents)
            .where(
              and(
                eq(chatAgentEvents.sessionId, session.id),
                eq(chatAgentEvents.eventType, "web_search_complete")
              )
            )
            .limit(1),
          [null]
        );

        // Get domain agents used
        const domainAgents = await safeQuery(
          () => db
            .select({
              domain: sql<string>`DISTINCT ${chatAgentEvents.payloadJson}->>'domain'`,
            })
            .from(chatAgentEvents)
            .where(
              and(
                eq(chatAgentEvents.sessionId, session.id),
                eq(chatAgentEvents.eventType, "domain_agent_complete")
              )
            ),
          []
        );

        return {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: sessionMessages.length,
          mode: modeEvent?.mode || null,
          webEnabled: !!webSearchEvent,
          domainAgentsUsed: domainAgents.map((d) => d.domain).filter(Boolean),
          messages: sessionMessages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
            metadata: m.metadata,
          })),
          evaluation: evaluation
            ? {
                qualityScore: evaluation.qualityScore,
                relevanceScore: evaluation.relevanceScore,
                groundednessScore: evaluation.groundednessScore,
                coherenceScore: evaluation.coherenceScore,
                completenessScore: evaluation.completenessScore,
                hallucinationDetected: evaluation.hallucinationDetected,
                judgeReasoning: evaluation.judgeReasoning,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ sessions: sessionsWithDetails });
  } catch (error) {
    console.error("Failed to fetch user sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch user sessions" },
      { status: 500 }
    );
  }
}
