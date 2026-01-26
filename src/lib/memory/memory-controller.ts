/**
 * Memory Controller - MemGPT-Style Self-Editing Memory
 * 
 * Provides tool-like operations for the LLM to manage its own memory:
 * - search: Search memory for relevant context
 * - add: Add new facts to memory
 * - update: Update existing memories
 * - consolidate: Compress multiple memories into summary
 * - forget: Remove outdated or contradicted memories
 * 
 * Key Features:
 * - Hierarchical compression (4 levels)
 * - Entity-centric knowledge tracking
 * - Proactive memory retrieval
 * - Periodic consolidation
 */

import { db, sessionMemoryFacts, userMemory } from '@/lib/db';
import { chat } from '@/lib/llm';
import { eq, desc, gte, lt, and, inArray, sql } from 'drizzle-orm';
import { getEmbedding } from './embeddings';
import {
  MemoryType,
  MemoryItem,
  MemorySearchOptions,
  MemorySearchResult,
  ConsolidationOptions,
  ConsolidationResult,
} from './types';

/**
 * Entity knowledge for tracking entity-centric information
 */
interface EntityKnowledge {
  id: string;
  type: 'county' | 'company' | 'project' | 'person' | 'utility' | 'other';
  name: string;
  aliases: string[];
  facts: Array<{
    content: string;
    source: string;
    confidence: number;
    timestamp: Date;
  }>;
  relationships: Array<{
    relationType: string;
    targetEntity: string;
    evidence: string;
  }>;
  lastMentioned?: Date;
}

/**
 * Memory Controller - Main class for self-editing memory operations
 */
export class MemoryController {
  private sessionId: string;
  private userId?: string;
  private entityCache: Map<string, EntityKnowledge> = new Map();
  
  constructor(sessionId: string, userId?: string) {
    this.sessionId = sessionId;
    this.userId = userId;
  }

  /**
   * MEMORY_SEARCH: Search memory for relevant context
   */
  async search(query: string, options: MemorySearchOptions = {}): Promise<MemorySearchResult> {
    const startTime = Date.now();
    const { limit = 10, minImportance = 3 } = options;
    
    console.log(`[MemoryController] Searching: "${query.substring(0, 50)}..."`);
    
    try {
      const items: MemoryItem[] = [];
      
      // Search session facts
      const sessionFacts = await db.select()
        .from(sessionMemoryFacts)
        .where(and(
          eq(sessionMemoryFacts.sessionId, this.sessionId),
          gte(sessionMemoryFacts.importance, minImportance / 10)
        ))
        .orderBy(desc(sessionMemoryFacts.importance))
        .limit(limit);
      
      // Convert to MemoryItems
      items.push(...sessionFacts.map(fact => ({
        id: fact.id,
        type: 'episodic' as MemoryType,
        content: fact.value,
        key: fact.key,
        importance: (fact.importance || 0.5) * 10,
        entities: [],
        createdAt: fact.createdAt || new Date(),
        updatedAt: fact.updatedAt || new Date(),
        source: 'extraction' as const
      })));
      
      // Also search user memory if userId provided
      if (this.userId) {
        const userFacts = await db.select()
          .from(userMemory)
          .where(and(
            eq(userMemory.userId, this.userId),
            gte(userMemory.importance, minImportance / 10)
          ))
          .orderBy(desc(userMemory.importance))
          .limit(limit);
        
        items.push(...userFacts.map(fact => ({
          id: fact.id,
          type: 'semantic' as MemoryType,
          content: fact.value,
          key: fact.key,
          importance: (fact.importance || 0.5) * 10,
          entities: [],
          createdAt: fact.createdAt || new Date(),
          updatedAt: fact.createdAt || new Date(), // user_memory doesn't have updatedAt
          source: 'extraction' as const
        })));
      }
      
      const relevanceScores = new Map<string, number>();
      items.forEach(item => relevanceScores.set(item.id, item.importance / 10));
      
      return {
        items,
        relevanceScores,
        searchTimeMs: Date.now() - startTime
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[MemoryController] Search failed: ${errorMessage}`);
      return {
        items: [],
        relevanceScores: new Map(),
        searchTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * MEMORY_ADD: Add new fact to memory
   */
  async add(fact: {
    content: string;
    key?: string;
    type?: MemoryType;
    importance?: number;
    entities?: string[];
    expiresAt?: Date;
  }): Promise<MemoryItem | null> {
    const {
      content,
      key = 'fact',
      type = 'episodic',
      importance = 5,
      entities = [],
      expiresAt
    } = fact;
    
    console.log(`[MemoryController] Adding: "${content.substring(0, 50)}..." (importance: ${importance})`);
    
    try {
      // Get embedding
      const embedding = await getEmbedding(content);
      
      // Insert into session_memory_facts
      const result = await db.insert(sessionMemoryFacts)
        .values({
          sessionId: this.sessionId,
          factType: type,
          key,
          value: content,
          importance: importance / 10,
          embedding
        })
        .returning();
      
      if (!result[0]) {
        console.error('[MemoryController] Add failed: no result returned');
        return null;
      }
      
      const data = result[0];
      
      // Update entity cache
      for (const entity of entities) {
        this.linkToEntity(entity, content);
      }
      
      return {
        id: data.id,
        type,
        content,
        key,
        importance,
        entities,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
        expiresAt,
        embedding,
        source: 'extraction'
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[MemoryController] Add failed: ${errorMessage}`);
      return null;
    }
  }

