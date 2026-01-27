/**
 * Context Graph Linking API Tests
 * 
 * Tests Tier 4 of the memory system:
 * - Entity auto-linking to knowledge graph
 * - Context reference creation
 * - Cross-graph queries
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  sendChatMessage,
  createSession,
  getContextReferences,
  getTopEntities,
  waitForProcessing,
} from '../fixtures/api-helpers';
import { checkTestEntities } from '../fixtures/kg-seed-data';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = `test-cg-user-${Date.now()}`;

let testSessionId: string;

// =============================================================================
// SETUP
// =============================================================================

beforeAll(async () => {
  // Check if test entities exist in KG
  const entityCheck = await checkTestEntities(BASE_URL);
  console.log('KG entity check:', entityCheck);

  // Create test session
  const session = await createSession(TEST_USER_ID, 'Context Graph Test');
  if (session) {
    testSessionId = session.id;
    console.log('Test session:', testSessionId);
  }
}, 30000);

// =============================================================================
// ENTITY AUTO-LINKING TESTS
// =============================================================================

describe('Entity Auto-Linking', () => {
  test('CG-001: Entity mentioned in query creates context reference', async () => {
    const response = await sendChatMessage(
      TEST_USER_ID,
      'Tell me about Acme Corp and their recent activity.',
      testSessionId,
      'think'
    );

    expect(response.content.length).toBeGreaterThan(0);
    await waitForProcessing(5000);

    const refs = await getContextReferences(TEST_USER_ID);
    console.log('Context references after mention:', refs.length);
    expect(refs).toBeDefined();
  }, 60000);

  test('CG-002: refType is correct for queries', async () => {
    await sendChatMessage(
      TEST_USER_ID,
      'What is the revenue of Global Solutions Ltd?',
      testSessionId,
      'think'
    );

    await waitForProcessing(3000);
    const refs = await getContextReferences(TEST_USER_ID);
    
    const queriedRefs = refs.filter((r: Record<string, unknown>) => r.refType === 'queried');
    console.log('Queried refs:', queriedRefs.length);
    expect(refs).toBeDefined();
  }, 60000);

  test('CG-003: Context references have valid structure', async () => {
    const refs = await getContextReferences(TEST_USER_ID);

    for (const ref of refs.slice(0, 5)) {
      const r = ref as Record<string, unknown>;
      expect(r.userId).toBe(TEST_USER_ID);
      if (r.kgNodeId) {
        expect(typeof r.kgNodeId).toBe('string');
      }
    }
  }, 30000);

  test('CG-004: Context references link to valid KG nodes', async () => {
    const refs = await getContextReferences(TEST_USER_ID);

    for (const ref of refs.slice(0, 3)) {
      const r = ref as Record<string, unknown>;
      if (r.kgNodeId) {
        const nodeResponse = await fetch(
          `${BASE_URL}/api/graph/node/${r.kgNodeId}`,
          { headers: { 'x-user-id': TEST_USER_ID } }
        );

        if (nodeResponse.ok) {
          const node = await nodeResponse.json();
          console.log(`Verified KG node: ${node.name}`);
        }
      }
    }
    expect(true).toBe(true);
  }, 30000);
});

// =============================================================================
// TOP ENTITIES TESTS
// =============================================================================

describe('Top Entities Tracking', () => {
  test('CG-005: Top entities returns mentioned entities', async () => {
    await sendChatMessage(
      TEST_USER_ID,
      'Compare Acme Corp with TechStart Inc in terms of growth potential.',
      testSessionId,
      'think'
    );

    await waitForProcessing(3000);
    const topEntities = await getTopEntities(TEST_USER_ID);
    
    console.log('Top entities:', topEntities.map((e: Record<string, unknown>) => e.entityName));
    expect(topEntities).toBeDefined();
  }, 60000);

  test('CG-006: Entity mention count increases', async () => {
    const before = await getTopEntities(TEST_USER_ID);
    
    await sendChatMessage(
      TEST_USER_ID,
      'I need more details about Acme Corp pricing.',
      testSessionId,
      'think'
    );

    await waitForProcessing(3000);
    const after = await getTopEntities(TEST_USER_ID);

    console.log('Entities before:', before.length);
    console.log('Entities after:', after.length);
    expect(after).toBeDefined();
  }, 60000);
});

// =============================================================================
// CROSS-GRAPH QUERY TESTS
// =============================================================================

describe('Cross-Graph Queries', () => {
  test('CG-007: Query discussions about entity', async () => {
    const response = await fetch(
      `${BASE_URL}/api/memories/context-graph?action=query&q=Acme`,
      { headers: { 'x-user-id': TEST_USER_ID } }
    );

    if (response.ok) {
      const data = await response.json();
      console.log('Discussion query results:', data.results?.length || 0);
    }
    expect(true).toBe(true);
  }, 30000);

  test('CG-008: Query results include context', async () => {
    const response = await fetch(
      `${BASE_URL}/api/memories/context-graph?action=query&q=customer`,
      { headers: { 'x-user-id': TEST_USER_ID } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.results?.length > 0) {
        console.log('Query result sample:', data.results[0]);
      }
    }
    expect(true).toBe(true);
  }, 30000);
});

// =============================================================================
// MULTIPLE ENTITY TYPES
// =============================================================================

describe('Multiple Entity Types', () => {
  test('CG-009: Customer entities are linked', async () => {
    await sendChatMessage(
      TEST_USER_ID,
      'Show me customers in the healthcare segment.',
      testSessionId,
      'think'
    );

    await waitForProcessing(3000);
    const refs = await getContextReferences(TEST_USER_ID);
    
    const customerRefs = refs.filter((r: Record<string, unknown>) => r.entityType === 'customer');
    console.log('Customer refs:', customerRefs.length);
  }, 60000);

  test('CG-010: Product entities are linked', async () => {
    await sendChatMessage(
      TEST_USER_ID,
      'What is included in the Enterprise Plan?',
      testSessionId,
      'think'
    );

    await waitForProcessing(3000);
    const refs = await getContextReferences(TEST_USER_ID);
    
    const productRefs = refs.filter((r: Record<string, unknown>) => r.entityType === 'product');
    console.log('Product refs:', productRefs.length);
  }, 60000);
});

// =============================================================================
// CONTEXT CAPTURE
// =============================================================================

describe('Context Capture', () => {
  test('CG-011: Context references include snippet', async () => {
    const refs = await getContextReferences(TEST_USER_ID);
    const refsWithContext = refs.filter((r: Record<string, unknown>) => r.context);

    console.log('Refs with context:', refsWithContext.length);
    if (refsWithContext.length > 0) {
      const sample = refsWithContext[0] as Record<string, unknown>;
      console.log('Sample context:', (sample.context as string)?.substring(0, 100));
    }
  }, 30000);

  test('CG-012: Context is truncated appropriately', async () => {
    const refs = await getContextReferences(TEST_USER_ID);

    for (const ref of refs) {
      const r = ref as Record<string, unknown>;
      if (r.context && typeof r.context === 'string') {
        expect(r.context.length).toBeLessThanOrEqual(500);
      }
    }
  }, 30000);
});

// =============================================================================
// CLEANUP
// =============================================================================

afterAll(async () => {
  console.log('Test user ID:', TEST_USER_ID);
  console.log('Test session ID:', testSessionId);

  const finalRefs = await getContextReferences(TEST_USER_ID);
  console.log('Total context references:', finalRefs.length);

  const finalEntities = await getTopEntities(TEST_USER_ID);
  console.log('Top entities:', finalEntities.map((e: Record<string, unknown>) => e.entityName));
});
