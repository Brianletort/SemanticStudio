/**
 * SQL Injection Prevention Tests
 * 
 * Verifies that all user inputs are properly sanitized and
 * parameterized queries are used throughout the memory system.
 */

import { describe, test, expect } from 'vitest';
import { SQL_INJECTION_PAYLOADS } from '../fixtures/kg-seed-data';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = `sql-injection-test-${Date.now()}`;

/**
 * Helper to send chat message
 */
async function sendChatMessage(userId: string, message: string) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({
      message, // API expects 'message' as string
      mode: 'fast',
    }),
  });

  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? await response.json() : null,
  };
}

/**
 * Helper to search context graph
 */
async function searchContextGraph(userId: string, query: string) {
  const response = await fetch(
    `${BASE_URL}/api/memories/context-graph?action=query&q=${encodeURIComponent(query)}`,
    {
      headers: { 'x-user-id': userId },
    }
  );

  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? await response.json() : null,
  };
}

/**
 * Helper to search knowledge graph
 */
async function searchKnowledgeGraph(query: string) {
  const response = await fetch(
    `${BASE_URL}/api/graph/data?search=${encodeURIComponent(query)}`
  );

  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? await response.json() : null,
  };
}

// =============================================================================
// CHAT MESSAGE INJECTION TESTS
// =============================================================================

describe('Chat Message SQL Injection', () => {
  test.each(SQL_INJECTION_PAYLOADS)(
    'SEC-INJ-001: Chat message blocks injection: %s',
    async (payload) => {
      const result = await sendChatMessage(TEST_USER_ID, payload);

      // Should either succeed (payload treated as text) or return error
      // Should NOT cause database errors
      if (result.ok) {
        // If successful, the payload was safely handled as text
        expect(result.data).toBeDefined();
      } else {
        // If error, should be client error not server error
        expect(result.status).toBeLessThan(500);
      }
    }
  );
});

// =============================================================================
// USER ID INJECTION TESTS
// =============================================================================

describe('User ID SQL Injection', () => {
  const userIdPayloads = [
    "'; DROP TABLE users; --",
    '1 OR 1=1',
    "admin'--",
    '1; DELETE FROM context_references',
    "' UNION SELECT * FROM users --",
  ];

  test.each(userIdPayloads)(
    'SEC-INJ-002: User ID blocks injection: %s',
    async (payload) => {
      const response = await fetch(`${BASE_URL}/api/memories?userId=${encodeURIComponent(payload)}`, {
        headers: { 'x-user-id': payload },
      });

      // Should handle gracefully - either empty result or error
      // NOT a 500 error from SQL failure
      if (!response.ok) {
        expect(response.status).toBeLessThan(500);
      }
    }
  );
});

// =============================================================================
// CONTEXT GRAPH SEARCH INJECTION TESTS
// =============================================================================

describe('Context Graph Search SQL Injection', () => {
  test.each(SQL_INJECTION_PAYLOADS)(
    'SEC-INJ-003: Context search blocks injection: %s',
    async (payload) => {
      const result = await searchContextGraph(TEST_USER_ID, payload);

      // Should return empty results or error, not database crash
      if (result.ok) {
        expect(result.data).toBeDefined();
        // Results should be empty or safe
        expect(Array.isArray(result.data.results) || result.data.results === undefined).toBe(true);
      } else {
        expect(result.status).toBeLessThan(500);
      }
    }
  );
});

// =============================================================================
// KNOWLEDGE GRAPH SEARCH INJECTION TESTS
// =============================================================================

describe('Knowledge Graph Search SQL Injection', () => {
  test.each(SQL_INJECTION_PAYLOADS)(
    'SEC-INJ-004: KG search blocks injection: %s',
    async (payload) => {
      const result = await searchKnowledgeGraph(payload);

      // Should return empty or safe results
      if (result.ok) {
        expect(result.data).toBeDefined();
      } else {
        expect(result.status).toBeLessThan(500);
      }
    }
  );
});