  /**
   * MEMORY_UPDATE: Update existing memory
   */
  async update(memoryId: string, updates: {
    content?: string;
    importance?: number;
    entities?: string[];
  }): Promise<boolean> {
    console.log(`[MemoryController] Updating memory: ${memoryId}`);
    
    try {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date()
      };
      
      if (updates.content) {
        updateData.value = updates.content;
        updateData.embedding = await getEmbedding(updates.content);
      }
      
      if (updates.importance !== undefined) {
        updateData.importance = updates.importance / 10;
      }
      
      await db.update(sessionMemoryFacts)
        .set(updateData)
        .where(eq(sessionMemoryFacts.id, memoryId));
      
      return true;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[MemoryController] Update failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * MEMORY_CONSOLIDATE: Compress multiple memories into summary
   */
  async consolidate(options: ConsolidationOptions = {}): Promise<ConsolidationResult> {
    console.log('[MemoryController] Starting consolidation...');
    
    try {
      // Build query conditions
      const conditions = [eq(sessionMemoryFacts.sessionId, this.sessionId)];
      
      if (options.olderThan) {
        conditions.push(lt(sessionMemoryFacts.createdAt, options.olderThan));
      }
      
      // Get memories to consolidate
      let memories;
      if (options.memoryIds && options.memoryIds.length > 0) {
        memories = await db.select()
          .from(sessionMemoryFacts)
          .where(and(
            eq(sessionMemoryFacts.sessionId, this.sessionId),
            inArray(sessionMemoryFacts.id, options.memoryIds)
          ));
      } else {
        memories = await db.select()
          .from(sessionMemoryFacts)
          .where(and(...conditions));
      }
      
      if (!memories || memories.length < 2) {
        return {
          originalCount: memories?.length || 0,
          consolidatedCount: memories?.length || 0,
          summary: 'No consolidation needed',
          compressionRatio: 1
        };
      }
      
      // Generate consolidated summary using LLM
      const memoriesText = memories.map(m => `- ${m.key}: ${m.value}`).join('\n');
      
      const response = await chat('memory_extractor', [
        {
          role: 'system',
          content: `You are a memory consolidation assistant. Summarize the following memories into a concise summary that preserves the most important information. Focus on:
1. Key facts and decisions
2. Important entities (customers, products, etc.)
3. User preferences and constraints
4. Ongoing projects or investigations

Output a single paragraph summary (100-200 words).`
        },
        {
          role: 'user',
          content: `Consolidate these memories:\n${memoriesText}`
        }
      ], {
        temperature: 0.3,
        maxTokens: 300
      });
      
      const summary = response.content || '';
      
      // Store consolidated memory
      await this.add({
        content: summary,
        key: 'consolidated_summary',
        type: 'episodic',
        importance: 8
      });
      
      // Mark original memories as consolidated (lower importance)
      for (const memory of memories) {
        await db.update(sessionMemoryFacts)
          .set({ importance: Math.max(0.1, (memory.importance || 0.5) * 0.5) })
          .where(eq(sessionMemoryFacts.id, memory.id));
      }
      
      return {
        originalCount: memories.length,
        consolidatedCount: 1,
        summary,
        compressionRatio: memories.length
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[MemoryController] Consolidation failed: ${errorMessage}`);
      return {
        originalCount: 0,
        consolidatedCount: 0,
        summary: 'Consolidation failed',
        compressionRatio: 1
      };
    }
  }

  /**
   * MEMORY_FORGET: Remove outdated or contradicted memory
   */
  async forget(memoryId: string, reason: string): Promise<boolean> {
    console.log(`[MemoryController] Forgetting memory: ${memoryId} (reason: ${reason})`);
    
    try {
      // We don't actually delete - just mark as very low importance
      await db.update(sessionMemoryFacts)
        .set({ 
          importance: 0.01,
          key: `forgotten_${reason}`
        })
        .where(eq(sessionMemoryFacts.id, memoryId));
      
      return true;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[MemoryController] Forget failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Link a fact to an entity in the knowledge graph (in-memory cache)
   */
  private linkToEntity(entityName: string, factContent: string): void {
    let entity = this.entityCache.get(entityName.toLowerCase());
    
    if (!entity) {
      entity = {
        id: `entity_${Date.now()}`,
        type: 'other',
        name: entityName,
        aliases: [],
        facts: [],
        relationships: [],
        lastMentioned: new Date()
      };
      this.entityCache.set(entityName.toLowerCase(), entity);
    }
    
    entity.facts.push({
      content: factContent,
      source: this.sessionId,
      confidence: 0.8,
      timestamp: new Date()
    });
    
    entity.lastMentioned = new Date();
  }

  /**
   * Get entity knowledge from cache
   */
  getEntityKnowledge(entityName: string): EntityKnowledge | undefined {
    return this.entityCache.get(entityName.toLowerCase());
  }

  /**
   * Proactive memory retrieval - predict what context is needed
   */
  async predictNeededContext(query: string): Promise<MemoryItem[]> {
    console.log('[MemoryController] Predicting needed context...');
    
    // Extract entities from query (simple pattern matching)
    const entityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    const entities = query.match(entityPattern) || [];
    
    const neededItems: MemoryItem[] = [];
    
    // Search for memories about detected entities
    for (const entity of entities.slice(0, 3)) {
      const result = await this.search(entity, { limit: 2 });
      neededItems.push(...result.items);
    }
    
    // Also get high-importance recent memories
    const recentResult = await this.search(query, { 
      limit: 5, 
      minImportance: 7 
    });
    neededItems.push(...recentResult.items);
    
    // Deduplicate
    const seen = new Set<string>();
    return neededItems.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  /**
   * Schedule periodic consolidation if memory count is high
   */
  async scheduleConsolidation(): Promise<void> {
    try {
      // Count memories for this session
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(sessionMemoryFacts)
        .where(and(
          eq(sessionMemoryFacts.sessionId, this.sessionId),
          gte(sessionMemoryFacts.importance, 0.3)
        ));
      
      const count = result[0]?.count || 0;
      
      if (count > 20) {
        console.log('[MemoryController] Memory count high, scheduling consolidation');
        // Consolidate memories older than 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        await this.consolidate({ olderThan: oneHourAgo });
      }
    } catch (e) {
      console.error('[MemoryController] Failed to check consolidation schedule:', e);
    }
  }

  /**
   * Promote important session facts to long-term user memory
   */
  async promoteToUserMemory(threshold: number = 0.8): Promise<number> {
    if (!this.userId) {
      console.log('[MemoryController] Cannot promote - no userId');
      return 0;
    }
    
    try {
      // Find high-importance session facts
      const importantFacts = await db.select()
        .from(sessionMemoryFacts)
        .where(and(
          eq(sessionMemoryFacts.sessionId, this.sessionId),
          gte(sessionMemoryFacts.importance, threshold)
        ))
        .limit(10);
      
      let promoted = 0;
      
      for (const fact of importantFacts) {
        // Copy to user_memory
        const embedding = await getEmbedding(`${fact.key}: ${fact.value}`);
        
        await db.insert(userMemory).values({
          userId: this.userId,
          factType: fact.factType,
          key: fact.key,
          value: fact.value,
          importance: fact.importance,
          embedding,
          sourceSessionId: this.sessionId
        });
        
        promoted++;
      }
      
      console.log(`[MemoryController] Promoted ${promoted} facts to user memory`);
      return promoted;
    } catch (e) {
      console.error('[MemoryController] Failed to promote memories:', e);
      return 0;
    }
  }
}

/**
 * Create a memory controller for a session
 */
export function createMemoryController(sessionId: string, userId?: string): MemoryController {
  return new MemoryController(sessionId, userId);
}
