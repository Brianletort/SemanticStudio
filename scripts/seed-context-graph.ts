/**
 * Context Graph Seed Script
 * 
 * Populates the context graph with sample data for demonstration.
 * Creates context references linking users' sessions to knowledge graph entities.
 * 
 * Prerequisites:
 * - Database must be running and migrated
 * - Sample data (customers, products, etc.) should exist (run seed-data.sql first)
 * 
 * Run: npx tsx scripts/seed-context-graph.ts
 */

import { db } from '../src/lib/db';
import { 
  users, 
  sessions, 
  messages, 
  knowledgeGraphNodes, 
  contextReferences 
} from '../src/lib/db/schema';
import { sql, eq, ilike } from 'drizzle-orm';
import { KnowledgeGraphPipeline } from '../src/lib/graph/kg-pipeline';

// Sample users for demonstration
const SAMPLE_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Demo User',
    email: 'demo@example.com',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Sales Rep',
    email: 'sales@example.com',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Support Agent',
    email: 'support@example.com',
  },
];

// Sample sessions with context
interface SampleSession {
  userId: string;
  title: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    entities: string[]; // Entity names to link to
    refType: 'discussed' | 'queried' | 'mentioned' | 'interested_in' | 'analyzed';
  }>;
}

const SAMPLE_SESSIONS: SampleSession[] = [
  {
    userId: '00000000-0000-0000-0000-000000000001',
    title: 'TechCorp Enterprise Deal Discussion',
    messages: [
      {
        role: 'user',
        content: 'What is the current status of the TechCorp Industries deal?',
        entities: ['TechCorp Industries'],
        refType: 'queried',
      },
      {
        role: 'assistant',
        content: 'TechCorp Industries has an active opportunity worth $250,000 in the negotiation stage. The enterprise license renewal is expected to close in about 30 days.',
        entities: ['TechCorp Industries', 'Enterprise Platform License'],
        refType: 'discussed',
      },
      {
        role: 'user',
        content: 'Who is the owner of this opportunity?',
        entities: ['TechCorp Industries'],
        refType: 'queried',
      },
      {
        role: 'assistant',
        content: 'Sarah Johnson is the owner of the TechCorp Industries Enterprise License Renewal opportunity.',
        entities: ['Sarah Johnson', 'TechCorp Industries'],
        refType: 'discussed',
      },
    ],
  },
  {
    userId: '00000000-0000-0000-0000-000000000002',
    title: 'Financial Services Group Analysis',
    messages: [
      {
        role: 'user',
        content: 'Analyze the Financial Services Group account health and opportunities.',
        entities: ['Financial Services Group'],
        refType: 'analyzed',
      },
      {
        role: 'assistant',
        content: 'Financial Services Group is an enterprise customer with excellent health score (95) and low churn risk. They have a Financial Analytics Suite opportunity worth $750,000 at 80% probability.',
        entities: ['Financial Services Group'],
        refType: 'analyzed',
      },
      {
        role: 'user',
        content: 'What products might they be interested in?',
        entities: ['Financial Services Group'],
        refType: 'queried',
      },
      {
        role: 'assistant',
        content: 'Given their financial services focus, they might benefit from the Compliance Module ($12,000) and Reporting Dashboard Pro ($8,000) add-ons.',
        entities: ['Financial Services Group', 'Compliance Module', 'Reporting Dashboard Pro'],
        refType: 'discussed',
      },
    ],
  },
  {
    userId: '00000000-0000-0000-0000-000000000003',
    title: 'StartupXYZ Support Issue',
    messages: [
      {
        role: 'user',
        content: 'There is a billing inquiry from StartupXYZ. Can you pull up their details?',
        entities: ['StartupXYZ'],
        refType: 'queried',
      },
      {
        role: 'assistant',
        content: 'StartupXYZ is a small business (SMB) customer in the technology sector with $2M annual revenue. They have a high churn risk indicator. There is currently an open billing inquiry ticket.',
        entities: ['StartupXYZ'],
        refType: 'discussed',
      },
      {
        role: 'user',
        content: 'What can we do to reduce their churn risk?',
        entities: ['StartupXYZ'],
        refType: 'interested_in',
      },
      {
        role: 'assistant',
        content: 'Consider offering them a customized onboarding session or a discount on the Basic Starter plan to improve engagement. Their last activity was 14 days ago.',
        entities: ['StartupXYZ', 'Basic Starter'],
        refType: 'discussed',
      },
    ],
  },
  {
    userId: '00000000-0000-0000-0000-000000000001',
    title: 'Global Manufacturing Co Platform Expansion',
    messages: [
      {
        role: 'user',
        content: 'Tell me about the Global Manufacturing Co expansion opportunity.',
        entities: ['Global Manufacturing Co'],
        refType: 'queried',
      },
      {
        role: 'assistant',
        content: 'Global Manufacturing Co has a Platform Expansion opportunity worth $500,000 at proposal stage with 60% probability, expected to close in 45 days. Michael Chen is the owner.',
        entities: ['Global Manufacturing Co', 'Michael Chen'],
        refType: 'discussed',
      },
    ],
  },
  {
    userId: '00000000-0000-0000-0000-000000000002',
    title: 'Healthcare Partners Module Add-on',
    messages: [
      {
        role: 'user',
        content: 'What happened with the Healthcare Partners deal?',
        entities: ['Healthcare Partners'],
        refType: 'queried',
      },
      {
        role: 'assistant',
        content: 'Great news! The Healthcare Module Add-on deal with Healthcare Partners closed won 5 days ago for $400,000. Sarah Johnson closed this deal.',
        entities: ['Healthcare Partners', 'Sarah Johnson'],
        refType: 'discussed',
      },
      {
        role: 'user',
        content: 'Are there any cross-sell opportunities?',
        entities: ['Healthcare Partners'],
        refType: 'interested_in',
      },
      {
        role: 'assistant',
        content: 'Healthcare Partners has a high health score (88) and could benefit from the Security Add-on and API Access License to complement their healthcare module.',
        entities: ['Healthcare Partners', 'Security Add-on', 'API Access License'],
        refType: 'mentioned',
      },
    ],
  },
];

