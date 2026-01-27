/**
 * Memory Service - MemGPT-style Multi-Tier Memory System
 * 
 * Four-tier memory architecture:
 * - Tier 1: Working Context (recent turns + session summary)
 * - Tier 2: Session Memory (relevant past turns + session facts via vector search)
 * - Tier 3: Long-term Memory (user profile facts across sessions)
 * - Tier 4: Context Graph (entity links to domain knowledge graph)
 * 
 * Features progressive summarization with sliding window compression.
 */

import { db, pgPool, sessions, messages, sessionMemoryFacts, userMemory, userMemories } from '@/lib/db';
import { chat } from '@/lib/llm';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getEmbedding } from './embeddings';
import { CompressionService, formatCompressedContext } from './compression-service';
import { ContextGraphService } from './context-graph-service';
import { getBudgetForMode } from './token-counter';
import {
  MemoryContext,
  MemoryFact,
  MemoryConfig,
  MemoryWriterOutput,
  ChatMessage,
  GetContextInput,
  UpdateAfterTurnInput,
  DEFAULT_MEMORY_CONFIG,
  EXTRACTION_THRESHOLDS,
} from './types';

/**
 * Memory Service - Main class for MemGPT-style memory operations
 */
export class MemoryService {
  /**
   * Get memory context for the current conversation
   */
  async getContext(input: GetContextInput): Promise<MemoryContext> {
    const { sessionId, userId, messages: inputMessages, config } = input;
    
    // If memory is disabled, return minimal context
    if (!config.memoryEnabled) {
      return this.getMinimalContext(inputMessages);
    }

    try {
      console.log(`[MemoryService] Getting context for session: ${sessionId.substring(0, 8)}, userId: ${userId?.substring(0, 8) || 'none'}`);
      console.log(`[MemoryService] Messages passed: ${inputMessages.length} messages`);
      
      // Tier 1: Working context
      const recentTurns = inputMessages.slice(-6); // Last 3 turns (user+assistant pairs)
      const summary = config.includeSessionSummaries 
        ? await this.getOrGenerateSummary(sessionId, inputMessages)
        : 'Session summary disabled.';
      console.log(`[MemoryService] Working context: ${recentTurns.length} recent turns`);

      // Tier 2: Session memory - only if referenceChatHistory is enabled
      let relevantPastTurns: ChatMessage[] = [];
      let sessionFacts: MemoryFact[] = [];
      
      if (config.referenceChatHistory) {
        const sessionMemory = await this.getSessionMemory(sessionId, inputMessages, config);
        relevantPastTurns = sessionMemory.relevantPastTurns;
        sessionFacts = sessionMemory.sessionFacts.slice(0, config.maxMemoriesInContext);
        console.log(`[MemoryService] Session memory: ${relevantPastTurns.length} past turns, ${sessionFacts.length} session facts`);
      }

      // Tier 3: Long-term memory
      let userProfileFacts: MemoryFact[] = [];
      
      if (userId) {
        // Get system-extracted user facts
        if (config.referenceChatHistory) {
          const userFacts = await this.getUserMemory(userId, inputMessages, config);
          userProfileFacts.push(...userFacts);
        }
        
        // Get ChatGPT-style saved memories (user_memories table)
        if (config.referenceSavedMemories) {
          const savedMemories = await this.getSavedMemories(userId, config);
          userProfileFacts.push(...savedMemories);
        }
        
        // Apply limit
        userProfileFacts = userProfileFacts.slice(0, config.maxMemoriesInContext);
        console.log(`[MemoryService] User memory: ${userProfileFacts.length} user facts`);
      }

      return {
        summary,
        recentTurns,
        relevantPastTurns,
        sessionFacts,
        userProfileFacts
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[MemoryService] Failed to get memory context: ${errorMessage}`);

      // Return minimal context on error
      return {
        summary: 'No previous context available.',
        recentTurns: inputMessages.slice(-6),
        relevantPastTurns: [],
        sessionFacts: [],
        userProfileFacts: []
      };
    }
  }

  /**
   * Update memory after a conversation turn
   */
  async updateAfterTurn(input: UpdateAfterTurnInput): Promise<{ sessionFactsSaved: number; userFactsSaved: number; summaryUpdated: boolean } | null> {
    const { sessionId, userId, messages: inputMessages, answer, config } = input;

    // If memory or autoSave is disabled, skip
    if (!config.memoryEnabled || !config.autoSaveMemories) {
      console.log('[MemoryService] Memory update skipped (disabled or autoSave off)');
      return null;
    }

    try {
      console.log('[MemoryService] Updating memory after turn');
      
      // Extract memories from this turn
      const writerOutput = await this.extractMemories(
        inputMessages[inputMessages.length - 1],
        answer,
        config.memoryExtractionMode
      );

      // Filter by importance threshold based on extraction mode
      const threshold = EXTRACTION_THRESHOLDS[config.memoryExtractionMode];
      const filteredSessionFacts = writerOutput.sessionFacts.filter(
        f => (f.importance || 0.5) >= threshold
      );
      const filteredUserFacts = writerOutput.userFacts.filter(
        f => (f.importance || 0.5) >= threshold
      );

      console.log(`[MemoryService] Extracted ${writerOutput.sessionFacts.length} session facts, ${filteredSessionFacts.length} passed threshold`);
      console.log(`[MemoryService] Extracted ${writerOutput.userFacts.length} user facts, ${filteredUserFacts.length} passed threshold`);

      // Save session facts
      const savedFactIds: string[] = [];
      if (filteredSessionFacts.length > 0) {
        const ids = await this.saveSessionFacts(sessionId, filteredSessionFacts);
        savedFactIds.push(...ids);
        console.log(`[MemoryService] Saved ${filteredSessionFacts.length} session facts`);
      }

      // Save user facts (if userId provided)
      if (userId && filteredUserFacts.length > 0) {
        await this.saveUserFacts(userId, sessionId, filteredUserFacts);
        console.log(`[MemoryService] Saved ${filteredUserFacts.length} user facts`);
      }

      // Update session summary if needed
      if (config.includeSessionSummaries && (inputMessages.length % 4 === 0 || writerOutput.summary)) {
        await this.updateSessionSummary(sessionId, inputMessages, writerOutput.summary);
      }

      // Tier 4: Auto-link entities to knowledge graph (bridge layer)
      if (userId) {
        try {
          const contextGraph = new ContextGraphService(userId);
          const userMessage = inputMessages[inputMessages.length - 1];
          
          // Link entities from user query and assistant response
          await contextGraph.autoLinkEntities({
            text: userMessage.content,
            sessionId,
            refType: 'queried',
          });
          
          await contextGraph.autoLinkEntities({
            text: answer.substring(0, 1000), // Limit to avoid over-linking
            sessionId,
            refType: 'discussed',
          });

          // Link saved facts to entities
          for (const factId of savedFactIds) {
            const fact = filteredSessionFacts.find(f => f.id === factId);
            if (fact) {
              await contextGraph.autoLinkEntities({
                text: `${fact.key}: ${fact.value}`,
                sessionId,
                refType: 'mentioned',
                memoryFactId: factId,
              });
            }
          }
        } catch (e) {
          console.warn('[MemoryService] Entity linking failed (non-critical):', e);
        }
      }

      // Progressive summarization: check if compression is needed
      let summaryUpdated = false;
      try {
        const compressionService = new CompressionService();
        await compressionService.maybeCompress(sessionId, 20);
        summaryUpdated = true;
      } catch (e) {
        console.warn('[MemoryService] Compression check failed (non-critical):', e);
      }

      // Return the counts so the caller can emit events
      return {
        sessionFactsSaved: filteredSessionFacts.length,
        userFactsSaved: filteredUserFacts.length,
        summaryUpdated,
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[MemoryService] Failed to update memory: ${errorMessage}`);
      return null;
    }
  }

