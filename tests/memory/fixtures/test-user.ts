/**
 * Test User Management
 * 
 * Creates and manages test users for memory system testing.
 * Handles user creation, authentication simulation, and cleanup.
 */

import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface TestSession {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
}

/**
 * Generate a unique test user
 */
export function createTestUser(prefix: string = 'test'): TestUser {
  const timestamp = Date.now();
  return {
    id: uuidv4(),
    name: `${prefix}_user_${timestamp}`,
    email: `${prefix}_${timestamp}@test.local`,
    createdAt: new Date(),
  };
}

/**
 * Create test user via API
 */
export async function createTestUserViaApi(baseUrl: string): Promise<TestUser> {
  const user = createTestUser();
  
  // For now, we'll use the user directly since auth is not fully integrated
  // In production, this would call the user creation API
  console.log(`Created test user: ${user.name} (${user.id})`);
  
  return user;
}

/**
 * Cleanup test user and all associated data
 */
export async function cleanupTestUser(baseUrl: string, userId: string): Promise<void> {
  try {
    // Delete all sessions for user
    await fetch(`${baseUrl}/api/sessions?userId=${userId}`, {
      method: 'DELETE',
    });
    
    // Delete all memories for user
    await fetch(`${baseUrl}/api/memories?userId=${userId}`, {
      method: 'DELETE',
    });
    
    // Delete context graph references
    await fetch(`${baseUrl}/api/memories/context-graph?userId=${userId}`, {
      method: 'DELETE',
    });
    
    console.log(`Cleaned up test user: ${userId}`);
  } catch (error) {
    console.error(`Error cleaning up user ${userId}:`, error);
  }
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(baseUrl: string, userId: string): Promise<TestSession[]> {
  try {
    const response = await fetch(`${baseUrl}/api/sessions?userId=${userId}`);
    if (!response.ok) {
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

/**
 * Create a test session
 */
export async function createTestSession(
  baseUrl: string, 
  userId: string, 
  title: string = 'Test Session'
): Promise<TestSession | null> {
  try {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title }),
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating session:', error);
    return null;
  }
}

/**
 * Delete a specific session
 */
export async function deleteSession(baseUrl: string, sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
}

/**
 * Test user context for Playwright
 */
export class TestUserContext {
  user: TestUser;
  sessions: TestSession[] = [];
  baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.user = createTestUser();
  }
  
  async setup(): Promise<void> {
    this.user = await createTestUserViaApi(this.baseUrl);
  }
  
  async cleanup(): Promise<void> {
    await cleanupTestUser(this.baseUrl, this.user.id);
    this.sessions = [];
  }
  
  async createSession(title?: string): Promise<TestSession | null> {
    const session = await createTestSession(this.baseUrl, this.user.id, title);
    if (session) {
      this.sessions.push(session);
    }
    return session;
  }
  
  async deleteAllSessions(): Promise<void> {
    for (const session of this.sessions) {
      await deleteSession(this.baseUrl, session.id);
    }
    this.sessions = [];
  }
}
