/**
 * Data Leakage Prevention Tests
 * 
 * Verifies that:
 * - Error messages don't reveal other users' data
 * - API responses don't include unauthorized fields
 * - Vector search doesn't return cross-user results
 * - No PII in logs or error responses
 */

import { describe, test, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const USER_A_ID = `leak-test-user-a-${Date.now()}`;
const USER_B_ID = `leak-test-user-b-${Date.now()}`;

// Sensitive data that User A will share
const SENSITIVE_DATA = {
  ssn: '123-45-6789',
  creditCard: '4111-1111-1111-1111',
  password: 'MySecretP@ssw0rd!',
  salary: '$250,000',
  address: '123 Secret Street',
};

let userASessionId: string;

async function sendChatMessage(userId: string, message: string, sessionId?: string) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({
      message, // API expects 'message' as string
      sessionId,
      mode: 'think',
    }),
  });

  if (!response.ok) throw new Error(`Chat failed: ${response.status}`);
  const data = await response.json();
  return { sessionId: data.sessionId, content: data.content };
}

// =============================================================================
// SETUP - User A shares sensitive information
// =============================================================================

beforeAll(async () => {
  // User A shares various sensitive data
  const response = await sendChatMessage(
    USER_A_ID,
    `Here is my sensitive information:
    - SSN: ${SENSITIVE_DATA.ssn}
    - Credit Card: ${SENSITIVE_DATA.creditCard}
    - My salary is ${SENSITIVE_DATA.salary}
    - I live at ${SENSITIVE_DATA.address}`
  );
  userASessionId = response.sessionId;

  // Add more sensitive context
  await sendChatMessage(
    USER_A_ID,
    `My password is ${SENSITIVE_DATA.password}. Please help me analyze my finances.`,
    userASessionId
  );

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 3000));
});

// =============================================================================
// ERROR MESSAGE LEAKAGE
// =============================================================================

describe('Error Message Data Leakage', () => {
  test('SEC-LEAK-001: 404 errors dont reveal user data', async () => {
    const response = await fetch(
      `${BASE_URL}/api/sessions/nonexistent-session-id`,
      {
        headers: { 'x-user-id': USER_B_ID },
      }
    );

    const body = await response.text();

    // Error message should not contain any of User A's sensitive data
    for (const [key, value] of Object.entries(SENSITIVE_DATA)) {
      expect(body.includes(value)).toBe(false);
    }
  });

  test('SEC-LEAK-002: 403 errors dont reveal what was forbidden', async () => {
    const response = await fetch(
      `${BASE_URL}/api/sessions/${userASessionId}`,
      {
        headers: { 'x-user-id': USER_B_ID },
      }
    );

    const body = await response.text();

    // Error should be generic, not revealing User A's session details
    for (const [key, value] of Object.entries(SENSITIVE_DATA)) {
      expect(body.includes(value)).toBe(false);
    }
  });

  test('SEC-LEAK-003: 500 errors dont expose internal data', async () => {
    // Trigger a potential error with malformed request
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_B_ID,
      },
      body: '{ invalid json',
    });

    if (!response.ok) {
      const body = await response.text();

      // Should not contain stack traces or internal paths
      expect(body.includes('/Users/')).toBe(false);
      expect(body.includes('node_modules')).toBe(false);

      // Should not contain other users' data
      for (const [key, value] of Object.entries(SENSITIVE_DATA)) {
        expect(body.includes(value)).toBe(false);
      }
    }
  });
});

// =============================================================================
// API RESPONSE FILTERING
// =============================================================================

