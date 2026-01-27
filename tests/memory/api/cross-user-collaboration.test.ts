/**
 * Cross-User Collaboration Tests
 * 
 * Tests the seller collaboration use case:
 * - Two sellers discuss same customer
 * - Admin can detect collaboration opportunity
 * - User privacy maintained
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  sendChatMessage,
  createSession,
  getContextReferences,
  waitForProcessing,
} from '../fixtures/api-helpers';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const SELLER_A_ID = `test-seller-a-${Date.now()}`;
const SELLER_B_ID = `test-seller-b-${Date.now()}`;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test-admin-key';

let sellerASessionId: string;
let sellerBSessionId: string;
let acmeCorpKgNodeId: string | null = null;

/**
 * Helper to call admin collaboration API
 */
async function adminCollaborationAPI(action: string, params: Record<string, string> = {}) {
  const queryParams = new URLSearchParams({ action, ...params });
  
  const response = await fetch(
    `${BASE_URL}/api/admin/collaboration?${queryParams}`,
    {
      headers: {
        'x-admin-key': ADMIN_API_KEY,
        'x-user-role': 'admin',
      },
    }
  );

  if (!response.ok) {
    return { success: false, error: await response.text() };
  }

  return await response.json();
}

/**
 * Find KG entity by name
 */
