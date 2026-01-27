import { NextRequest, NextResponse } from "next/server";
import { db, sessions, messages } from "@/lib/db";
import { eq, ilike, and, desc, or } from "drizzle-orm";

// Default user ID for development (matches init.sql)
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  matchType: "title" | "message";
  updatedAt: Date | null;
}

/**
 * Extract a snippet around the matched text
 */
function extractSnippet(content: string, query: string, maxLength: number = 100): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);
  
  if (matchIndex === -1) {
    return content.slice(0, maxLength) + (content.length > maxLength ? "..." : "");
  }
  
  // Calculate start and end positions for the snippet
  const snippetStart = Math.max(0, matchIndex - 30);
  const snippetEnd = Math.min(content.length, matchIndex + query.length + 70);
  
  let snippet = content.slice(snippetStart, snippetEnd);
  
  // Add ellipsis if we're not at the boundaries
  if (snippetStart > 0) snippet = "..." + snippet;
  if (snippetEnd < content.length) snippet = snippet + "...";
  
  return snippet;
}

// GET /api/sessions/search?q=query - Search sessions by title and message content
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();
    
    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }
    
    const searchPattern = `%${query}%`;
    const results: SearchResult[] = [];
    const seenSessionIds = new Set<string>();
    
    // Search sessions by title
    const titleMatches = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        updatedAt: sessions.updatedAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, DEV_USER_ID),
          ilike(sessions.title, searchPattern)
        )
      )
      .orderBy(desc(sessions.updatedAt))
      .limit(5);
    
    for (const session of titleMatches) {
      if (!seenSessionIds.has(session.id)) {
        seenSessionIds.add(session.id);
        results.push({
          id: session.id,
          title: session.title || "Untitled",
          matchType: "title",
          updatedAt: session.updatedAt,
        });
      }
    }
    
    // Search messages content and get associated sessions
    const messageMatches = await db
      .select({
        sessionId: messages.sessionId,
        content: messages.content,
        sessionTitle: sessions.title,
        sessionUpdatedAt: sessions.updatedAt,
      })
      .from(messages)
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.userId, DEV_USER_ID),
          ilike(messages.content, searchPattern)
        )
      )
      .orderBy(desc(sessions.updatedAt))
      .limit(15);
    
    for (const match of messageMatches) {
      if (match.sessionId && !seenSessionIds.has(match.sessionId)) {
        seenSessionIds.add(match.sessionId);
        results.push({
          id: match.sessionId,
          title: match.sessionTitle || "Untitled",
          snippet: extractSnippet(match.content, query),
          matchType: "message",
          updatedAt: match.sessionUpdatedAt,
        });
        
        // Limit total results
        if (results.length >= 10) break;
      }
    }
    
    // Sort results by updatedAt (most recent first)
    results.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return NextResponse.json(results.slice(0, 10));
  } catch (error) {
    console.error("Failed to search sessions:", error);
    return NextResponse.json(
      { error: "Failed to search sessions" },
      { status: 500 }
    );
  }
}