  // ============================================================================
  // Tier 1: Working Context
  // ============================================================================

  private async getOrGenerateSummary(
    sessionId: string,
    inputMessages: ChatMessage[]
  ): Promise<string> {
    try {
      // Try to get existing summary
      const result = await db.select({ summaryText: sessions.summaryText })
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (result[0]?.summaryText) {
        return result[0].summaryText;
      }

      // Generate new summary if none exists and we have enough messages
      if (inputMessages.length >= 4) {
        return this.generateSummary(inputMessages);
      }

      return 'New conversation.';
    } catch (e) {
      console.error('[MemoryService] Failed to get summary:', e);
      return 'Conversation in progress.';
    }
  }

  private generateSummary(inputMessages: ChatMessage[]): string {
    // Simple extractive summary from recent messages
    const userMessages = inputMessages
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.content.substring(0, 100));

    if (userMessages.length === 0) return 'New conversation.';

    const topics = this.extractTopics(userMessages);
    return topics.length > 0 ? `Discussing: ${topics.join(', ')}` : 'New conversation.';
  }

  private extractTopics(messageTexts: string[]): string[] {
    const allText = messageTexts.join(' ').toLowerCase();
    const topics: string[] = [];

    // Generic topic keywords for business/data analysis
    const topicKeywords: Record<string, string[]> = {
      'customers': ['customer', 'client', 'account', 'segment'],
      'sales': ['sales', 'revenue', 'pipeline', 'opportunity', 'deal'],
      'products': ['product', 'inventory', 'stock', 'catalog'],
      'finance': ['finance', 'budget', 'expense', 'profit', 'loss'],
      'analytics': ['analyze', 'analysis', 'report', 'metrics', 'kpi'],
      'support': ['ticket', 'support', 'issue', 'help'],
      'employees': ['employee', 'staff', 'hr', 'department'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => allText.includes(kw))) {
        topics.push(topic);
      }
    }

    return topics.slice(0, 3);
  }

  // ============================================================================
  // Tier 2: Session Memory
  // ============================================================================

  private async getSessionMemory(
    sessionId: string,
    inputMessages: ChatMessage[],
    config: MemoryConfig
  ): Promise<{ relevantPastTurns: ChatMessage[]; sessionFacts: MemoryFact[] }> {
    try {
      const lastUserMessage = inputMessages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        return { relevantPastTurns: [], sessionFacts: [] };
      }

      let relevantPastTurns: ChatMessage[] = [];
      let sessionFacts: MemoryFact[] = [];

      // Try vector search first
      try {
        const queryEmbedding = await getEmbedding(lastUserMessage.content);
        
        // Search similar past messages via RPC
        const similarMessages = await db.execute(sql`
          SELECT role, content, created_at
          FROM messages
          WHERE session_id = ${sessionId}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > 0.7
          ORDER BY 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) DESC
          LIMIT 3
        `);

        if (similarMessages.rows && similarMessages.rows.length > 0) {
          relevantPastTurns = similarMessages.rows.map((m: Record<string, unknown>) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: (m.content as string).substring(0, 500),
            timestamp: m.created_at as string
          }));
        }
      } catch (vectorError) {
        console.log('[MemoryService] Vector search unavailable, using direct query fallback');
      }

      // FALLBACK: If vector search failed, load past messages directly
      if (relevantPastTurns.length === 0) {
        try {
          const pastMessages = await db.select({
            role: messages.role,
            content: messages.content,
            metadata: messages.metadata,
            createdAt: messages.createdAt
          })
            .from(messages)
            .where(eq(messages.sessionId, sessionId))
            .orderBy(desc(messages.createdAt))
            .limit(20);
          
          if (pastMessages.length > 0) {
            // Filter out current query
            const currentQuery = lastUserMessage.content.substring(0, 100);
            const filteredMessages = pastMessages.filter(m => 
              m.content.substring(0, 100) !== currentQuery
            );
            
            // Take older messages (skip working context)
            relevantPastTurns = filteredMessages
              .slice(6) // Skip most recent 6 (already in working context)
              .reverse() // Restore chronological order
              .slice(0, 6) // Get up to 6 older messages
              .map(m => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: this.enhanceContentWithMetadata(m.content.substring(0, 500), m.metadata),
                timestamp: m.createdAt?.toISOString()
              }));
            
            // For short conversations, use recent ones
            if (relevantPastTurns.length === 0 && filteredMessages.length > 0) {
              relevantPastTurns = filteredMessages
                .reverse()
                .slice(0, 4)
                .map(m => ({
                  role: m.role as 'user' | 'assistant' | 'system',
                  content: this.enhanceContentWithMetadata(m.content.substring(0, 500), m.metadata),
                  timestamp: m.createdAt?.toISOString()
                }));
            }
            
            console.log(`[MemoryService] Loaded ${relevantPastTurns.length} past turns via direct query`);
          }
        } catch (fallbackError) {
          console.error('[MemoryService] Direct query fallback failed:', fallbackError);
        }
      }

      // Try to get session facts via vector search
      try {
        const queryEmbedding = await getEmbedding(lastUserMessage.content);
        
        const facts = await db.execute(sql`
          SELECT id, fact_type, key, value, importance
          FROM session_memory_facts
          WHERE session_id = ${sessionId}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > 0.7
          ORDER BY 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) DESC
          LIMIT 5
        `);

        if (facts.rows && facts.rows.length > 0) {
          sessionFacts = facts.rows.map((f: Record<string, unknown>) => ({
            id: f.id as string,
            type: f.fact_type as MemoryFact['type'],
            key: f.key as string,
            value: f.value as string,
            importance: f.importance as number
          }));
        }
      } catch (factsError) {
        console.log('[MemoryService] Session facts vector search unavailable');
      }

      // FALLBACK: Direct query for session facts
      if (sessionFacts.length === 0) {
        try {
          const directFacts = await db.select({
            id: sessionMemoryFacts.id,
            factType: sessionMemoryFacts.factType,
            key: sessionMemoryFacts.key,
            value: sessionMemoryFacts.value,
            importance: sessionMemoryFacts.importance
          })
            .from(sessionMemoryFacts)
            .where(eq(sessionMemoryFacts.sessionId, sessionId))
            .orderBy(desc(sessionMemoryFacts.importance))
            .limit(5);
          
          if (directFacts.length > 0) {
            sessionFacts = directFacts.map(f => ({
              id: f.id,
              type: f.factType as MemoryFact['type'],
              key: f.key,
              value: f.value,
              importance: f.importance || 0.5
            }));
            console.log(`[MemoryService] Loaded ${sessionFacts.length} session facts via direct query`);
          }
        } catch (fallbackError) {
          console.log('[MemoryService] session_memory_facts query failed');
        }
      }

      return { relevantPastTurns, sessionFacts };
    } catch (e) {
      console.error('[MemoryService] Failed to get session memory:', e);
      return { relevantPastTurns: [], sessionFacts: [] };
    }
  }

  private enhanceContentWithMetadata(content: string, metadata: unknown): string {
    if (!metadata || typeof metadata !== 'object') return content;
    
    const meta = metadata as Record<string, unknown>;
    let enhanced = content;
    
    // Add generated images context
    if (Array.isArray(meta.generatedImages) && meta.generatedImages.length > 0) {
      const imagePrompts = meta.generatedImages.map((img: Record<string, unknown>) => img.prompt).join(', ');
      enhanced += ` [GENERATED IMAGE(S): ${imagePrompts}]`;
    }
    
    // Add tool calls context
    if (Array.isArray(meta.toolCalls) && meta.toolCalls.length > 0) {
      const tools = meta.toolCalls.map((t: Record<string, unknown>) => t.toolName).join(', ');
      enhanced += ` [TOOLS USED: ${tools}]`;
    }
    
    // Add sources context
    if (Array.isArray(meta.sourcesUsed) && meta.sourcesUsed.length > 0) {
      const domains = [...new Set(meta.sourcesUsed.map((s: Record<string, unknown>) => s.domain))].join(', ');
      enhanced += ` [DATA SOURCES: ${domains}]`;
    }
    
    return enhanced;
  }

  // ============================================================================
  // Tier 3: Long-term User Memory
  // ============================================================================

  private async getUserMemory(
    userId: string,
    inputMessages: ChatMessage[],
    config: MemoryConfig
  ): Promise<MemoryFact[]> {
    try {
      const lastUserMessage = inputMessages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) return [];

      let userFacts: MemoryFact[] = [];

      // Try vector search first
      try {
        const queryEmbedding = await getEmbedding(lastUserMessage.content);

        const memories = await db.execute(sql`
          SELECT id, fact_type, key, value, importance
          FROM user_memory
          WHERE user_id = ${userId}
            AND embedding IS NOT NULL
            AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > 0.7
          ORDER BY 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) DESC
          LIMIT 5
        `);

        if (memories.rows && memories.rows.length > 0) {
          userFacts = memories.rows.map((m: Record<string, unknown>) => ({
            id: m.id as string,
            type: m.fact_type as MemoryFact['type'],
            key: m.key as string,
            value: m.value as string,
            importance: m.importance as number
          }));
        }
      } catch (vectorError) {
        console.log('[MemoryService] User memory vector search unavailable');
      }

      // FALLBACK: Direct query
      if (userFacts.length === 0) {
        try {
          const directMemories = await db.select({
            id: userMemory.id,
            factType: userMemory.factType,
            key: userMemory.key,
            value: userMemory.value,
            importance: userMemory.importance
          })
            .from(userMemory)
            .where(eq(userMemory.userId, userId))
            .orderBy(desc(userMemory.importance))
            .limit(5);
          
          if (directMemories.length > 0) {
            userFacts = directMemories.map(m => ({
              id: m.id,
              type: m.factType as MemoryFact['type'],
              key: m.key,
              value: m.value,
              importance: m.importance || 0.5
            }));
            console.log(`[MemoryService] Loaded ${userFacts.length} user facts via direct query`);
          }
        } catch (fallbackError) {
          console.log('[MemoryService] user_memory query failed');
        }
      }

      return userFacts;
    } catch (e) {
      console.error('[MemoryService] Failed to get user memory:', e);
      return [];
    }
  }

  /**
   * Get ChatGPT-style saved memories from user_memories table
   */
  private async getSavedMemories(userId: string, config: MemoryConfig): Promise<MemoryFact[]> {
    try {
      const savedMemories = await db.select({
        id: userMemories.id,
        content: userMemories.content,
        source: userMemories.source
      })
        .from(userMemories)
        .where(and(
          eq(userMemories.userId, userId),
          eq(userMemories.isActive, true)
        ))
        .limit(config.maxMemoriesInContext);
      
      return savedMemories.map(m => ({
        id: m.id,
        type: 'preference' as const,
        key: 'saved_memory',
        value: m.content,
        importance: 0.8, // Saved memories are high importance
        source: m.source || 'user'
      }));
    } catch (e) {
      console.error('[MemoryService] Failed to get saved memories:', e);
      return [];
    }
  }

  // ============================================================================
  // Memory Writer (LLM-based)
  // ============================================================================

  private async extractMemories(
    userMessage: ChatMessage,
    answer: string,
    extractionMode: MemoryConfig['memoryExtractionMode']
  ): Promise<MemoryWriterOutput> {
    try {
      const prompt = `You are a memory extraction system. Analyze this conversation turn and extract any facts worth remembering.

USER QUESTION:
${userMessage.content}

ASSISTANT ANSWER:
${answer.substring(0, 1000)}

Extract memories into these categories:

1. SESSION FACTS (temporary, for this conversation only):
   - Constraints mentioned (e.g., "looking at Texas counties")
   - Specific topics being discussed
   - Contextual preferences

2. USER FACTS (long-term, across all conversations):
   - Persistent preferences (e.g., "prefers data in tables")
   - Expertise areas
   - Goals or use cases
   - Must-have or never conditions

Extraction mode: ${extractionMode}
${extractionMode === 'conservative' ? 'Only extract highly confident, explicit facts.' : ''}
${extractionMode === 'balanced' ? 'Extract clear facts with moderate confidence.' : ''}
${extractionMode === 'aggressive' ? 'Extract all potential facts including implicit ones.' : ''}

Only extract clear, specific facts. Don't extract vague or generic statements.

Respond with ONLY valid JSON (no markdown):
{
  "sessionFacts": [
    { "type": "constraint", "key": "region", "value": "Texas", "importance": 0.8 }
  ],
  "userFacts": [
    { "type": "preference", "key": "format", "value": "prefers tables over text", "importance": 0.7 }
  ]
}`;

      console.log('[MemoryService] Starting LLM extraction call...');
      
      // Use memory_extractor role for efficient extraction
      let response;
      try {
        response = await chat('memory_extractor', [
          {
            role: 'system',
            content: 'You are a memory extraction system. Extract facts and respond ONLY with valid JSON in this format: {"sessionFacts": [{"key": "name", "value": "John", "importance": 0.8}], "userFacts": []}'
          },
          {
            role: 'user',
            content: prompt
          }
        ], {
          temperature: 0.2,
          maxTokens: 500,
        });
      } catch (llmError) {
        console.error('[MemoryService] LLM extraction call failed:', llmError);
        return { sessionFacts: [], userFacts: [] };
      }

      console.log('[MemoryService] LLM response content:', response.content?.substring(0, 200));

      // Parse response
      let content = response.content || '{}';
      
      // Handle different response formats
      if (typeof content !== 'string') {
        console.warn('[MemoryService] Non-string response, using fallback');
        content = '{"sessionFacts": [], "userFacts": []}';
      }
      
      let result;
      try {
        result = JSON.parse(content);
        console.log('[MemoryService] Successfully parsed extraction JSON');
      } catch (parseError) {
        console.error('[MemoryService] JSON parse failed, content:', content);
        result = { sessionFacts: [], userFacts: [] };
      }

      return {
        sessionFacts: result.sessionFacts || [],
        userFacts: result.userFacts || [],
        summary: result.summary
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`[MemoryService] Memory extraction failed: ${errorMessage}`);
      return { sessionFacts: [], userFacts: [] };
    }
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private async saveSessionFacts(sessionId: string, facts: MemoryFact[]): Promise<string[]> {
    const savedIds: string[] = [];
    
    for (const fact of facts) {
      const factId = crypto.randomUUID();
      
      try {
        const importance = fact.importance || 0.5;
        
        // Insert fact first (pgPool handles proper async/await)
        await pgPool.query(
          `INSERT INTO session_memory_facts (id, session_id, fact_type, key, value, importance)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
          [factId, sessionId, fact.type || 'preference', fact.key, fact.value, importance]
        );
        
        // Generate and update embedding (separate query to avoid vector param issues)
        try {
          const embedding = await getEmbedding(`${fact.key}: ${fact.value}`);
          const embeddingStr = `[${embedding.join(',')}]`;
          await pgPool.query(
            `UPDATE session_memory_facts SET embedding = $1::vector WHERE id = $2::uuid`,
            [embeddingStr, factId]
          );
        } catch (embErr) {
          console.warn(`[MemoryService] Embedding update failed for ${fact.key}`);
        }
        
        savedIds.push(factId);
        fact.id = factId;
      } catch (e) {
        console.error(`[MemoryService] Failed to save session fact ${fact.key}:`, e);
      }
    }
    
    return savedIds;
  }

  private async saveUserFacts(
    userId: string,
    sessionId: string,
    facts: MemoryFact[]
  ): Promise<void> {
    for (const fact of facts) {
      const factId = crypto.randomUUID();
      
      try {
        const importance = fact.importance || 0.5;
        
        // Insert fact (pgPool handles proper async/await)
        await pgPool.query(
          `INSERT INTO user_memory (id, user_id, fact_type, key, value, importance, source_session_id)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid)`,
          [factId, userId, fact.type || 'preference', fact.key, fact.value, importance, sessionId]
        );
        
        // Generate and update embedding
        try {
          const embedding = await getEmbedding(`${fact.key}: ${fact.value}`);
          const embeddingStr = `[${embedding.join(',')}]`;
          await pgPool.query(
            `UPDATE user_memory SET embedding = $1::vector WHERE id = $2::uuid`,
            [embeddingStr, factId]
          );
        } catch (embErr) {
          console.warn(`[MemoryService] User fact embedding update failed for ${fact.key}`);
        }
        
        fact.id = factId;
      } catch (e) {
        console.error(`[MemoryService] Failed to save user fact ${fact.key}:`, e);
      }
    }
  }

  private async updateSessionSummary(
    sessionId: string,
    inputMessages: ChatMessage[],
    newSummary?: string
  ): Promise<void> {
    try {
      const summary = newSummary || this.generateSummary(inputMessages);
      const embedding = await getEmbedding(summary);

      await db.update(sessions)
        .set({
          summaryText: summary,
          summaryEmbedding: embedding,
          updatedAt: new Date()
        })
        .where(eq(sessions.id, sessionId));
    } catch (e) {
      console.error('[MemoryService] Failed to update summary:', e);
    }
  }

  // ============================================================================
  // Minimal Context (for disabled memory or fast mode)
  // ============================================================================

  /**
   * Get minimal memory context - NO DB calls, NO embeddings
   * Used when memory is disabled or for fast mode
   */
  getMinimalContext(inputMessages: ChatMessage[]): MemoryContext {
    console.log(`[MemoryService] Using minimal context (${inputMessages.length} messages)`);
    
    // Extract topics from recent messages using simple heuristics
    const recentUserMessages = inputMessages
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.content.substring(0, 100));
    
    const topics = this.extractTopics(recentUserMessages);
    const summary = topics.length > 0 
      ? `Recent discussion: ${topics.join(', ')}` 
      : 'New conversation';
    
    return {
      summary,
      recentTurns: inputMessages.slice(-4), // Last 2 turns
      relevantPastTurns: [],
      sessionFacts: [],
      userProfileFacts: []
    };
  }
}

/**
 * Format memory context for inclusion in system prompt
 */
export function formatMemoryContext(context: MemoryContext): string {
  const parts: string[] = [];
  
  // Session summary
  if (context.summary && context.summary !== 'New conversation.') {
    parts.push(`## Conversation Context\n${context.summary}`);
  }
  
  // Session facts
  if (context.sessionFacts.length > 0) {
    parts.push('\n## Session Context');
    context.sessionFacts.forEach(f => {
      parts.push(`- ${f.key}: ${f.value}`);
    });
  }
  
  // User profile facts
  if (context.userProfileFacts.length > 0) {
    parts.push('\n## Things to Remember About This User');
    context.userProfileFacts.forEach(f => {
      parts.push(`- ${f.value}`);
    });
  }
  
  // Relevant past context (abbreviated)
  if (context.relevantPastTurns.length > 0) {
    parts.push('\n## Earlier in This Conversation');
    context.relevantPastTurns.slice(0, 4).forEach(turn => {
      const role = turn.role === 'user' ? 'User' : 'Assistant';
      const content = turn.content.substring(0, 200);
      parts.push(`${role}: ${content}${turn.content.length > 200 ? '...' : ''}`);
    });
  }
  
  return parts.join('\n');
}

/**
 * Create a new MemoryService instance
 */
export function createMemoryService(): MemoryService {
  return new MemoryService();
}
