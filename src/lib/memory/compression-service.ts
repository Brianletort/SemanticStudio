/**
 * Compression Service - Progressive Summarization for Chat History
 * 
 * Implements ChatGPT-style sliding window with compression:
 * - Full messages (most recent) → Compressed summaries → Session summary
 * - Token-budget-aware context assembly
 * - Automatic compression as conversations grow
 */

import { db, messages, sessions } from '@/lib/db';
import { chat } from '@/lib/llm';
import { eq, desc, asc, and, sql, ne } from 'drizzle-orm';
import { 
  countTokens, 
  countChatTokens,
  truncateToFit,
  ContextBudget, 
  DEFAULT_CONTEXT_BUDGET,
  getBudgetForMode 
} from './token-counter';
import type { ChatMessage } from './types';

/**
 * Message with compression metadata
 */
export interface CompressedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  compressionLevel: 'full' | 'compressed' | 'archived';
  compressedContent?: string;
  tokenCount: number;
  createdAt: Date;
}

/**
 * Result of context assembly
 */
export interface CompressedContext {
  /** Most recent messages, full content */
  fullMessages: ChatMessage[];
  /** Older messages, compressed */
  compressedMessages: ChatMessage[];
  /** Session summary covering oldest messages */
  summary: string;
  /** Total tokens used */
  tokensUsed: number;
  /** Breakdown by tier */
  tokenBreakdown: {
    full: number;
    compressed: number;
    summary: number;
  };
}

/**
 * Compression Service
 */
export class CompressionService {
  private llmRole: 'memory_extractor' = 'memory_extractor'; // Use the lightweight model

