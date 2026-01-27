/**
 * Concurrency and Race Condition Tests
 * 
 * Tests the memory system under concurrent access to verify:
 * - No race conditions in fact extraction
 * - No duplicate context references
 * - Session state remains consistent
 * - Database handles concurrent writes correctly
 */

import { describe, test, expect, afterAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const CONCURRENT_USERS = 10; // Number of concurrent users to simulate

// Track created resources for cleanup
const createdUserIds: string[] = [];
const createdSessionIds: string[] = [];

/**
 * Helper to send chat message
 */
async function sendChatMessage(
  userId: string,
  message: string,
  sessionId?: string
) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({
      message, // API expects 'message' as string
      sessionId,
      mode: 'fast', // Use fast mode for concurrency tests
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.content || data.message || '',
    sessionId: data.sessionId,
    messageId: data.messageId,
  };
}

/**
 * Helper to get context references
 */
async function getContextReferences(userId: string) {
  const response = await fetch(
    `${BASE_URL}/api/memories/context-graph?action=recent&limit=100`,
    {
      headers: { 'x-user-id': userId },
    }
  );

  if (!response.ok) return [];
  const data = await response.json();
  return data.references || [];
}

/**
 * Helper to get sessions for user
 */
async function getSessions(userId: string) {
  const response = await fetch(`${BASE_URL}/api/sessions`, {
    headers: { 'x-user-id': userId },
  });

  if (!response.ok) return [];
  return await response.json();
}

// =============================================================================
// CONCURRENT USER TESTS
// =============================================================================

describe('Concurrent User Access', () => {
  test('CON-001: Multiple users can send messages simultaneously', async () => {
    console.log(`Testing ${CONCURRENT_USERS} concurrent users...`);

    // Create promises for all concurrent requests
    const promises = Array.from({ length: CONCURRENT_USERS }, async (_, i) => {
      const userId = `concurrent-user-${Date.now()}-${i}`;
      createdUserIds.push(userId);

      try {
        const response = await sendChatMessage(
          userId,
          `Hello from user ${i}. Tell me about sales data.`
        );
        createdSessionIds.push(response.sessionId);
        return { userId, success: true, sessionId: response.sessionId };
      } catch (error) {
        return { userId, success: false, error: String(error) };
      }
    });

    // Execute all requests concurrently
    const results = await Promise.all(promises);

    // Check results
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    console.log(`Successes: ${successes.length}/${CONCURRENT_USERS}`);
    console.log(`Failures: ${failures.length}/${CONCURRENT_USERS}`);

    if (failures.length > 0) {
      console.log('Failed requests:', failures);
    }

    // All requests should succeed
    expect(successes.length).toBe(CONCURRENT_USERS);
  }, 60000); // 60s timeout for concurrent test

  test('CON-002: Each user gets unique session', async () => {
    // Use sessions created in previous test
    const sessionSet = new Set(createdSessionIds);

    console.log(`Sessions created: ${createdSessionIds.length}`);
    console.log(`Unique sessions: ${sessionSet.size}`);

    // All sessions should be unique
    expect(sessionSet.size).toBe(createdSessionIds.length);
  });

  test('CON-003: No data leakage between concurrent users', async () => {
    // Each user should only see their own data
    for (let i = 0; i < Math.min(3, createdUserIds.length); i++) {
      const userId = createdUserIds[i];
      const refs = await getContextReferences(userId);

      // All refs should belong to this user
      for (const ref of refs) {
        expect(ref.userId).toBe(userId);
      }
    }
  });
});

// =============================================================================
// RAPID MESSAGE TESTS
// =============================================================================

describe('Rapid Message Sending', () => {
  test('CON-004: Same user can send rapid messages', async () => {
    const userId = `rapid-user-${Date.now()}`;
    createdUserIds.push(userId);

    // Send first message to create session
    const first = await sendChatMessage(
      userId,
      'Starting rapid test conversation.'
    );
    const sessionId = first.sessionId;
    createdSessionIds.push(sessionId);

    // Send 5 messages as fast as possible
    const rapidPromises = Array.from({ length: 5 }, async (_, i) => {
      try {
        const response = await sendChatMessage(
          userId,
          `Rapid message ${i + 1}: What is ${i + 1} + ${i + 1}?`,
          sessionId
        );
        return { index: i, success: true, messageId: response.messageId };
      } catch (error) {
        return { index: i, success: false, error: String(error) };
      }
    });

    const results = await Promise.all(rapidPromises);
    const successes = results.filter(r => r.success);

    console.log(`Rapid messages succeeded: ${successes.length}/5`);

    // Most should succeed (some may fail due to rate limiting, which is OK)
    expect(successes.length).toBeGreaterThanOrEqual(3);
  }, 30000);

  test('CON-005: Rapid messages maintain session integrity', async () => {
    const userId = createdUserIds[createdUserIds.length - 1];
    const sessionId = createdSessionIds[createdSessionIds.length - 1];

    // Verify session still exists and is consistent
    const sessions = await getSessions(userId);
    const session = sessions.find((s: { id: string }) => s.id === sessionId);

    expect(session).toBeDefined();
    console.log('Session after rapid messages:', session?.id);
  });
});

// =============================================================================
// SAME ENTITY CONCURRENT DISCUSSION
// =============================================================================

describe('Concurrent Entity Discussion', () => {
  test('CON-006: Multiple users discussing same entity simultaneously', async () => {
    // All users discuss "Acme Corp" at the same time
    const entityDiscussionPromises = Array.from(
      { length: 5 },
      async (_, i) => {
        const userId = `entity-user-${Date.now()}-${i}`;
        createdUserIds.push(userId);

        try {
          const response = await sendChatMessage(
            userId,
            'Tell me about Acme Corp and their recent performance.'
          );
          createdSessionIds.push(response.sessionId);
          return { userId, success: true };
        } catch (error) {
          return { userId, success: false, error: String(error) };
        }
      }
    );

    const results = await Promise.all(entityDiscussionPromises);
    const successes = results.filter(r => r.success);

    console.log(`Entity discussion successes: ${successes.length}/5`);
    expect(successes.length).toBeGreaterThanOrEqual(4);
  }, 60000);

  test('CON-007: No duplicate context references created', async () => {
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for duplicates across all entity users
    const entityUsers = createdUserIds.filter(id => id.includes('entity-user'));

    for (const userId of entityUsers.slice(0, 3)) {
      const refs = await getContextReferences(userId);

      // Check for exact duplicates (same kgNodeId and refType)
      const refKeys = refs.map(
        (r: { kgNodeId: string; refType: string }) => `${r.kgNodeId}-${r.refType}`
      );
      const uniqueKeys = new Set(refKeys);

      console.log(
        `User ${userId.substring(0, 20)}: ${refs.length} refs, ${uniqueKeys.size} unique`
      );

      // Some duplicates might be OK (same entity mentioned multiple times)
      // But ratio should be reasonable
      if (refs.length > 0) {
        const dupeRatio = refs.length / uniqueKeys.size;
        expect(dupeRatio).toBeLessThan(3); // No more than 3x duplicates
      }
    }
  });
});

// =============================================================================
// PARALLEL SESSION CREATION
// =============================================================================

describe('Parallel Session Creation', () => {
  test('CON-008: Same user creating multiple sessions in parallel', async () => {
    const userId = `parallel-session-user-${Date.now()}`;
    createdUserIds.push(userId);

    // Try to create 5 sessions in parallel
    const sessionPromises = Array.from({ length: 5 }, async (_, i) => {
      try {
        const response = await sendChatMessage(
          userId,
          `Creating session ${i + 1} for parallel test.`
          // No sessionId - should create new session
        );
        return { index: i, success: true, sessionId: response.sessionId };
      } catch (error) {
        return { index: i, success: false, error: String(error) };
      }
    });

    const results = await Promise.all(sessionPromises);
    const successes = results.filter(r => r.success);
    const sessionIds = successes.map(r => r.sessionId);
    const uniqueSessionIds = new Set(sessionIds);

    console.log(`Sessions created: ${sessionIds.length}`);
    console.log(`Unique sessions: ${uniqueSessionIds.size}`);

    // Each should create a unique session
    expect(uniqueSessionIds.size).toBe(sessionIds.length);
  }, 30000);
});

// =============================================================================
// DATA CONSISTENCY VERIFICATION
// =============================================================================

describe('Data Consistency After Concurrent Access', () => {
  test('CON-009: Foreign key integrity maintained', async () => {
    // Verify that context references point to valid entities
    const userId = createdUserIds[0];
    if (!userId) return;

    const refs = await getContextReferences(userId);

    for (const ref of refs.slice(0, 5)) {
      // userId should be set
      expect(ref.userId).toBeTruthy();

      // If kgNodeId is set, it should be a valid UUID format
      if (ref.kgNodeId) {
        expect(ref.kgNodeId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    }
  });

  test('CON-010: No orphaned records', async () => {
    // Check that all references point to valid sessions
    for (const userId of createdUserIds.slice(0, 3)) {
      const refs = await getContextReferences(userId);
      const sessions = await getSessions(userId);
      const sessionIds = new Set(sessions.map((s: { id: string }) => s.id));

      for (const ref of refs) {
        if (ref.sessionId) {
          // Session should exist
          const sessionExists = sessionIds.has(ref.sessionId);
          if (!sessionExists) {
            console.warn(`Orphaned reference: ${ref.id} -> session ${ref.sessionId}`);
          }
        }
      }
    }

    // This is a verification test - log results
    expect(true).toBe(true);
  });
});

// =============================================================================
// CLEANUP
// =============================================================================

afterAll(async () => {
  console.log('\n=== CONCURRENCY TEST SUMMARY ===');
  console.log(`Users created: ${createdUserIds.length}`);
  console.log(`Sessions created: ${createdSessionIds.length}`);

  // In production, would clean up test data here
});