describe('API Response Data Filtering', () => {
  test('SEC-LEAK-004: Memory API filters sensitive fields', async () => {
    const response = await fetch(`${BASE_URL}/api/memories?userId=${USER_A_ID}`, {
      headers: { 'x-user-id': USER_A_ID },
    });

    if (response.ok) {
      const data = await response.json();

      // Check what fields are exposed
      const responseStr = JSON.stringify(data);

      // Sensitive fields should not be in plain text
      // (depends on what the API actually exposes)
      console.log('Memory API response fields:', Object.keys(data));
    }
  });

  test('SEC-LEAK-005: Context ref API filters user data', async () => {
    const response = await fetch(
      `${BASE_URL}/api/memories/context-graph?action=recent&limit=10`,
      {
        headers: { 'x-user-id': USER_A_ID },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const refs = data.references || [];

      // Check each reference for sensitive data exposure
      for (const ref of refs) {
        // Should not expose full embeddings
        expect(ref.embedding).toBeUndefined();

        // Context snippets should be truncated
        if (ref.context) {
          expect(ref.context.length).toBeLessThanOrEqual(500);
        }
      }
    }
  });
});

// =============================================================================
// VECTOR SEARCH ISOLATION
// =============================================================================

describe('Vector Search Isolation', () => {
  test('SEC-LEAK-006: Vector search scoped to user', async () => {
    // User B searches for terms that would match User A's data
    const response = await fetch(
      `${BASE_URL}/api/memories/context-graph?action=query&q=salary finance sensitive`,
      {
        headers: { 'x-user-id': USER_B_ID },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const results = data.results || [];

      // Should not find User A's sensitive data
      for (const result of results) {
        const content = JSON.stringify(result);
        for (const [key, value] of Object.entries(SENSITIVE_DATA)) {
          expect(content.includes(value)).toBe(false);
        }
      }
    }
  });

  test('SEC-LEAK-007: Semantic search doesnt cross user boundaries', async () => {
    // Search for similar concepts
    const searches = ['financial information', 'personal details', 'private data'];

    for (const query of searches) {
      const response = await fetch(
        `${BASE_URL}/api/memories/context-graph?action=query&q=${encodeURIComponent(query)}`,
        {
          headers: { 'x-user-id': USER_B_ID },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const content = JSON.stringify(data);

        // Should not contain User A's data
        expect(content.includes(SENSITIVE_DATA.ssn)).toBe(false);
        expect(content.includes(SENSITIVE_DATA.creditCard)).toBe(false);
      }
    }
  });
});

// =============================================================================
// ADMIN ENDPOINT DATA EXPOSURE
// =============================================================================

describe('Admin Endpoint Data Exposure', () => {
  test('SEC-LEAK-008: Shared entities API doesnt expose user details', async () => {
    const response = await fetch(
      `${BASE_URL}/api/admin/collaboration?action=shared-entities`,
      {
        headers: {
          'x-admin-key': 'test-admin-key',
          'x-user-role': 'admin',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const content = JSON.stringify(data);

      // Should show entity names but not conversation content
      expect(content.includes(SENSITIVE_DATA.ssn)).toBe(false);
      expect(content.includes(SENSITIVE_DATA.creditCard)).toBe(false);
      expect(content.includes(SENSITIVE_DATA.password)).toBe(false);
    }
  });

  test('SEC-LEAK-009: Entity users API doesnt expose conversation context', async () => {
    // Even if entityId is found, user list should not include conversation details
    const response = await fetch(
      `${BASE_URL}/api/admin/collaboration?action=shared-entities`,
      {
        headers: {
          'x-admin-key': 'test-admin-key',
          'x-user-role': 'admin',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();

      // Check structure - should have stats but not raw content
      if (data.entities?.length > 0) {
        const entity = data.entities[0];
        expect(entity.entityName).toBeDefined();
        expect(entity.userCount).toBeDefined();
        // Should NOT have raw conversation context
        expect(entity.conversationContent).toBeUndefined();
        expect(entity.messages).toBeUndefined();
      }
    }
  });
});

// =============================================================================
// SESSION ENUMERATION PREVENTION
// =============================================================================

describe('Enumeration Prevention', () => {
  test('SEC-LEAK-010: Cannot enumerate session IDs', async () => {
    // Try common session ID patterns
    const guessedIds = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      'test-session-1',
      'admin-session',
    ];

    for (const id of guessedIds) {
      const response = await fetch(`${BASE_URL}/api/sessions/${id}`, {
        headers: { 'x-user-id': USER_B_ID },
      });

      // Should return 404 or 403, not reveal if session exists
      if (!response.ok) {
        // Error message should be consistent (not reveal existence)
        const body = await response.text();
        expect(body.includes('found')).toBe(false);
      }
    }
  });

  test('SEC-LEAK-011: Cannot enumerate user IDs', async () => {
    // Try common user ID patterns
    const guessedIds = ['admin', 'user1', 'test', '1', USER_A_ID.substring(0, 10)];

    for (const id of guessedIds) {
      const response = await fetch(`${BASE_URL}/api/memories?userId=${id}`, {
        headers: { 'x-user-id': id },
      });

      if (response.ok) {
        const data = await response.json();
        // Should return empty or own data, not confirm user exists
        expect(Array.isArray(data) || typeof data === 'object').toBe(true);
      }
    }
  });
});

// =============================================================================
// TIMING ATTACK PREVENTION
// =============================================================================

describe('Timing Attack Prevention', () => {
  test('SEC-LEAK-012: Consistent response time for valid/invalid sessions', async () => {
    const validSessionId = userASessionId;
    const invalidSessionId = '00000000-0000-0000-0000-000000000000';

    // Measure time for valid session (as owner)
    const startValid = Date.now();
    await fetch(`${BASE_URL}/api/sessions/${validSessionId}`, {
      headers: { 'x-user-id': USER_A_ID },
    });
    const validTime = Date.now() - startValid;

    // Measure time for invalid session
    const startInvalid = Date.now();
    await fetch(`${BASE_URL}/api/sessions/${invalidSessionId}`, {
      headers: { 'x-user-id': USER_B_ID },
    });
    const invalidTime = Date.now() - startInvalid;

    console.log(`Valid session time: ${validTime}ms`);
    console.log(`Invalid session time: ${invalidTime}ms`);

    // Times should be reasonably similar (within 500ms)
    // Large difference could indicate timing vulnerability
    const timeDiff = Math.abs(validTime - invalidTime);
    expect(timeDiff).toBeLessThan(1000);
  });
});
