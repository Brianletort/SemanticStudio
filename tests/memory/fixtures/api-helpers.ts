/**
 * API Helpers for Memory System Tests
 * 
 * Handles:
 * - Session creation
 * - SSE stream parsing for chat responses
 * - Proper request formatting
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

export interface ChatResponse {
  content: string;
  sessionId: string;
  events: ChatEvent[];
  error?: string;
}

export interface ChatEvent {
  type: string;
  event?: Record<string, unknown>;
  content?: string;
}

export interface Session {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
}

/**
 * Create a new session
 */
export async function createSession(
  userId: string,
  title: string = 'Test Session'
): Promise<Session | null> {
  try {
    const response = await fetch(`${BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      console.error('Failed to create session:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating session:', error);
    return null;
  }
}

/**
 * Parse Server-Sent Events (SSE) stream
 */
function parseSSEStream(text: string): ChatEvent[] {
  const events: ChatEvent[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.substring(6).trim();
      
      if (data === '[DONE]') {
        events.push({ type: 'done' });
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        events.push(parsed);
      } catch {
        // Skip invalid JSON
      }
    }
  }

  return events;
}

/**
 * Extract content from SSE events
 */
function extractContent(events: ChatEvent[]): string {
  const contentParts: string[] = [];

  for (const event of events) {
    if (event.type === 'content' && event.content) {
      contentParts.push(event.content);
    }
    // Also check for streaming content chunks
    if (event.type === 'text_delta' && (event as Record<string, unknown>).text) {
      contentParts.push((event as Record<string, unknown>).text as string);
    }
  }

  return contentParts.join('');
}

/**
 * Send a chat message and parse the SSE response
 */
export async function sendChatMessage(
  userId: string,
  message: string,
  sessionId?: string,
  mode: string = 'fast'
): Promise<ChatResponse> {
  // If no sessionId provided, create one
  let actualSessionId = sessionId;
  if (!actualSessionId) {
    const session = await createSession(userId);
    if (session) {
      actualSessionId = session.id;
    }
  }

  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({
      message,
      sessionId: actualSessionId,
      mode,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    return {
      content: '',
      sessionId: actualSessionId || '',
      events: [],
      error: text,
    };
  }

  const events = parseSSEStream(text);
  const content = extractContent(events);

  return {
    content,
    sessionId: actualSessionId || '',
    events,
  };
}

/**
 * Get context references for a user
 */
export async function getContextReferences(
  userId: string,
  limit: number = 50
): Promise<Array<Record<string, unknown>>> {
  try {
    const response = await fetch(
      `${BASE_URL}/api/memories/context-graph?action=recent&limit=${limit}`,
      {
        headers: { 'x-user-id': userId },
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.references || [];
  } catch {
    return [];
  }
}

/**
 * Get top entities for a user
 */
export async function getTopEntities(
  userId: string,
  limit: number = 10
): Promise<Array<Record<string, unknown>>> {
  try {
    const response = await fetch(
      `${BASE_URL}/api/memories/context-graph?action=top-entities&limit=${limit}`,
      {
        headers: { 'x-user-id': userId },
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.entities || [];
  } catch {
    return [];
  }
}

/**
 * Get session facts (auto-extracted from session_memory_facts table)
 */
export async function getSessionFacts(
  userId: string,
  sessionId: string
): Promise<Array<Record<string, unknown>>> {
  try {
    const response = await fetch(
      `${BASE_URL}/api/memories/facts?type=session&sessionId=${sessionId}`,
      {
        headers: { 'x-user-id': userId },
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.sessionFacts || [];
  } catch {
    return [];
  }
}

/**
 * Get user facts (auto-extracted from user_memory table)
 */
export async function getUserFacts(
  userId: string
): Promise<Array<Record<string, unknown>>> {
  try {
    const response = await fetch(
      `${BASE_URL}/api/memories/facts?type=user`,
      {
        headers: { 'x-user-id': userId },
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.userFacts || [];
  } catch {
    return [];
  }
}

/**
 * Get saved memories (ChatGPT-style from user_memories table)
 */
export async function getUserMemories(
  userId: string
): Promise<Array<Record<string, unknown>>> {
  try {
    const response = await fetch(
      `${BASE_URL}/api/memories`,
      {
        headers: { 'x-user-id': userId },
      }
    );

    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

/**
 * Get all memory facts (both session and user)
 */
export async function getAllFacts(
  userId: string,
  sessionId?: string
): Promise<{ sessionFacts: Array<Record<string, unknown>>; userFacts: Array<Record<string, unknown>> }> {
  try {
    const url = sessionId 
      ? `${BASE_URL}/api/memories/facts?type=all&sessionId=${sessionId}`
      : `${BASE_URL}/api/memories/facts?type=user`;
    
    const response = await fetch(url, {
      headers: { 'x-user-id': userId },
    });

    if (!response.ok) return { sessionFacts: [], userFacts: [] };
    return await response.json();
  } catch {
    return { sessionFacts: [], userFacts: [] };
  }
}

/**
 * Wait for async processing
 */
export function waitForProcessing(ms: number = 3000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enable memory auto-save for a user (required for fact extraction to persist)
 */
export async function enableMemoryForUser(userId: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({
        memoryEnabled: true,
        autoSaveMemories: true,
        referenceChatHistory: true,
        referenceSavedMemories: true,
        memoryExtractionMode: 'aggressive', // Use aggressive for testing
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a session
 */
export async function deleteSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': userId },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get all sessions for a user
 */
export async function getSessions(
  userId: string
): Promise<Session[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/sessions`, {
      headers: { 'x-user-id': userId },
    });

    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}
