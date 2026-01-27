/**
 * Context Graph Service - Bridge Layer Between User Context and Domain KG
 * 
 * Links user context (sessions, facts, discussions) to domain knowledge graph entities.
 * Enables queries like "What did I discuss about Customer X?"
 * 
 * Key principles:
 * - User isolation: Each user's context references are private
 * - Bridge, not merge: Keep user context and domain KG separate
 * - Auto-linking: Automatically detect and link mentioned entities
 */

import { db, contextReferences, knowledgeGraphNodes, sessionMemoryFacts, sessions } from '@/lib/db';
import { eq, and, desc, sql, ilike, or } from 'drizzle-orm';
import { extractEntities } from '@/lib/semantic/entity-resolver';

/**
 * Reference type for context links
 */
export type ContextRefType = 
  | 'discussed'      // User discussed this entity
  | 'queried'        // User asked about this entity
  | 'mentioned'      // Entity was mentioned in passing
  | 'interested_in'  // User expressed interest
  | 'analyzed';      // Entity was analyzed in detail

/**
 * Context reference data
 */
export interface ContextRef {
  id: string;
  userId: string;
  sessionId?: string;
  kgNodeId?: string;
  memoryFactId?: string;
  refType: ContextRefType;
  context?: string;
  importance: number;
  createdAt: Date;
  // Joined data
  entityName?: string;
  entityType?: string;
  sessionTitle?: string;
}

/**
 * Result of cross-graph query
 */
export interface CrossGraphResult {
  entity: {
    id: string;
    name: string;
    type: string;
    properties: Record<string, unknown>;
  };
  references: Array<{
    sessionTitle: string;
    context: string;
    refType: string;
    when: Date;
  }>;
  totalMentions: number;
}

/**
 * Context Graph Service
 */
