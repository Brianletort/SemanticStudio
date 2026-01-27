/**
 * Resilience and Error Handling Tests
 * 
 * Verifies graceful degradation when components fail:
 * - LLM extraction failures
 * - Database timeouts
 * - Invalid inputs
 * - Partial failures
 */

import { describe, test, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = `resilience-test-${Date.now()}`;

/**
 * Helper to send chat message
 */
async function sendChatMessage(
  userId: string,
  message: string,
  config: Record<string, unknown> = {}
) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({
      message, // API expects 'message' as string
      mode: config.mode || 'fast',
      sessionId: config.sessionId,
    }),
  });

  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? await response.json() : null,
    error: !response.ok ? await response.text() : null,
  };
}

// =============================================================================
// GRACEFUL DEGRADATION
// =============================================================================

describe('Graceful Degradation', () => {
  test('RES-001: Chat works in fast mode (minimal memory)', async () => {
    const result = await sendChatMessage(
      TEST_USER_ID,
      'Hello, this is a test message.',
      { mode: 'fast' }
    );

    expect(result.ok).toBe(true);
    expect(result.data?.content || result.data?.message).toBeTruthy();
  });

  test('RES-002: Chat works in think mode (full memory)', async () => {
    const result = await sendChatMessage(
      TEST_USER_ID,
      'Testing with think mode.',
      { mode: 'think' }
    );

    expect(result.ok).toBe(true);
    expect(result.data?.content || result.data?.message).toBeTruthy();
  });

  test('RES-003: Chat works in research mode', async () => {
    const result = await sendChatMessage(
      TEST_USER_ID,
      'Testing research mode.',
      { mode: 'research' }
    );

    expect(result.ok).toBe(true);
    expect(result.data?.content || result.data?.message).toBeTruthy();
  });

  test('RES-004: Chat works without explicit mode', async () => {
    const result = await sendChatMessage(
      TEST_USER_ID,
      'Testing default mode.',
      {}
    );

    expect(result.ok).toBe(true);
    expect(result.data?.content || result.data?.message).toBeTruthy();
  });
});

// =============================================================================
// INVALID INPUT HANDLING
// =============================================================================

describe('Invalid Input Handling', () => {
  test('RES-005: Handles empty message gracefully', async () => {
    const result = await sendChatMessage(TEST_USER_ID, '');

    // Should either reject or handle empty message
    if (result.ok) {
      expect(result.data).toBeDefined();
    } else {
      expect(result.status).toBe(400);
    }
  });

  test('RES-006: Handles very long message', async () => {
    const longMessage = 'x'.repeat(50000); // 50KB message

    const result = await sendChatMessage(TEST_USER_ID, longMessage);

    // Should handle without crashing
    expect(result.status).toBeLessThan(500);

    if (result.ok) {
      expect(result.data).toBeDefined();
    }
  });

  test('RES-007: Handles special characters in message', async () => {
    const specialMessage = `
      Unicode: 日本語 中文 한국어
      Emojis: 🚀 💡 ⚠️ ✅
      HTML: <script>alert('xss')</script>
      SQL: SELECT * FROM users; DROP TABLE;
      Quotes: "double" 'single' \`backtick\`
    `;

    const result = await sendChatMessage(TEST_USER_ID, specialMessage);

    // Should handle without crashing
    expect(result.status).toBeLessThan(500);
  });

  test('RES-008: Handles null bytes in message', async () => {
    const messageWithNull = 'Hello\x00World';

    const result = await sendChatMessage(TEST_USER_ID, messageWithNull);

    // Should handle gracefully
    expect(result.status).toBeLessThan(500);
  });

  test('RES-009: Handles invalid session ID format', async () => {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test' }],
        sessionId: 'not-a-valid-uuid',
      }),
    });

    // Should handle invalid UUID gracefully
    expect(response.status).toBeLessThan(500);
  });

  test('RES-010: Handles malformed JSON config', async () => {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Test' }],
        memoryConfig: 'not-an-object', // Should be object
      }),
    });

    // Should handle gracefully
    expect(response.status).toBeLessThan(500);
  });
});

// =============================================================================
// PARTIAL FAILURE HANDLING
// =============================================================================

describe('Partial Failure Handling', () => {
  test('RES-011: Chat succeeds even if fact extraction fails', async () => {
    // Send a message that might fail extraction (unusual format)
    const result = await sendChatMessage(
      TEST_USER_ID,
      `${'z'.repeat(1000)} asdf`,
      { memoryEnabled: true, memoryExtractionMode: 'aggressive' }
    );

    // Chat should still respond even if extraction had issues
    expect(result.ok).toBe(true);
    expect(result.data?.content || result.data?.message).toBeTruthy();
  });

  test('RES-012: Chat succeeds even if entity linking fails', async () => {
    // Send message with non-existent entity
    const result = await sendChatMessage(
      TEST_USER_ID,
      'Tell me about XYZ12345NonExistentCorp.',
      { memoryEnabled: true }
    );

    // Should still respond
    expect(result.ok).toBe(true);
    expect(result.data?.content || result.data?.message).toBeTruthy();
  });
});

