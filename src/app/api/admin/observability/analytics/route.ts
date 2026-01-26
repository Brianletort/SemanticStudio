import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatAgentEvents, chatEvaluations, messages } from "@/lib/db/schema";
import { sql, desc, gte, eq, and, count, avg } from "drizzle-orm";

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
    // Get date range for analytics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Mode Distribution - from mode_selected events
    const modeEvents = await safeQuery(
      () => db
        .select({
          mode: sql<string>`${chatAgentEvents.payloadJson}->>'mode'`,
          count: count(),
        })
        .from(chatAgentEvents)
        .where(
          and(
            eq(chatAgentEvents.eventType, "mode_selected"),
            gte(chatAgentEvents.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(sql`${chatAgentEvents.payloadJson}->>'mode'`),
      []
    );

    const modeDistribution = {
      quick: 0,
      think: 0,
      deep: 0,
      research: 0,
    };
    
    for (const event of modeEvents) {
      if (event.mode && event.mode in modeDistribution) {
        modeDistribution[event.mode as keyof typeof modeDistribution] = event.count;
      }
    }

    // 2. Domain Agent Usage
    const domainAgentEvents = await safeQuery(
      () => db
        .select({
          agentId: chatAgentEvents.agentId,
          domain: sql<string>`${chatAgentEvents.payloadJson}->>'domain'`,
          count: count(),
          avgDuration: avg(sql<number>`(${chatAgentEvents.payloadJson}->>'durationMs')::numeric`),
        })
        .from(chatAgentEvents)
        .where(
          and(
            eq(chatAgentEvents.eventType, "domain_agent_complete"),
            gte(chatAgentEvents.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(chatAgentEvents.agentId, sql`${chatAgentEvents.payloadJson}->>'domain'`)
        .orderBy(desc(count()))
        .limit(15),
      []
    );

    const domainAgentUsage = domainAgentEvents.map((e) => ({
      agentId: e.agentId || "unknown",
      domain: e.domain || "unknown",
      count: e.count,
      avgDurationMs: e.avgDuration ? Number(e.avgDuration) : 0,
    }));

    // 3. Web vs Local Queries
    const webSearchEvents = await safeQuery(
      () => db
        .select({ count: count() })
        .from(chatAgentEvents)
        .where(
          and(
            eq(chatAgentEvents.eventType, "web_search_complete"),
            gte(chatAgentEvents.createdAt, thirtyDaysAgo)
          )
        ),
      [{ count: 0 }]
    );

    const totalQueries = await safeQuery(
      () => db
        .select({ count: count() })
        .from(chatAgentEvents)
        .where(
          and(
            eq(chatAgentEvents.eventType, "pipeline_complete"),
            gte(chatAgentEvents.createdAt, thirtyDaysAgo)
          )
        ),
      [{ count: 0 }]
    );

    const webCount = webSearchEvents[0]?.count || 0;
    const totalCount = totalQueries[0]?.count || 0;
    const localCount = Math.max(0, totalCount - webCount);

    const webVsLocal = {
      webEnabled: webCount,
      localOnly: localCount,
      total: totalCount,
    };

    // 4. Activity Heatmap - messages by hour and day of week
    const activityData = await safeQuery(
      () => db
        .select({
          dayOfWeek: sql<number>`EXTRACT(DOW FROM ${messages.createdAt})::int`,
          hourOfDay: sql<number>`EXTRACT(HOUR FROM ${messages.createdAt})::int`,
          count: count(),
        })
        .from(messages)
        .where(
          and(
            eq(messages.role, "user"),
            gte(messages.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(
          sql`EXTRACT(DOW FROM ${messages.createdAt})`,
          sql`EXTRACT(HOUR FROM ${messages.createdAt})`
        ),
      []
    );

    const activityHeatmap = activityData.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      hourOfDay: d.hourOfDay,
      count: d.count,
    }));

    // 5. Quality Trends - daily averages for last 30 days
    const qualityTrendData = await safeQuery(
      () => db
        .select({
          date: sql<string>`DATE(${chatEvaluations.createdAt})::text`,
          avgQuality: avg(chatEvaluations.qualityScore),
          avgRelevance: avg(chatEvaluations.relevanceScore),
          avgGroundedness: avg(chatEvaluations.groundednessScore),
          avgCoherence: avg(chatEvaluations.coherenceScore),
          avgCompleteness: avg(chatEvaluations.completenessScore),
          hallucinationCount: sql<number>`SUM(CASE WHEN ${chatEvaluations.hallucinationDetected} THEN 1 ELSE 0 END)::int`,
          totalCount: count(),
        })
        .from(chatEvaluations)
        .where(gte(chatEvaluations.createdAt, thirtyDaysAgo))
        .groupBy(sql`DATE(${chatEvaluations.createdAt})`)
        .orderBy(sql`DATE(${chatEvaluations.createdAt})`),
      []
    );

    const qualityTrend = qualityTrendData.map((d) => ({
      date: d.date,
      avgQuality: d.avgQuality ? Number(d.avgQuality) : null,
      avgRelevance: d.avgRelevance ? Number(d.avgRelevance) : null,
      avgGroundedness: d.avgGroundedness ? Number(d.avgGroundedness) : null,
      avgCoherence: d.avgCoherence ? Number(d.avgCoherence) : null,
      avgCompleteness: d.avgCompleteness ? Number(d.avgCompleteness) : null,
      hallucinationCount: d.hallucinationCount || 0,
      totalCount: d.totalCount,
    }));

    // 6. Recent questions (sample for topics visualization)
    const recentQuestions = await safeQuery(
      () => db
        .select({
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(
          and(
            eq(messages.role, "user"),
            gte(messages.createdAt, thirtyDaysAgo)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(100),
      []
    );

    // Extract simple topic keywords (basic extraction - could be enhanced with LLM)
    const topicCounts: Record<string, number> = {};
    const topicExamples: Record<string, string[]> = {};
    
    for (const q of recentQuestions) {
      // Simple keyword extraction (words > 4 chars, not common words)
      const words = q.content
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .filter((w) => !["about", "would", "could", "should", "there", "their", "where", "which", "these", "those", "being", "having", "doing"].includes(w));
      
      for (const word of words.slice(0, 5)) {
        topicCounts[word] = (topicCounts[word] || 0) + 1;
        if (!topicExamples[word]) {
          topicExamples[word] = [];
        }
        if (topicExamples[word].length < 3) {
          topicExamples[word].push(q.content.slice(0, 100));
        }
      }
    }

    // Get top 20 topics
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([topic, count]) => ({
        topic,
        count,
        recentExamples: topicExamples[topic] || [],
      }));

    // 7. Response time distribution from pipeline_complete events
    const responseTimeData = await safeQuery(
      () => db
        .select({
          durationMs: sql<number>`(${chatAgentEvents.payloadJson}->>'durationMs')::numeric`,
        })
        .from(chatAgentEvents)
        .where(
          and(
            eq(chatAgentEvents.eventType, "pipeline_complete"),
            gte(chatAgentEvents.createdAt, thirtyDaysAgo)
          )
        ),
      []
    );

    // Bucket the response times
    const buckets: Record<string, number> = {
      "0-1s": 0,
      "1-3s": 0,
      "3-5s": 0,
      "5-10s": 0,
      "10-30s": 0,
      "30s+": 0,
    };

    for (const r of responseTimeData) {
      const ms = r.durationMs || 0;
      if (ms < 1000) buckets["0-1s"]++;
      else if (ms < 3000) buckets["1-3s"]++;
      else if (ms < 5000) buckets["3-5s"]++;
      else if (ms < 10000) buckets["5-10s"]++;
      else if (ms < 30000) buckets["10-30s"]++;
      else buckets["30s+"]++;
    }

    const responseTimeDistribution = Object.entries(buckets).map(([bucket, count]) => ({
      bucket,
      count,
    }));

    // 8. Messages per day trend
    const messagesPerDay = await safeQuery(
      () => db
        .select({
          date: sql<string>`DATE(${messages.createdAt})::text`,
          userMessages: sql<number>`SUM(CASE WHEN ${messages.role} = 'user' THEN 1 ELSE 0 END)::int`,
          assistantMessages: sql<number>`SUM(CASE WHEN ${messages.role} = 'assistant' THEN 1 ELSE 0 END)::int`,
        })
        .from(messages)
        .where(gte(messages.createdAt, thirtyDaysAgo))
        .groupBy(sql`DATE(${messages.createdAt})`)
        .orderBy(sql`DATE(${messages.createdAt})`),
      []
    );

    return NextResponse.json({
      modeDistribution,
      domainAgentUsage,
      webVsLocal,
      activityHeatmap,
      qualityTrend,
      topTopics,
      responseTimeDistribution,
      messagesPerDay,
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
