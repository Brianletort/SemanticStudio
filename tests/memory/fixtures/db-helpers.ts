/**
 * Database Verification Helpers
 * 
 * Direct database queries to verify memory system state.
 * These bypass the API for accurate testing verification.
 */

export interface SessionFact {
  id: string;
  sessionId: string;
  factKey: string;
  factValue: string;
  importance: number;
  createdAt: string;
}

export interface UserMemory {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: string;
  source: string;
  importance: number;
}

export interface ContextReference {
  id: string;
  userId: string;
  sessionId: string | null;
  kgNodeId: string;
  memoryFactId: string | null;
  refType: string;
  context: string | null;
  createdAt: string;
}

export interface MessageStats {
  total: number;
  full: number;
  compressed: number;
  archived: number;
  totalTokens: number;
}

/**
 * Get session facts via API
 */
export async function getSessionFacts(
  baseUrl: string,
  sessionId: string
): Promise<SessionFact[]> {
  try {
    const response = await fetch(
      `${baseUrl}/api/memories?action=session-facts&sessionId=${sessionId}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.facts || [];
  } catch (error) {
    console.error('Error fetching session facts:', error);
    return [];
  }
}

/**
 * Get user memories via API
 */
export async function getUserMemories(
  baseUrl: string,
  userId: string
): Promise<UserMemory[]> {
  try {
    const response = await fetch(
      `${baseUrl}/api/memories?userId=${userId}`
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching user memories:', error);
    return [];
  }
}

/**
 * Get context graph references via API
 */
export async function getContextReferences(
  baseUrl: string,
  userId: string
): Promise<ContextReference[]> {
  try {
    const response = await fetch(
      `${baseUrl}/api/memories/context-graph?userId=${userId}&action=recent&limit=100`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.references || [];
  } catch (error) {
    console.error('Error fetching context references:', error);
    return [];
  }
}

/**
 * Get top entities for user
 */
export async function getTopEntities(
  baseUrl: string,
  userId: string,
  limit: number = 10
): Promise<Array<{ entityId: string; entityName: string; mentionCount: number }>> {
  try {
    const response = await fetch(
      `${baseUrl}/api/memories/context-graph?userId=${userId}&action=top-entities&limit=${limit}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.entities || [];
  } catch (error) {
    console.error('Error fetching top entities:', error);
    return [];
  }
}

/**
 * Search context graph for entity discussions
 */
export async function searchEntityDiscussions(
  baseUrl: string,
  userId: string,
  query: string
): Promise<Array<{ sessionId: string; sessionTitle: string; context: string }>> {
  try {
    const response = await fetch(
      `${baseUrl}/api/memories/context-graph?userId=${userId}&action=query&q=${encodeURIComponent(query)}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error searching context graph:', error);
    return [];
  }
}

/**
 * Get message compression statistics
 * Note: This requires direct DB access or a new API endpoint
 */
export async function getMessageCompressionStats(
  baseUrl: string,
  sessionId: string
): Promise<MessageStats> {
  // This would query the messages table to get compression levels
  // For now, return placeholder - needs API endpoint
  return {
    total: 0,
    full: 0,
    compressed: 0,
    archived: 0,
    totalTokens: 0,
  };
}

/**
 * Verify a specific fact exists
 */
export async function verifyFactExists(
  baseUrl: string,
  sessionId: string,
  factKey: string,
  expectedValue?: string
): Promise<boolean> {
  const facts = await getSessionFacts(baseUrl, sessionId);
  const fact = facts.find(f => f.factKey === factKey);
  
  if (!fact) return false;
  if (expectedValue && fact.factValue !== expectedValue) return false;
  
  return true;
}

/**
 * Verify memory exists for user
 */
export async function verifyMemoryExists(
  baseUrl: string,
  userId: string,
  key: string,
  expectedValue?: string
): Promise<boolean> {
  const memories = await getUserMemories(baseUrl, userId);
  const memory = memories.find(m => m.key === key);
  
  if (!memory) return false;
  if (expectedValue && memory.value !== expectedValue) return false;
  
  return true;
}

/**
 * Count context references for user
 */
export async function countContextReferences(
  baseUrl: string,
  userId: string
): Promise<number> {
  const refs = await getContextReferences(baseUrl, userId);
  return refs.length;
}

/**
 * Wait for fact extraction (polling)
 */
export async function waitForFactExtraction(
  baseUrl: string,
  sessionId: string,
  expectedKey: string,
  timeout: number = 10000,
  pollInterval: number = 1000
): Promise<SessionFact | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const facts = await getSessionFacts(baseUrl, sessionId);
    const found = facts.find(f => f.factKey === expectedKey);
    if (found) return found;
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return null;
}

/**
 * Wait for context reference creation
 */
export async function waitForContextReference(
  baseUrl: string,
  userId: string,
  entityName: string,
  timeout: number = 10000,
  pollInterval: number = 1000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const entities = await getTopEntities(baseUrl, userId);
    const found = entities.find(e => 
      e.entityName.toLowerCase().includes(entityName.toLowerCase())
    );
    if (found) return true;
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return false;
}