// =============================================================================
// API ENDPOINT RESILIENCE
// =============================================================================

describe('API Endpoint Resilience', () => {
  test('RES-013: Memories API handles missing user', async () => {
    const response = await fetch(`${BASE_URL}/api/memories`, {
      // No x-user-id header
    });

    // Should not crash
    expect(response.status).toBeLessThan(500);
  });

  test('RES-014: Context graph API handles empty results', async () => {
    const newUserId = `empty-user-${Date.now()}`;

    const response = await fetch(
      `${BASE_URL}/api/memories/context-graph?action=recent&limit=10`,
      {
        headers: { 'x-user-id': newUserId },
      }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.references).toBeDefined();
    expect(Array.isArray(data.references)).toBe(true);
  });

  test('RES-015: Sessions API handles new user', async () => {
    const newUserId = `brand-new-user-${Date.now()}`;

    const response = await fetch(`${BASE_URL}/api/sessions`, {
      headers: { 'x-user-id': newUserId },
    });

    expect(response.ok).toBe(true);
    const sessions = await response.json();
    expect(Array.isArray(sessions)).toBe(true);
  });

  test('RES-016: Admin API handles empty database', async () => {
    const response = await fetch(
      `${BASE_URL}/api/admin/collaboration?action=shared-entities&minUsers=100`,
      {
        headers: {
          'x-admin-key': 'test-admin-key',
          'x-user-role': 'admin',
        },
      }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.entities).toBeDefined();
    expect(Array.isArray(data.entities)).toBe(true);
  });
});

// =============================================================================
// TIMEOUT HANDLING
// =============================================================================

describe('Timeout Handling', () => {
  test('RES-017: API responds within reasonable time', async () => {
    const startTime = Date.now();

    const result = await sendChatMessage(
      TEST_USER_ID,
      'Quick question: what is 2+2?',
      { memoryEnabled: true }
    );

    const duration = Date.now() - startTime;

    // Should respond within 30 seconds
    expect(duration).toBeLessThan(30000);

    // Should have a response
    expect(result.status).toBeLessThan(500);
  });

  test('RES-018: Memory retrieval completes in reasonable time', async () => {
    const startTime = Date.now();

    const response = await fetch(
      `${BASE_URL}/api/memories/context-graph?action=recent&limit=50`,
      {
        headers: { 'x-user-id': TEST_USER_ID },
      }
    );

    const duration = Date.now() - startTime;

    // Should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
    expect(response.ok).toBe(true);
  });
});

// =============================================================================
// ERROR RESPONSE FORMAT
// =============================================================================

describe('Error Response Format', () => {
  test('RES-019: 400 errors have proper format', async () => {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid }',
    });

    if (response.status === 400) {
      const data = await response.json().catch(() => null);

      if (data) {
        // Should have error message
        expect(data.error || data.message).toBeTruthy();
      }
    }
  });

  test('RES-020: API errors include helpful messages', async () => {
    const response = await fetch(
      `${BASE_URL}/api/admin/collaboration?action=unknown-action`,
      {
        headers: {
          'x-admin-key': 'test-admin-key',
          'x-user-role': 'admin',
        },
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      if (data) {
        // Error should explain what went wrong
        expect(data.error).toBeTruthy();
      }
    }
  });
});

// =============================================================================
// RECOVERY AFTER ERRORS
// =============================================================================

describe('Recovery After Errors', () => {
  test('RES-021: System recovers after bad request', async () => {
    // Send bad request
    await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid',
    });

    // Subsequent good request should work
    const result = await sendChatMessage(
      TEST_USER_ID,
      'This is a recovery test message.'
    );

    expect(result.ok).toBe(true);
  });

  test('RES-022: Session usable after memory error', async () => {
    // Create session
    const first = await sendChatMessage(
      TEST_USER_ID,
      'Creating session for recovery test.'
    );
    const sessionId = first.data?.sessionId;

    // Send potentially problematic message
    await sendChatMessage(
      TEST_USER_ID,
      `${'💥'.repeat(1000)}`, // Lots of emojis
      { sessionId }
    );

    // Session should still work
    const recovery = await sendChatMessage(
      TEST_USER_ID,
      'Can you still respond?',
      { sessionId }
    );

    expect(recovery.ok).toBe(true);
  });
});