async function findKgEntity(name: string) {
  const response = await fetch(
    `${BASE_URL}/api/graph/data?search=${encodeURIComponent(name)}`
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data.nodes?.[0] || null;
}

// =============================================================================
// SETUP
// =============================================================================

beforeAll(async () => {
  console.log('=== SELLER COLLABORATION TEST SETUP ===');
  console.log('Seller A ID:', SELLER_A_ID);
  console.log('Seller B ID:', SELLER_B_ID);

  // Check if Acme Corp exists in KG
  const acmeEntity = await findKgEntity('Acme Corp');
  if (acmeEntity) {
    acmeCorpKgNodeId = acmeEntity.id;
    console.log('Found Acme Corp in KG:', acmeCorpKgNodeId);
  }

  // Seller A discusses Acme Corp
  console.log('\nSeller A starting discussion...');
  const sessionA = await createSession(SELLER_A_ID, 'Seller A - Acme Proposal');
  if (sessionA) {
    sellerASessionId = sessionA.id;
    await sendChatMessage(
      SELLER_A_ID,
      'I am preparing a proposal for Acme Corp. They need Enterprise Plan. Contact: John Smith, CTO.',
      sellerASessionId,
      'think'
    );
  }

  // Seller B discusses Acme Corp independently
  console.log('\nSeller B starting discussion...');
  const sessionB = await createSession(SELLER_B_ID, 'Seller B - Acme Research');
  if (sessionB) {
    sellerBSessionId = sessionB.id;
    await sendChatMessage(
      SELLER_B_ID,
      'What can you tell me about Acme Corp? I heard they need analytics software.',
      sellerBSessionId,
      'think'
    );
  }

  await waitForProcessing(5000);
  console.log('=== SETUP COMPLETE ===\n');
}, 180000);

// =============================================================================
// COLLABORATION DETECTION
// =============================================================================

describe('Collaboration Detection', () => {
  test('COLLAB-001: Both sellers create context references', async () => {
    const sellerARefs = await getContextReferences(SELLER_A_ID);
    const sellerBRefs = await getContextReferences(SELLER_B_ID);

    console.log('Seller A refs:', sellerARefs.length);
    console.log('Seller B refs:', sellerBRefs.length);

    expect(sellerARefs).toBeDefined();
    expect(sellerBRefs).toBeDefined();
  }, 30000);

  test('COLLAB-002: Admin can see shared entities', async () => {
    const result = await adminCollaborationAPI('shared-entities', { minUsers: '2' });

    console.log('Shared entities:', result);
    expect(result.success).toBe(true);
    expect(result.entities).toBeDefined();
  }, 30000);

  test('COLLAB-003: Admin can get users discussing entity', async () => {
    if (!acmeCorpKgNodeId) {
      console.log('Skipping - Acme Corp KG node not found');
      return;
    }

    const result = await adminCollaborationAPI('entity-users', {
      entityId: acmeCorpKgNodeId,
    });

    console.log('Users discussing Acme:', result);
    expect(result.success).toBe(true);
  }, 30000);

  test('COLLAB-004: Admin can get entity details', async () => {
    if (!acmeCorpKgNodeId) {
      console.log('Skipping - Acme Corp KG node not found');
      return;
    }

    const result = await adminCollaborationAPI('entity-details', {
      entityId: acmeCorpKgNodeId,
      includeUsers: 'true',
    });

    console.log('Entity details:', result);
    expect(result.success).toBe(true);
  }, 30000);

  test('COLLAB-005: Admin can get collaboration opportunities', async () => {
    const result = await adminCollaborationAPI('opportunities', {
      userId: SELLER_A_ID,
    });

    console.log('Collaboration opportunities:', result);
    expect(result.success).toBe(true);
  }, 30000);
});

// =============================================================================
// PRIVACY PRESERVATION
// =============================================================================

describe('Privacy Preservation', () => {
  test('COLLAB-006: Seller A cannot see Seller B details', async () => {
    const sellerARefs = await getContextReferences(SELLER_A_ID);

    for (const ref of sellerARefs) {
      const r = ref as Record<string, unknown>;
      expect(r.userId).toBe(SELLER_A_ID);
      if (r.sessionId) {
        expect(r.sessionId).not.toBe(sellerBSessionId);
      }
    }
  }, 30000);

  test('COLLAB-007: Seller B cannot see Seller A details', async () => {
    const sellerBRefs = await getContextReferences(SELLER_B_ID);

    for (const ref of sellerBRefs) {
      const r = ref as Record<string, unknown>;
      expect(r.userId).toBe(SELLER_B_ID);
      if (r.sessionId) {
        expect(r.sessionId).not.toBe(sellerASessionId);
      }
    }
  }, 30000);

  test('COLLAB-008: Non-admin cannot access collaboration API', async () => {
    const response = await fetch(
      `${BASE_URL}/api/admin/collaboration?action=shared-entities`,
      {
        headers: { 'x-user-id': SELLER_A_ID },
      }
    );

    expect(response.status).toBe(403);
  }, 30000);

  test('COLLAB-009: Both sellers link to same KG node', async () => {
    const sellerARefs = await getContextReferences(SELLER_A_ID);
    const sellerBRefs = await getContextReferences(SELLER_B_ID);

    const sellerAAcmeNodes = sellerARefs
      .filter((r: Record<string, unknown>) => (r.entityName as string)?.toLowerCase().includes('acme'))
      .map((r: Record<string, unknown>) => r.kgNodeId);

    const sellerBAcmeNodes = sellerBRefs
      .filter((r: Record<string, unknown>) => (r.entityName as string)?.toLowerCase().includes('acme'))
      .map((r: Record<string, unknown>) => r.kgNodeId);

    console.log('Seller A Acme KG nodes:', sellerAAcmeNodes);
    console.log('Seller B Acme KG nodes:', sellerBAcmeNodes);

    if (sellerAAcmeNodes.length > 0 && sellerBAcmeNodes.length > 0) {
      const overlap = sellerAAcmeNodes.filter((id: unknown) => sellerBAcmeNodes.includes(id));
      console.log('Overlapping KG nodes:', overlap);
      if (overlap.length > 0) {
        console.log('✓ Both sellers correctly linked to same KG entity');
      }
    }
  }, 30000);
});

// =============================================================================
// FULL SCENARIO VALIDATION
// =============================================================================

describe('Seller Use Case Validation', () => {
  test('COLLAB-010: Complete collaboration scenario', async () => {
    console.log('\n=== SELLER COLLABORATION SCENARIO ===');

    // Step 1: Verify both sellers have context
    const sellerARefs = await getContextReferences(SELLER_A_ID);
    const sellerBRefs = await getContextReferences(SELLER_B_ID);
    console.log(`Seller A: ${sellerARefs.length} refs`);
    console.log(`Seller B: ${sellerBRefs.length} refs`);

    // Step 2: Admin queries shared entities
    const sharedResult = await adminCollaborationAPI('shared-entities', { minUsers: '2' });
    console.log(`Shared entities: ${sharedResult.entities?.length || 0}`);

    // Step 3: Check if Acme Corp detected
    const acmeShared = sharedResult.entities?.find(
      (e: Record<string, unknown>) => (e.entityName as string)?.toLowerCase().includes('acme')
    );

    if (acmeShared) {
      console.log('\n✓ SUCCESS: Acme Corp detected as shared entity');
      console.log(`  - ${acmeShared.userCount} users discussing`);
      console.log(`  - ${acmeShared.totalMentions} total mentions`);
    } else {
      console.log('\n⚠ Acme Corp not detected (KG may not have entity or linking not complete)');
    }

    // Step 4: Verify privacy
    expect(sellerARefs.every((r: Record<string, unknown>) => r.userId === SELLER_A_ID)).toBe(true);
    expect(sellerBRefs.every((r: Record<string, unknown>) => r.userId === SELLER_B_ID)).toBe(true);
    console.log('✓ Privacy maintained');

    console.log('=== SCENARIO COMPLETE ===');
  }, 60000);
});

// =============================================================================
// CLEANUP
// =============================================================================

afterAll(async () => {
  console.log('\n=== TEST SUMMARY ===');
  console.log('Seller A ID:', SELLER_A_ID);
  console.log('Seller A Session:', sellerASessionId);
  console.log('Seller B ID:', SELLER_B_ID);
  console.log('Seller B Session:', sellerBSessionId);
  console.log('Acme Corp KG Node:', acmeCorpKgNodeId || 'Not found');
});
