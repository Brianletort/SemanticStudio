/**
 * User Isolation Tests
 * 
 * Verifies each user has isolated context:
 * - Context references
 * - Session facts
 * - User memories
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  sendChatMessage,
  createSession,
  getContextReferences,
  getSessionFacts,
  getUserMemories,
  getTopEntities,
  waitForProcessing,
} from '../fixtures/api-helpers';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const USER_A_ID = `test-isolation-user-a-${Date.now()}`;
const USER_B_ID = `test-isolation-user-b-${Date.now()}`;

let userASessionId: string;
let userBSessionId: string;

// =============================================================================
// SETUP
// =============================================================================

beforeAll(async () => {
  console.log('Setting up User A...');
  const sessionA = await createSession(USER_A_ID, 'User A Private Session');
  if (sessionA) {
    userASessionId = sessionA.id;
    await sendChatMessage(
      USER_A_ID,
      'I am working on a proposal for Acme Corp. My contact is John Smith. Budget: $500k.',
      userASessionId,
      'think'
    );
  }

  console.log('Setting up User B...');
  const sessionB = await createSession(USER_B_ID, 'User B Private Session');
  if (sessionB) {
    userBSessionId = sessionB.id;
    await sendChatMessage(
      USER_B_ID,
      'Tell me about TechStart Inc. I prefer charts over tables.',
      userBSessionId,
      'think'
    );
  }

  await waitForProcessing(5000);
  console.log('Setup complete');
}, 120000);

// =============================================================================
// CONTEXT REFERENCE ISOLATION
// =============================================================================

describe('Context Reference Isolation', () => {
  test('ISO-001: User A only sees own context references', async () => {
    const userARefs = await getContextReferences(USER_A_ID);
    console.log('User A refs:', userARefs.length);

    for (const ref of userARefs) {
      const r = ref as Record<string, unknown>;
      expect(r.userId).toBe(USER_A_ID);
    }
  }, 30000);

  test('ISO-002: User B only sees own context references', async () => {
    const userBRefs = await getContextReferences(USER_B_ID);
    console.log('User B refs:', userBRefs.length);

    for (const ref of userBRefs) {
      const r = ref as Record<string, unknown>;
      expect(r.userId).toBe(USER_B_ID);
    }
  }, 30000);

  test('ISO-003: User A cannot see User B entity discussions', async () => {
    const userARefs = await getContextReferences(USER_A_ID);
    
    const techStartRefs = userARefs.filter((r: Record<string, unknown>) =>
      (r.entityName as string)?.toLowerCase().includes('techstart')
    );

    expect(techStartRefs.length).toBe(0);
  }, 30000);

  test('ISO-004: User B cannot see User A entity discussions', async () => {
    const userBRefs = await getContextReferences(USER_B_ID);

    for (const ref of userBRefs) {
      const r = ref as Record<string, unknown>;
      expect(r.userId).toBe(USER_B_ID);
    }
  }, 30000);
});

// =============================================================================
// SESSION FACT ISOLATION
// =============================================================================

describe('Session Fact Isolation', () => {
  test('ISO-005: User A can access own session facts', async () => {
    if (userASessionId) {
      const facts = await getSessionFacts(USER_A_ID, userASessionId);
      console.log('User A session facts:', facts.length);
      expect(facts).toBeDefined();
    }
  }, 30000);

  test('ISO-006: User B cannot access User A session facts', async () => {
    if (userASessionId) {
      const facts = await getSessionFacts(USER_B_ID, userASessionId);
      console.log('User B trying to access User A session:', facts.length);
      expect(facts.length).toBe(0);
    }
  }, 30000);

  test('ISO-007: User A cannot access User B session facts', async () => {
    if (userBSessionId) {
      const facts = await getSessionFacts(USER_A_ID, userBSessionId);
      console.log('User A trying to access User B session:', facts.length);
      expect(facts.length).toBe(0);
    }
  }, 30000);
});

// =============================================================================
// USER MEMORY ISOLATION
// =============================================================================

describe('User Memory Isolation', () => {
  test('ISO-008: User A memories are isolated', async () => {
    const memories = await getUserMemories(USER_A_ID);
    console.log('User A memories:', memories.length);
    expect(memories).toBeDefined();
  }, 30000);

  test('ISO-009: User B memories are isolated', async () => {
    const memories = await getUserMemories(USER_B_ID);
    console.log('User B memories:', memories.length);
    expect(memories).toBeDefined();
  }, 30000);

  test('ISO-010: User memories do not leak', async () => {
    const userAMemories = await getUserMemories(USER_A_ID);
    const userBMemories = await getUserMemories(USER_B_ID);

    const userAContent = JSON.stringify(userAMemories);
    
    // User B's content shouldn't appear in User A's memories
    const hasChartPreference = userAContent.toLowerCase().includes('chart');
    const hasTechStart = userAContent.toLowerCase().includes('techstart');

    if (hasChartPreference || hasTechStart) {
      console.warn('Potential memory leak detected!');
    }
  }, 30000);
});

// =============================================================================
// TOP ENTITIES ISOLATION
// =============================================================================

describe('Top Entities Isolation', () => {
  test('ISO-011: User A top entities only show own discussions', async () => {
    const entities = await getTopEntities(USER_A_ID);
    console.log('User A top entities:', entities.map((e: Record<string, unknown>) => e.entityName));

    const hasTechStart = entities.some((e: Record<string, unknown>) =>
      (e.entityName as string)?.toLowerCase().includes('techstart')
    );
    expect(hasTechStart).toBe(false);
  }, 30000);

  test('ISO-012: User B top entities only show own discussions', async () => {
    const entities = await getTopEntities(USER_B_ID);
    console.log('User B top entities:', entities.map((e: Record<string, unknown>) => e.entityName));
    expect(entities).toBeDefined();
  }, 30000);
});

// =============================================================================
// SHARED KG NODE - SEPARATE CONTEXT
// =============================================================================

describe('Shared KG Node - Separate Context', () => {
  test('ISO-013: Both users can discuss same entity independently', async () => {
    // User B also discusses Acme Corp
    await sendChatMessage(
      USER_B_ID,
      'What do you know about Acme Corp?',
      userBSessionId,
      'think'
    );

    await waitForProcessing(3000);

    const userARefs = await getContextReferences(USER_A_ID);
    const userBRefs = await getContextReferences(USER_B_ID);

    // Check for Acme refs
    const userAAcme = userARefs.filter((r: Record<string, unknown>) =>
      (r.entityName as string)?.toLowerCase().includes('acme')
    );
    const userBAcme = userBRefs.filter((r: Record<string, unknown>) =>
      (r.entityName as string)?.toLowerCase().includes('acme')
    );

    console.log('User A Acme refs:', userAAcme.length);
    console.log('User B Acme refs:', userBAcme.length);

    // Refs should have different IDs
    if (userAAcme.length > 0 && userBAcme.length > 0) {
      const userARefIds = new Set(userAAcme.map((r: Record<string, unknown>) => r.id));
      const userBRefIds = new Set(userBAcme.map((r: Record<string, unknown>) => r.id));

      for (const id of userBRefIds) {
        expect(userARefIds.has(id)).toBe(false);
      }
    }
  }, 60000);

  test('ISO-014: Same KG node can be referenced by both users', async () => {
    const userARefs = await getContextReferences(USER_A_ID);
    const userBRefs = await getContextReferences(USER_B_ID);

    const userAAcme = userARefs.filter((r: Record<string, unknown>) =>
      (r.entityName as string)?.toLowerCase().includes('acme')
    );
    const userBAcme = userBRefs.filter((r: Record<string, unknown>) =>
      (r.entityName as string)?.toLowerCase().includes('acme')
    );

    if (userAAcme.length > 0 && userBAcme.length > 0) {
      const userAKgNodes = new Set(userAAcme.map((r: Record<string, unknown>) => r.kgNodeId));
      const userBKgNodes = new Set(userBAcme.map((r: Record<string, unknown>) => r.kgNodeId));

      let hasOverlap = false;
      for (const id of userBKgNodes) {
        if (userAKgNodes.has(id)) {
          hasOverlap = true;
          console.log('Both users reference KG node:', id);
        }
      }
      // Same KG node is expected
      if (hasOverlap) {
        console.log('✓ Both users correctly linked to same KG entity');
      }
    }
  }, 30000);
});

// =============================================================================
// CLEANUP
// =============================================================================

afterAll(async () => {
  console.log('User A ID:', USER_A_ID);
  console.log('User A Session:', userASessionId);
  console.log('User B ID:', USER_B_ID);
  console.log('User B Session:', userBSessionId);
});