  /**
   * Get context with automatic compression based on budget
   */
  async getCompressedContext(
    sessionId: string,
    budget: ContextBudget = DEFAULT_CONTEXT_BUDGET
  ): Promise<CompressedContext> {
    console.log(`[CompressionService] Getting compressed context for session: ${sessionId.substring(0, 8)}`);
    
    // Get all messages for session
    const allMessages = await db.select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      compressionLevel: messages.compressionLevel,
      compressedContent: messages.compressedContent,
      tokenCount: messages.tokenCount,
      createdAt: messages.createdAt,
    })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));

    if (allMessages.length === 0) {
      return {
        fullMessages: [],
        compressedMessages: [],
        summary: '',
        tokensUsed: 0,
        tokenBreakdown: { full: 0, compressed: 0, summary: 0 },
      };
    }

    // Calculate token counts if not cached
    const messagesWithTokens = await Promise.all(
      allMessages.map(async (msg) => ({
        ...msg,
        tokenCount: msg.tokenCount ?? countTokens(msg.content),
      }))
    );

    // Assemble context within budget
    return this.assembleContextWithinBudget(messagesWithTokens, budget, sessionId);
  }

  /**
   * Assemble context within token budget using sliding window
   */
  private async assembleContextWithinBudget(
    allMessages: Array<{
      id: string;
      role: string;
      content: string;
      compressionLevel: string | null;
      compressedContent: string | null;
      tokenCount: number;
      createdAt: Date | null;
    }>,
    budget: ContextBudget,
    sessionId: string
  ): Promise<CompressedContext> {
    const fullMessages: ChatMessage[] = [];
    const compressedMessages: ChatMessage[] = [];
    let summary = '';
    
    let fullTokens = 0;
    let compressedTokens = 0;
    let summaryTokens = 0;

    // Work backwards from most recent
    const reversedMessages = [...allMessages].reverse();
    
    // Phase 1: Fill full message budget with most recent
    for (const msg of reversedMessages) {
      const tokens = msg.tokenCount;
      
      if (fullTokens + tokens <= budget.fullMessages) {
        fullMessages.unshift({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        });
        fullTokens += tokens;
      } else {
        break;
      }
    }

    // Phase 2: Fill compressed budget with older messages
    const remainingMessages = reversedMessages.slice(fullMessages.length);
    
    for (const msg of remainingMessages) {
      // Use compressed content if available, otherwise truncate
      let content = msg.compressedContent || msg.content;
      let tokens = countTokens(content);
      
      // If still too long, truncate to fit
      if (tokens > budget.compressedMessages - compressedTokens) {
        const availableBudget = budget.compressedMessages - compressedTokens;
        if (availableBudget <= 50) break; // Not enough room
        content = truncateToFit(content, availableBudget);
        tokens = countTokens(content);
      }
      
      if (compressedTokens + tokens <= budget.compressedMessages) {
        compressedMessages.unshift({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: `[${msg.role}]: ${content}`,
        });
        compressedTokens += tokens;
      } else {
        break;
      }
    }

    // Phase 3: Generate/get summary for oldest messages
    const archivedCount = remainingMessages.length - compressedMessages.length;
    if (archivedCount > 0) {
      summary = await this.getOrGenerateSummary(sessionId, budget.sessionSummary);
      summaryTokens = countTokens(summary);
    }

    const tokensUsed = fullTokens + compressedTokens + summaryTokens;
    console.log(`[CompressionService] Context assembled: ${fullMessages.length} full, ${compressedMessages.length} compressed, summary: ${summaryTokens} tokens`);
    console.log(`[CompressionService] Total tokens: ${tokensUsed} / ${budget.total}`);

    return {
      fullMessages,
      compressedMessages,
      summary,
      tokensUsed,
      tokenBreakdown: {
        full: fullTokens,
        compressed: compressedTokens,
        summary: summaryTokens,
      },
    };
  }

  /**
   * Compress a group of messages into a summary
   */
  async compressMessages(messagesToCompress: ChatMessage[]): Promise<string> {
    if (messagesToCompress.length === 0) return '';
    
    console.log(`[CompressionService] Compressing ${messagesToCompress.length} messages`);
    
    const conversationText = messagesToCompress
      .map(m => `${m.role.toUpperCase()}: ${m.content.substring(0, 500)}`)
      .join('\n\n');

    try {
      const response = await chat(this.llmRole, [
        {
          role: 'system',
          content: `You are a conversation summarizer. Compress the following conversation into a brief summary that preserves:
1. Key topics discussed
2. Important facts or decisions
3. User requests and assistant responses
4. Any constraints or preferences mentioned

Keep the summary concise (100-200 words) but informative enough to continue the conversation.`
        },
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${conversationText}`
        }
      ], {
        temperature: 0.3,
        maxTokens: 300,
      });

      return response.content || 'Conversation in progress.';
    } catch (e) {
      console.error('[CompressionService] Failed to compress messages:', e);
      // Fallback: simple extractive summary
      return messagesToCompress
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.content.substring(0, 100))
        .join(' | ');
    }
  }

  /**
   * Get or generate session summary
   */
  private async getOrGenerateSummary(sessionId: string, maxTokens: number): Promise<string> {
    // Try to get existing summary
    const session = await db.select({ summaryText: sessions.summaryText })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (session[0]?.summaryText) {
      const summary = session[0].summaryText;
      if (countTokens(summary) <= maxTokens) {
        return summary;
      }
      return truncateToFit(summary, maxTokens);
    }

    // Generate new summary from archived messages
    const archivedMessages = await db.select({
      role: messages.role,
      content: messages.content,
    })
      .from(messages)
      .where(and(
        eq(messages.sessionId, sessionId),
        eq(messages.compressionLevel, 'archived')
      ))
      .orderBy(asc(messages.createdAt))
      .limit(20);

    if (archivedMessages.length === 0) {
      return '';
    }

    const chatMessages: ChatMessage[] = archivedMessages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const summary = await this.compressMessages(chatMessages);
    
    // Save the summary
    await db.update(sessions)
      .set({ summaryText: summary })
      .where(eq(sessions.id, sessionId));

    return truncateToFit(summary, maxTokens);
  }

  /**
   * Check if session needs compression and trigger if necessary
   */
  async maybeCompress(sessionId: string, threshold: number = 20): Promise<boolean> {
    // Count full messages
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(
        eq(messages.sessionId, sessionId),
        eq(messages.compressionLevel, 'full')
      ));

    const fullCount = result[0]?.count || 0;
    
    if (fullCount <= threshold) {
      return false;
    }

    console.log(`[CompressionService] Session ${sessionId.substring(0, 8)} has ${fullCount} full messages, triggering compression`);
    await this.compressOldMessages(sessionId, threshold);
    return true;
  }

  /**
   * Compress old messages in a session
   */
  async compressOldMessages(sessionId: string, keepFullCount: number = 10): Promise<void> {
    // Get messages ordered by creation time
    const allMessages = await db.select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      compressionLevel: messages.compressionLevel,
      createdAt: messages.createdAt,
    })
      .from(messages)
      .where(and(
        eq(messages.sessionId, sessionId),
        ne(messages.compressionLevel, 'archived')
      ))
      .orderBy(desc(messages.createdAt));

    if (allMessages.length <= keepFullCount) {
      return;
    }

    // Keep most recent as full, compress the rest
    const toCompress = allMessages.slice(keepFullCount);
    
    console.log(`[CompressionService] Compressing ${toCompress.length} messages`);

    // Group messages for batch compression
    const batchSize = 6; // 3 turns
    for (let i = 0; i < toCompress.length; i += batchSize) {
      const batch = toCompress.slice(i, i + batchSize);
      
      // Generate compressed summary for batch
      const chatMessages: ChatMessage[] = batch.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
      
      const compressed = await this.compressMessages(chatMessages);
      
      // Update each message in batch
      for (const msg of batch) {
        const tokenCount = countTokens(msg.content);
        const compressedTokens = countTokens(compressed);
        
        // If compression saves tokens, use compressed; otherwise archive
        const newLevel = compressedTokens < tokenCount * 0.5 ? 'compressed' : 'archived';
        
        await db.update(messages)
          .set({
            compressionLevel: newLevel,
            compressedContent: newLevel === 'compressed' ? compressed : null,
            tokenCount,
          })
          .where(eq(messages.id, msg.id));
      }
    }

    // Update session summary with archived content
    await this.updateSessionSummary(sessionId);
  }

  /**
   * Update session summary after compression
   */
  private async updateSessionSummary(sessionId: string): Promise<void> {
    // Get all archived messages
    const archivedMessages = await db.select({
      role: messages.role,
      content: messages.content,
    })
      .from(messages)
      .where(and(
        eq(messages.sessionId, sessionId),
        eq(messages.compressionLevel, 'archived')
      ))
      .orderBy(asc(messages.createdAt))
      .limit(50);

    if (archivedMessages.length === 0) {
      return;
    }

    const chatMessages: ChatMessage[] = archivedMessages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const summary = await this.compressMessages(chatMessages);
    
    await db.update(sessions)
      .set({ summaryText: summary })
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Cache token count for a message
   */
  async cacheTokenCount(messageId: string, content: string): Promise<number> {
    const tokenCount = countTokens(content);
    
    await db.update(messages)
      .set({ tokenCount })
      .where(eq(messages.id, messageId));
    
    return tokenCount;
  }
}

/**
 * Create a new CompressionService instance
 */
export function createCompressionService(): CompressionService {
  return new CompressionService();
}

/**
 * Format compressed context for inclusion in system prompt
 */
export function formatCompressedContext(context: CompressedContext): string {
  const parts: string[] = [];

  // Add session summary first (oldest context)
  if (context.summary) {
    parts.push('## Earlier Conversation Summary');
    parts.push(context.summary);
    parts.push('');
  }

  // Add compressed messages (middle context)
  if (context.compressedMessages.length > 0) {
    parts.push('## Previous Discussion (Summarized)');
    context.compressedMessages.forEach(msg => {
      parts.push(msg.content);
    });
    parts.push('');
  }

  // Note: full messages are included as regular conversation history
  // This function just formats the compressed portions

  return parts.join('\n');
}
