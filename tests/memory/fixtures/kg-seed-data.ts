/**
 * Knowledge Graph Test Data Seeding
 * 
 * Creates test entities in the knowledge graph for memory system testing.
 * These entities are used to verify entity auto-linking and cross-user collaboration.
 */

export interface TestEntity {
  type: string;
  name: string;
  properties: Record<string, unknown>;
}

/**
 * Test entities for memory system validation
 * These simulate real business data that sellers would discuss
 */
export const TEST_ENTITIES: TestEntity[] = [
  // Customers - for seller collaboration testing
  {
    type: 'customer',
    name: 'Acme Corp',
    properties: {
      industry: 'Technology',
      segment: 'Enterprise',
      annualRevenue: 50000000,
      employeeCount: 500,
      region: 'North America',
    },
  },
  {
    type: 'customer',
    name: 'TechStart Inc',
    properties: {
      industry: 'Software',
      segment: 'SMB',
      annualRevenue: 5000000,
      employeeCount: 50,
      region: 'North America',
    },
  },
  {
    type: 'customer',
    name: 'Global Solutions Ltd',
    properties: {
      industry: 'Consulting',
      segment: 'Enterprise',
      annualRevenue: 100000000,
      employeeCount: 2000,
      region: 'Europe',
    },
  },
  // Products
  {
    type: 'product',
    name: 'Enterprise Plan',
    properties: {
      category: 'Subscription',
      price: 999,
      tier: 'Premium',
    },
  },
  {
    type: 'product',
    name: 'Analytics Suite',
    properties: {
      category: 'Software',
      price: 499,
      tier: 'Professional',
    },
  },
  {
    type: 'product',
    name: 'Basic Starter',
    properties: {
      category: 'Subscription',
      price: 99,
      tier: 'Entry',
    },
  },
  // Opportunities - for sales testing
  {
    type: 'opportunity',
    name: 'Acme Corp Expansion',
    properties: {
      stage: 'Negotiation',
      amount: 250000,
      probability: 75,
      expectedClose: '2026-03-15',
    },
  },
  {
    type: 'opportunity',
    name: 'TechStart Renewal',
    properties: {
      stage: 'Proposal',
      amount: 50000,
      probability: 90,
      expectedClose: '2026-02-01',
    },
  },
];

/**
 * SQL injection test payloads
 * Used to verify the system properly sanitizes inputs
 */
export const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE context_references; --",
  "1 OR 1=1",
  "1'; DELETE FROM users WHERE '1'='1",
  "admin'--",
  "1 UNION SELECT * FROM users",
  "Robert'); DROP TABLE Students;--",
  "' OR ''='",
  "1; UPDATE users SET role='admin'",
];

/**
 * Special character test inputs
 * Used to verify proper handling of unicode and special chars
 */
export const SPECIAL_CHAR_INPUTS = [
  'Café ☕ Company',
  '日本語テスト企業',
  'Ñoño & Associates',
  '<script>alert("xss")</script>',
  '{"$gt": ""}', // NoSQL injection attempt
  '../../../etc/passwd',
  'Company\x00Name', // Null byte
  'Very\nLong\tWhitespace   Name',
];

/**
 * Seed test entities into the knowledge graph
 * Returns the IDs of created entities
 */
export async function seedTestEntities(baseUrl: string): Promise<Map<string, string>> {
  const entityIds = new Map<string, string>();
  
  for (const entity of TEST_ENTITIES) {
    try {
      const response = await fetch(`${baseUrl}/api/graph/node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: entity.type,
          name: entity.name,
          properties: entity.properties,
          sourceTable: 'test_data',
          sourceId: `test-${entity.name.toLowerCase().replace(/\s+/g, '-')}`,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        entityIds.set(entity.name, data.id);
        console.log(`Seeded entity: ${entity.name} (${data.id})`);
      }
    } catch (error) {
      console.error(`Failed to seed entity ${entity.name}:`, error);
    }
  }
  
  return entityIds;
}

/**
 * Check if test entities exist in the knowledge graph
 */
export async function checkTestEntities(baseUrl: string): Promise<{
  exists: boolean;
  missing: string[];
  found: string[];
}> {
  const missing: string[] = [];
  const found: string[] = [];
  
  for (const entity of TEST_ENTITIES) {
    try {
      const response = await fetch(
        `${baseUrl}/api/graph/data?search=${encodeURIComponent(entity.name)}&type=${entity.type}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.nodes && data.nodes.length > 0) {
          found.push(entity.name);
        } else {
          missing.push(entity.name);
        }
      } else {
        missing.push(entity.name);
      }
    } catch {
      missing.push(entity.name);
    }
  }
  
  return {
    exists: missing.length === 0,
    missing,
    found,
  };
}

/**
 * Clean up test entities after tests
 */
export async function cleanupTestEntities(
  baseUrl: string,
  entityIds: Map<string, string>
): Promise<void> {
  for (const [name, id] of entityIds) {
    try {
      await fetch(`${baseUrl}/api/graph/node/${id}`, {
        method: 'DELETE',
      });
      console.log(`Cleaned up entity: ${name}`);
    } catch (error) {
      console.error(`Failed to cleanup entity ${name}:`, error);
    }
  }
}

/**
 * Get a specific test entity by name
 */
export function getTestEntity(name: string): TestEntity | undefined {
  return TEST_ENTITIES.find(e => e.name === name);
}

/**
 * Get all entities of a specific type
 */
export function getTestEntitiesByType(type: string): TestEntity[] {
  return TEST_ENTITIES.filter(e => e.type === type);
}