export class ContextGraphService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Link a session/fact to a knowledge graph entity
   */
  async linkToEntity(params: {
    kgNodeId: string;
    sessionId?: string;
    memoryFactId?: string;
    refType: ContextRefType;
    context?: string;
    importance?: number;
  }): Promise<string | null> {
    const { kgNodeId, sessionId, memoryFactId, refType, context, importance = 0.5 } = params;

    try {
      // Verify the kg_node exists
      const node = await db.select({ id: knowledgeGraphNodes.id })
        .from(knowledgeGraphNodes)
        .where(eq(knowledgeGraphNodes.id, kgNodeId))
        .limit(1);

      if (!node[0]) {
        console.warn(`[ContextGraphService] KG node not found: ${kgNodeId}`);
        return null;
      }

      // Check for existing link to avoid duplicates
      const existing = await db.select({ id: contextReferences.id })
        .from(contextReferences)
        .where(and(
          eq(contextReferences.userId, this.userId),
          eq(contextReferences.kgNodeId, kgNodeId),
          sessionId ? eq(contextReferences.sessionId, sessionId) : sql`TRUE`
        ))
        .limit(1);

      if (existing[0]) {
        // Update existing reference
        await db.update(contextReferences)
          .set({
            refType,
            context: context || undefined,
            importance: Math.max(existing[0].id ? importance : 0, importance),
            updatedAt: new Date(),
          })
          .where(eq(contextReferences.id, existing[0].id));
        return existing[0].id;
      }

      // Create new reference
      const result = await db.insert(contextReferences)
        .values({
          userId: this.userId,
          sessionId,
          kgNodeId,
          memoryFactId,
          refType,
          context,
          importance,
        })
        .returning({ id: contextReferences.id });

      return result[0]?.id || null;
    } catch (e) {
      console.error('[ContextGraphService] Failed to link entity:', e);
      return null;
    }
  }

  /**
   * Auto-detect and link entities from text
   */
  async autoLinkEntities(params: {
    text: string;
    sessionId: string;
    refType: ContextRefType;
    memoryFactId?: string;
  }): Promise<number> {
    const { text, sessionId, refType, memoryFactId } = params;
    let linkedCount = 0;

    try {
      // Use semantic entity resolver to extract entities
      const entities = await extractEntities(text);

      for (const resolved of entities) {
        // Find matching KG nodes
        const matchingNodes = await db.select({
          id: knowledgeGraphNodes.id,
          name: knowledgeGraphNodes.name,
          type: knowledgeGraphNodes.type,
        })
          .from(knowledgeGraphNodes)
          .where(or(
            ilike(knowledgeGraphNodes.name, `%${resolved.entity.name}%`),
            eq(knowledgeGraphNodes.type, resolved.entity.name.toLowerCase())
          ))
          .limit(5);

        for (const node of matchingNodes) {
          const linkId = await this.linkToEntity({
            kgNodeId: node.id,
            sessionId,
            memoryFactId,
            refType,
            context: text.substring(0, 200),
            importance: resolved.confidence,
          });

          if (linkId) linkedCount++;
        }
      }

      // Also try direct name matching for common patterns
      const words = text.split(/\s+/).filter(w => w.length > 3);
      for (const word of words.slice(0, 10)) {
        // Skip common words
        if (['what', 'where', 'when', 'which', 'have', 'does', 'many', 'much', 'this', 'that', 'with', 'from', 'about'].includes(word.toLowerCase())) {
          continue;
        }

        const matchingNodes = await db.select({
          id: knowledgeGraphNodes.id,
        })
          .from(knowledgeGraphNodes)
          .where(ilike(knowledgeGraphNodes.name, `%${word}%`))
          .limit(2);

        for (const node of matchingNodes) {
          await this.linkToEntity({
            kgNodeId: node.id,
            sessionId,
            refType: 'mentioned',
            context: text.substring(0, 200),
            importance: 0.3,
          });
          linkedCount++;
        }
      }

      console.log(`[ContextGraphService] Auto-linked ${linkedCount} entities from text`);
      return linkedCount;
    } catch (e) {
      console.error('[ContextGraphService] Failed to auto-link entities:', e);
      return 0;
    }
  }

  /**
   * Query: "What did I discuss about X?"
   */
  async whatDidIDiscussAbout(entityNameOrType: string): Promise<CrossGraphResult[]> {
    console.log(`[ContextGraphService] Querying: What did user discuss about "${entityNameOrType}"?`);

    try {
      // Find matching KG nodes
      const matchingNodes = await db.select({
        id: knowledgeGraphNodes.id,
        name: knowledgeGraphNodes.name,
        type: knowledgeGraphNodes.type,
        properties: knowledgeGraphNodes.properties,
      })
        .from(knowledgeGraphNodes)
        .where(or(
          ilike(knowledgeGraphNodes.name, `%${entityNameOrType}%`),
          ilike(knowledgeGraphNodes.type, `%${entityNameOrType}%`)
        ))
        .limit(10);

      const results: CrossGraphResult[] = [];

      for (const node of matchingNodes) {
        // Get all references for this user and node
        const refs = await db.select({
          id: contextReferences.id,
          sessionId: contextReferences.sessionId,
          refType: contextReferences.refType,
          context: contextReferences.context,
          createdAt: contextReferences.createdAt,
        })
          .from(contextReferences)
          .where(and(
            eq(contextReferences.userId, this.userId),
            eq(contextReferences.kgNodeId, node.id)
          ))
          .orderBy(desc(contextReferences.createdAt))
          .limit(20);

        if (refs.length === 0) continue;

        // Get session titles
        const sessionIds = [...new Set(refs.map(r => r.sessionId).filter(Boolean))];
        const sessionTitles = new Map<string, string>();

        if (sessionIds.length > 0) {
          const sessionData = await db.select({
            id: sessions.id,
            title: sessions.title,
          })
            .from(sessions)
            .where(sql`${sessions.id} IN (${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)})`);

          sessionData.forEach(s => sessionTitles.set(s.id, s.title || 'Untitled'));
        }

        results.push({
          entity: {
            id: node.id,
            name: node.name,
            type: node.type,
            properties: node.properties as Record<string, unknown>,
          },
          references: refs.map(r => ({
            sessionTitle: r.sessionId ? sessionTitles.get(r.sessionId) || 'Unknown' : 'Unknown',
            context: r.context || '',
            refType: r.refType,
            when: r.createdAt || new Date(),
          })),
          totalMentions: refs.length,
        });
      }

      return results;
    } catch (e) {
      console.error('[ContextGraphService] Cross-graph query failed:', e);
      return [];
    }
  }

  /**
   * Get recent context references for user
   */
  async getRecentReferences(limit: number = 20): Promise<ContextRef[]> {
    try {
      const refs = await db.select({
        id: contextReferences.id,
        userId: contextReferences.userId,
        sessionId: contextReferences.sessionId,
        kgNodeId: contextReferences.kgNodeId,
        memoryFactId: contextReferences.memoryFactId,
        refType: contextReferences.refType,
        context: contextReferences.context,
        importance: contextReferences.importance,
        createdAt: contextReferences.createdAt,
        entityName: knowledgeGraphNodes.name,
        entityType: knowledgeGraphNodes.type,
      })
        .from(contextReferences)
        .leftJoin(knowledgeGraphNodes, eq(contextReferences.kgNodeId, knowledgeGraphNodes.id))
        .where(eq(contextReferences.userId, this.userId))
        .orderBy(desc(contextReferences.createdAt))
        .limit(limit);

      return refs.map(r => ({
        id: r.id,
        userId: r.userId,
        sessionId: r.sessionId || undefined,
        kgNodeId: r.kgNodeId || undefined,
        memoryFactId: r.memoryFactId || undefined,
        refType: r.refType as ContextRefType,
        context: r.context || undefined,
        importance: r.importance || 0.5,
        createdAt: r.createdAt || new Date(),
        entityName: r.entityName || undefined,
        entityType: r.entityType || undefined,
      }));
    } catch (e) {
      console.error('[ContextGraphService] Failed to get recent references:', e);
      return [];
    }
  }

  /**
   * Get entities user has interacted with most
   */
  async getTopEntities(limit: number = 10): Promise<Array<{
    entityId: string;
    entityName: string;
    entityType: string;
    mentionCount: number;
    lastMentioned: Date;
  }>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          kg.id as entity_id,
          kg.name as entity_name,
          kg.type as entity_type,
          COUNT(cr.id) as mention_count,
          MAX(cr.created_at) as last_mentioned
        FROM context_references cr
        JOIN knowledge_graph_nodes kg ON cr.kg_node_id = kg.id
        WHERE cr.user_id = ${this.userId}
        GROUP BY kg.id, kg.name, kg.type
        ORDER BY mention_count DESC, last_mentioned DESC
        LIMIT ${limit}
      `);

      return (result.rows as Array<{
        entity_id: string;
        entity_name: string;
        entity_type: string;
        mention_count: string;
        last_mentioned: Date;
      }>).map(r => ({
        entityId: r.entity_id,
        entityName: r.entity_name,
        entityType: r.entity_type,
        mentionCount: parseInt(r.mention_count, 10),
        lastMentioned: r.last_mentioned,
      }));
    } catch (e) {
      console.error('[ContextGraphService] Failed to get top entities:', e);
      return [];
    }
  }

  /**
   * Delete all context references for user (for privacy/cleanup)
   */
  async clearUserContext(): Promise<number> {
    try {
      const result = await db.delete(contextReferences)
        .where(eq(contextReferences.userId, this.userId))
        .returning({ id: contextReferences.id });

      console.log(`[ContextGraphService] Cleared ${result.length} context references for user`);
      return result.length;
    } catch (e) {
      console.error('[ContextGraphService] Failed to clear user context:', e);
      return 0;
    }
  }

  // ============================================================================
  // CROSS-USER QUERIES (Admin Only)
  // These methods are static and not user-scoped - for admin/analytics use only
  // ============================================================================

  /**
   * Get all users who have discussed a specific entity
   * Admin/cross-user query - not user-scoped
   */
  static async getUsersDiscussingEntity(
    kgNodeId: string
  ): Promise<Array<{
    userId: string;
    mentionCount: number;
    lastMentioned: Date;
    refTypes: string[];
  }>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          user_id,
          COUNT(*) as mention_count,
          MAX(created_at) as last_mentioned,
          array_agg(DISTINCT ref_type) as ref_types
        FROM context_references
        WHERE kg_node_id = ${kgNodeId}
        GROUP BY user_id
        ORDER BY mention_count DESC, last_mentioned DESC
      `);

      return (result.rows as Array<{
        user_id: string;
        mention_count: string;
        last_mentioned: Date;
        ref_types: string[];
      }>).map(r => ({
        userId: r.user_id,
        mentionCount: parseInt(r.mention_count, 10),
        lastMentioned: r.last_mentioned,
        refTypes: r.ref_types || [],
      }));
    } catch (e) {
      console.error('[ContextGraphService] Failed to get users for entity:', e);
      return [];
    }
  }

  /**
   * Get entities that have been discussed by multiple users
   * For detecting collaboration opportunities (e.g., two sellers working on same customer)
   */
  static async getSharedEntities(
    minUsers: number = 2
  ): Promise<Array<{
    entityId: string;
    entityName: string;
    entityType: string;
    userCount: number;
    totalMentions: number;
    lastActivity: Date;
  }>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          kg.id as entity_id,
          kg.name as entity_name,
          kg.type as entity_type,
          COUNT(DISTINCT cr.user_id) as user_count,
          COUNT(cr.id) as total_mentions,
          MAX(cr.created_at) as last_activity
        FROM context_references cr
        JOIN knowledge_graph_nodes kg ON cr.kg_node_id = kg.id
        GROUP BY kg.id, kg.name, kg.type
        HAVING COUNT(DISTINCT cr.user_id) >= ${minUsers}
        ORDER BY user_count DESC, total_mentions DESC
        LIMIT 50
      `);

      return (result.rows as Array<{
        entity_id: string;
        entity_name: string;
        entity_type: string;
        user_count: string;
        total_mentions: string;
        last_activity: Date;
      }>).map(r => ({
        entityId: r.entity_id,
        entityName: r.entity_name,
        entityType: r.entity_type,
        userCount: parseInt(r.user_count, 10),
        totalMentions: parseInt(r.total_mentions, 10),
        lastActivity: r.last_activity,
      }));
    } catch (e) {
      console.error('[ContextGraphService] Failed to get shared entities:', e);
      return [];
    }
  }

  /**
   * Get collaboration opportunities for a specific user
   * Returns entities the user has discussed that other users have also discussed
   */
  static async getCollaborationOpportunities(
    userId: string
  ): Promise<Array<{
    entityId: string;
    entityName: string;
    entityType: string;
    otherUserCount: number;
    userMentionCount: number;
  }>> {
    try {
      const result = await db.execute(sql`
        WITH user_entities AS (
          SELECT DISTINCT kg_node_id
          FROM context_references
          WHERE user_id = ${userId}
        )
        SELECT 
          kg.id as entity_id,
          kg.name as entity_name,
          kg.type as entity_type,
          COUNT(DISTINCT cr.user_id) - 1 as other_user_count,
          SUM(CASE WHEN cr.user_id = ${userId} THEN 1 ELSE 0 END) as user_mention_count
        FROM context_references cr
        JOIN knowledge_graph_nodes kg ON cr.kg_node_id = kg.id
        WHERE cr.kg_node_id IN (SELECT kg_node_id FROM user_entities)
        GROUP BY kg.id, kg.name, kg.type
        HAVING COUNT(DISTINCT cr.user_id) > 1
        ORDER BY other_user_count DESC
        LIMIT 20
      `);

      return (result.rows as Array<{
        entity_id: string;
        entity_name: string;
        entity_type: string;
        other_user_count: string;
        user_mention_count: string;
      }>).map(r => ({
        entityId: r.entity_id,
        entityName: r.entity_name,
        entityType: r.entity_type,
        otherUserCount: parseInt(r.other_user_count, 10),
        userMentionCount: parseInt(r.user_mention_count, 10),
      }));
    } catch (e) {
      console.error('[ContextGraphService] Failed to get collaboration opportunities:', e);
      return [];
    }
  }

  /**
   * Get entity discussion details across users (admin view)
   * Returns anonymized or named user list depending on permissions
   */
  static async getEntityDiscussionDetails(
    kgNodeId: string,
    includeUserDetails: boolean = false
  ): Promise<{
    entity: {
      id: string;
      name: string;
      type: string;
    } | null;
    stats: {
      totalUsers: number;
      totalMentions: number;
      firstMentioned: Date | null;
      lastMentioned: Date | null;
    };
    users: Array<{
      userId: string;
      mentionCount: number;
      lastActive: Date;
    }>;
  }> {
    try {
      // Get entity info
      const entityResult = await db.select({
        id: knowledgeGraphNodes.id,
        name: knowledgeGraphNodes.name,
        type: knowledgeGraphNodes.type,
      })
        .from(knowledgeGraphNodes)
        .where(eq(knowledgeGraphNodes.id, kgNodeId))
        .limit(1);

      const entity = entityResult[0] || null;

      // Get aggregate stats
      const statsResult = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT user_id) as total_users,
          COUNT(*) as total_mentions,
          MIN(created_at) as first_mentioned,
          MAX(created_at) as last_mentioned
        FROM context_references
        WHERE kg_node_id = ${kgNodeId}
      `);

      const statsRow = statsResult.rows[0] as {
        total_users: string;
        total_mentions: string;
        first_mentioned: Date;
        last_mentioned: Date;
      };

      // Get user breakdown if requested
      let users: Array<{ userId: string; mentionCount: number; lastActive: Date }> = [];
      
      if (includeUserDetails) {
        const usersResult = await db.execute(sql`
          SELECT 
            user_id,
            COUNT(*) as mention_count,
            MAX(created_at) as last_active
          FROM context_references
          WHERE kg_node_id = ${kgNodeId}
          GROUP BY user_id
          ORDER BY mention_count DESC
        `);

        users = (usersResult.rows as Array<{
          user_id: string;
          mention_count: string;
          last_active: Date;
        }>).map(r => ({
          userId: r.user_id,
          mentionCount: parseInt(r.mention_count, 10),
          lastActive: r.last_active,
        }));
      }

      return {
        entity,
        stats: {
          totalUsers: parseInt(statsRow.total_users || '0', 10),
          totalMentions: parseInt(statsRow.total_mentions || '0', 10),
          firstMentioned: statsRow.first_mentioned || null,
          lastMentioned: statsRow.last_mentioned || null,
        },
        users,
      };
    } catch (e) {
      console.error('[ContextGraphService] Failed to get entity discussion details:', e);
      return {
        entity: null,
        stats: {
          totalUsers: 0,
          totalMentions: 0,
          firstMentioned: null,
          lastMentioned: null,
        },
        users: [],
      };
    }
  }
}

/**
 * Create a new ContextGraphService instance for a user
 */
export function createContextGraphService(userId: string): ContextGraphService {
  return new ContextGraphService(userId);
}