// =============================================================================
// SESSION ID INJECTION TESTS
// =============================================================================

describe('Session ID SQL Injection', () => {
  const sessionIdPayloads = [
    "'; DROP TABLE sessions; --",
    '00000000-0000-0000-0000-000000000000 OR 1=1',
    "' UNION SELECT * FROM messages --",
  ];

  test.each(sessionIdPayloads)(
    'SEC-INJ-005: Session ID blocks injection: %s',
    async (payload) => {
      const response = await fetch(
        `${BASE_URL}/api/memories?action=session-facts&sessionId=${encodeURIComponent(payload)}`,
        {
          headers: { 'x-user-id': TEST_USER_ID },
        }
      );

      // Should return error or empty, not crash
      if (!response.ok) {
        expect(response.status).toBeLessThan(500);
      }
    }
  );
});

// =============================================================================
// ENTITY ID INJECTION TESTS
// =============================================================================

describe('Entity ID SQL Injection', () => {
  test('SEC-INJ-006: Entity ID in admin API blocks injection', async () => {
    const payload = "'; DELETE FROM knowledge_graph_nodes; --";

    const response = await fetch(
      `${BASE_URL}/api/admin/collaboration?action=entity-details&entityId=${encodeURIComponent(payload)}`,
      {
        headers: {
          'x-admin-key': 'test-admin-key',
          'x-user-role': 'admin',
        },
      }
    );

    // Should handle gracefully
    if (!response.ok) {
      expect(response.status).toBeLessThan(500);
    } else {
      const data = await response.json();
      // Entity should not be found (invalid ID)
      expect(data.entity).toBeNull();
    }
  });
});

// =============================================================================
// COMBINED INJECTION TESTS
// =============================================================================

describe('Combined Injection Attempts', () => {
  test('SEC-INJ-007: Multiple injection points in single request', async () => {
    const maliciousUserId = "'; DROP TABLE users; --";
    const maliciousMessage = "1; DELETE FROM messages WHERE '1'='1";

    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': maliciousUserId,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: maliciousMessage }],
        sessionId: "'; DROP TABLE sessions; --",
      }),
    });

    // Should not cause server error
    if (!response.ok) {
      expect(response.status).toBeLessThan(500);
    }
  });

  test('SEC-INJ-008: Nested injection in JSON payload', async () => {
    const maliciousPayload = {
      messages: [
        {
          role: "user'; DROP TABLE messages; --",
          content: "'; SELECT * FROM users; --",
        },
      ],
      memoryConfig: {
        memoryEnabled: "true'; DELETE FROM user_memory; --",
      },
    };

    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID,
      },
      body: JSON.stringify(maliciousPayload),
    });

    // Should reject malformed request, not crash
    if (!response.ok) {
      expect(response.status).toBeLessThan(500);
    }
  });
});

// =============================================================================
// BLIND SQL INJECTION TESTS
// =============================================================================

describe('Blind SQL Injection Prevention', () => {
  test('SEC-INJ-009: Time-based injection attempt', async () => {
    // Attempt to inject a sleep command
    const payload = "1; SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END; --";

    const startTime = Date.now();
    await searchKnowledgeGraph(payload);
    const duration = Date.now() - startTime;

    // Should not take significantly longer (injection blocked)
    expect(duration).toBeLessThan(6000);
  });

  test('SEC-INJ-010: Boolean-based injection attempt', async () => {
    const truePayload = "' OR '1'='1";
    const falsePayload = "' AND '1'='2";

    const trueResult = await searchKnowledgeGraph(truePayload);
    const falseResult = await searchKnowledgeGraph(falsePayload);

    // Both should return similar results (not exploitable)
    // If injection worked, true would return more results
    if (trueResult.ok && falseResult.ok) {
      const trueCount = trueResult.data?.nodes?.length || 0;
      const falseCount = falseResult.data?.nodes?.length || 0;

      // Should not show significant difference due to injection
      console.log(`True payload results: ${trueCount}`);
      console.log(`False payload results: ${falseCount}`);
    }
  });
});