async function ensureUsersExist() {
  console.log('Ensuring sample users exist...');
  
  for (const user of SAMPLE_USERS) {
    try {
      await db.execute(sql`
        INSERT INTO users (id, name, email)
        VALUES (${user.id}, ${user.name}, ${user.email})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email
      `);
      console.log(`  Created/updated user: ${user.name}`);
    } catch (error) {
      console.error(`  Failed to create user ${user.name}:`, error);
    }
  }
}

async function buildKnowledgeGraph() {
  console.log('\nBuilding knowledge graph from sample data...');
  
  try {
    const pipeline = new KnowledgeGraphPipeline({ generateEmbeddings: false });
    const stats = await pipeline.build();
    
    console.log(`  Created ${stats.totalNodes} nodes and ${stats.totalEdges} edges`);
    console.log('  Node types:', Object.entries(stats.nodesByType).map(([k, v]) => `${k}:${v}`).join(', '));
    
    return stats;
  } catch (error) {
    console.error('  Failed to build knowledge graph:', error);
    throw error;
  }
}

async function findKGNodeByName(name: string): Promise<string | null> {
  const results = await db.select({ id: knowledgeGraphNodes.id })
    .from(knowledgeGraphNodes)
    .where(ilike(knowledgeGraphNodes.name, `%${name}%`))
    .limit(1);
  
  return results[0]?.id || null;
}

async function createSessionsWithContextReferences() {
  console.log('\nCreating sample sessions with context references...');
  
  let totalSessions = 0;
  let totalMessages = 0;
  let totalRefs = 0;
  
  for (const sessionData of SAMPLE_SESSIONS) {
    try {
      // Create session
      const [session] = await db.insert(sessions).values({
        userId: sessionData.userId,
        title: sessionData.title,
      }).returning();
      
      console.log(`  Created session: ${sessionData.title}`);
      totalSessions++;
      
      // Create messages and context references
      for (const msg of sessionData.messages) {
        // Insert message
        await db.insert(messages).values({
          sessionId: session.id,
          role: msg.role,
          content: msg.content,
        });
        totalMessages++;
        
        // Create context references for mentioned entities
        if (msg.role === 'user' || msg.role === 'assistant') {
          for (const entityName of msg.entities) {
            const nodeId = await findKGNodeByName(entityName);
            
            if (nodeId) {
              try {
                await db.insert(contextReferences).values({
                  userId: sessionData.userId,
                  sessionId: session.id,
                  kgNodeId: nodeId,
                  refType: msg.refType,
                  context: msg.content.substring(0, 200),
                  importance: msg.refType === 'analyzed' ? 0.9 : 
                             msg.refType === 'interested_in' ? 0.8 : 
                             msg.refType === 'discussed' ? 0.7 : 
                             msg.refType === 'queried' ? 0.6 : 0.5,
                });
                totalRefs++;
              } catch {
                // Ignore duplicate references
              }
            } else {
              console.log(`    Entity not found in KG: ${entityName}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`  Failed to create session ${sessionData.title}:`, error);
    }
  }
  
  console.log(`\n  Total: ${totalSessions} sessions, ${totalMessages} messages, ${totalRefs} context references`);
}

async function displayStats() {
  console.log('\n=== Context Graph Statistics ===\n');
  
  // Count context references by type
  const refsByType = await db.execute(sql`
    SELECT ref_type, COUNT(*) as count 
    FROM context_references 
    GROUP BY ref_type
  `);
  
  console.log('Context references by type:');
  for (const row of refsByType.rows as Array<{ ref_type: string; count: number }>) {
    console.log(`  ${row.ref_type}: ${row.count}`);
  }
  
  // Count by user
  const refsByUser = await db.execute(sql`
    SELECT u.name, COUNT(cr.id) as count
    FROM context_references cr
    JOIN users u ON cr.user_id = u.id
    GROUP BY u.name
  `);
  
  console.log('\nContext references by user:');
  for (const row of refsByUser.rows as Array<{ name: string; count: number }>) {
    console.log(`  ${row.name}: ${row.count}`);
  }
  
  // Top entities referenced
  const topEntities = await db.execute(sql`
    SELECT kgn.name, kgn.type, COUNT(cr.id) as mentions
    FROM context_references cr
    JOIN knowledge_graph_nodes kgn ON cr.kg_node_id = kgn.id
    GROUP BY kgn.id, kgn.name, kgn.type
    ORDER BY mentions DESC
    LIMIT 10
  `);
  
  console.log('\nTop referenced entities:');
  for (const row of topEntities.rows as Array<{ name: string; type: string; mentions: number }>) {
    console.log(`  ${row.name} (${row.type}): ${row.mentions} mentions`);
  }
}

async function main() {
  console.log('=== Context Graph Seed Script ===\n');
  
  try {
    // Step 1: Ensure users exist
    await ensureUsersExist();
    
    // Step 2: Build knowledge graph
    await buildKnowledgeGraph();
    
    // Step 3: Create sessions and context references
    await createSessionsWithContextReferences();
    
    // Step 4: Display statistics
    await displayStats();
    
    console.log('\n=== Seeding Complete ===\n');
    console.log('You can now test the context graph API:');
    console.log('  GET /api/memories/context-graph?action=top-entities');
    console.log('  GET /api/memories/context-graph?action=recent');
    console.log('  GET /api/memories/context-graph?query=TechCorp');
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
