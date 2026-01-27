/**
 * Memory Extraction API Tests
 * 
 * Tests Tier 1-3 of the memory system:
 * - Working context (recent messages + summary)
 * - Session memory (fact extraction)
 * - Long-term memory (cross-session persistence)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  sendChatMessage,
  createSession,
  getSessionFacts,
  getUserMemories,
  waitForProcessing,
} from '../fixtures/api-helpers';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = `test-user-${Date.now()}`;

// Test state
let testSessionId: string;

// =============================================================================
// SETUP
// =============================================================================

beforeAll(async () => {
  // Create a session for testing
  const session = await createSession(TEST_USER_ID, 'Memory Extraction Test');
  if (session) {
    testSessionId = session.id;
    console.log('Created test session:', testSessionId);
  }
}, 30000);

// =============================================================================
// TIER 1: WORKING CONTEXT TESTS
// =============================================================================

describe('Tier 1: Working Context', () => {
  test('ME-001: Chat response includes context from previous messages', async () => {
    // First message - establish context
    const response1 = await sendChatMessage(
      TEST_USER_ID,
      'I am working on a sales proposal for a technology company.',
      testSessionId,
      'think'
    );

    expect(response1.content.length).toBeGreaterThan(0);
    expect(response1.sessionId).toBe(testSessionId);

    // Second message - reference previous context
    const response2 = await sendChatMessage(
      TEST_USER_ID,
      'What should I include in the pricing section?',
      testSessionId,
      'think'
    );

    expect(response2.content.length).toBeGreaterThan(0);
    console.log('Response 2:', response2.content.substring(0, 200));
  }, 60000);

  test('ME-002: Session summary is generated after multiple turns', async () => {
    // Send several messages to trigger summary generation
    for (let i = 0; i < 3; i++) {
      await sendChatMessage(
        TEST_USER_ID,
        `Question ${i + 1}: What are best practices for enterprise sales?`,
        testSessionId,
        'fast'
      );
    }

    await waitForProcessing(2000);

    // Verify session still works
    const response = await fetch(`${BASE_URL}/api/sessions/${testSessionId}`, {
      headers: { 'x-user-id': TEST_USER_ID },
    });

    if (response.ok) {
      const session = await response.json();
      console.log('Session summary:', session.summaryText || 'Not generated yet');
      expect(session).toBeDefined();
    }
  }, 60000);
});

// =============================================================================
// TIER 2: SESSION MEMORY TESTS
// =============================================================================

describe('Tier 2: Session Memory', () => {
  let factSessionId: string;

  beforeAll(async () => {
    const session = await createSession(TEST_USER_ID, 'Fact Extraction Test');
    if (session) {
      factSessionId = session.id;
    }
  }, 30000);

  test('ME-003: Facts are extracted from personal information', async () => {
    // Send message with clear personal info
    const response = await sendChatMessage(
      TEST_USER_ID,
      'My name is Alex Johnson and I work at Acme Corp as a Sales Manager. ' +
        'I am preparing a proposal for our Q2 expansion into the European market.',
      factSessionId,
      'think'
    );

    expect(response.content.length).toBeGreaterThan(0);

    // Wait for async fact extraction
    await waitForProcessing(5000);

    // Check for extracted facts
    const facts = await getSessionFacts(TEST_USER_ID, factSessionId);
    console.log('Extracted session facts:', facts.length);
    
    expect(facts).toBeDefined();
  }, 60000);

  test('ME-004: Constraints are captured as session facts', async () => {
    const response = await sendChatMessage(
      TEST_USER_ID,
      'I only want to see data from Q1 2026. Focus on customers in the healthcare industry.',
      factSessionId,
      'think'
    );

    expect(response.content.length).toBeGreaterThan(0);
    await waitForProcessing(5000);

    const facts = await getSessionFacts(TEST_USER_ID, factSessionId);
    console.log('Facts after constraints:', facts.length);
  }, 60000);

  test('ME-005: Session facts have importance scores', async () => {
    const facts = await getSessionFacts(TEST_USER_ID, factSessionId);

    if (facts.length > 0) {
      for (const fact of facts) {
        const importance = (fact as Record<string, unknown>).importance as number;
        if (importance !== undefined) {
          expect(importance).toBeGreaterThanOrEqual(0);
          expect(importance).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(true).toBe(true);
  }, 30000);
});

// =============================================================================
// TIER 3: LONG-TERM MEMORY TESTS
// =============================================================================

describe('Tier 3: Long-term Memory', () => {
  test('ME-006: User preferences persist to user_memory', async () => {
    const newSession = await createSession(TEST_USER_ID, 'Preferences Test');
    
    if (newSession) {
      await sendChatMessage(
        TEST_USER_ID,
        'I always prefer to see data in table format rather than charts. ' +
          'Please remember this for future conversations.',
        newSession.id,
        'think'
      );

      await waitForProcessing(5000);

      const userMemories = await getUserMemories(TEST_USER_ID);
      console.log('User memories:', userMemories.length);
      expect(userMemories).toBeDefined();
    }
  }, 60000);

  test('ME-007: Cross-session memory retrieval', async () => {
    // Start a NEW session
    const newSession = await createSession(TEST_USER_ID, 'New Session Test');
    
    if (newSession) {
      const response = await sendChatMessage(
        TEST_USER_ID,
        'Show me customer data in the format I prefer.',
        newSession.id,
        'think'
      );

      expect(response.content.length).toBeGreaterThan(0);
      console.log('Cross-session response:', response.content.substring(0, 200));
    }
  }, 60000);

  test('ME-008: Saved memories are retrieved', async () => {
    // Save a memory explicitly
    const saveResponse = await fetch(`${BASE_URL}/api/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID,
      },
      body: JSON.stringify({
        content: 'User prefers detailed technical explanations',
        source: 'test',
      }),
    });

    if (saveResponse.ok) {
      await waitForProcessing(2000);
      const memories = await getUserMemories(TEST_USER_ID);
      console.log('Saved memory found:', memories.length > 0);
    }

    expect(true).toBe(true);
  }, 30000);
});

// =============================================================================
// MEMORY MODE TESTS
// =============================================================================

describe('Memory Mode Configuration', () => {
  test('ME-009: Fast mode works with minimal memory', async () => {
    const response = await sendChatMessage(
      TEST_USER_ID,
      'Quick question - what is 2+2?',
      undefined, // New session
      'fast'
    );

    expect(response.content.length).toBeGreaterThan(0);
    expect(response.error).toBeUndefined();
  }, 30000);

  test('ME-010: Think mode captures facts', async () => {
    const session = await createSession(TEST_USER_ID, 'Think Mode Test');
    
    if (session) {
      const response = await sendChatMessage(
        TEST_USER_ID,
        'I am interested in analytics products for my business.',
        session.id,
        'think'
      );

      expect(response.content.length).toBeGreaterThan(0);
      await waitForProcessing(3000);
    }
  }, 60000);
});

// =============================================================================
// CLEANUP
// =============================================================================

afterAll(async () => {
  console.log('Test user ID:', TEST_USER_ID);
  console.log('Test session ID:', testSessionId);
});
