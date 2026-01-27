/**
 * Token Counter - Utility for counting tokens in text
 * 
 * Uses gpt-tokenizer for accurate OpenAI-compatible token counts.
 * Includes caching to avoid redundant tokenization.
 */

import { encode, encodeChat } from 'gpt-tokenizer';

// Cache for token counts to avoid re-encoding
const tokenCountCache = new Map<string, number>();
const CACHE_MAX_SIZE = 1000;

/**
 * Count tokens in a text string
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  
  // Check cache first
  const cacheKey = text.length > 100 ? `${text.substring(0, 100)}_${text.length}` : text;
  const cached = tokenCountCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  
  // Encode and count
  const tokens = encode(text);
  const count = tokens.length;
  
  // Cache the result (with size limit)
  if (tokenCountCache.size >= CACHE_MAX_SIZE) {
    // Remove oldest entries (first 100)
    const keys = Array.from(tokenCountCache.keys()).slice(0, 100);
    keys.forEach(k => tokenCountCache.delete(k));
  }
  tokenCountCache.set(cacheKey, count);
  
  return count;
}

/**
 * Count tokens in a chat message array (more accurate for chat completions)
 */
export function countChatTokens(messages: Array<{ role: string; content: string }>): number {
  if (!messages || messages.length === 0) return 0;
  
  try {
    // Use encodeChat for accurate chat token counting
    const tokens = encodeChat(messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>);
    return tokens.length;
  } catch {
    // Fallback to simple counting if encodeChat fails
    return messages.reduce((total, msg) => total + countTokens(msg.content) + 4, 0);
  }
}

/**
 * Estimate tokens for a message (faster, less accurate)
 * Uses the rule of thumb: ~4 characters per token for English
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Configuration for context budgets
 */
export interface ContextBudget {
  /** Total tokens allowed for context (e.g., 8000) */
  total: number;
  /** Budget for full (uncompressed) messages */
  fullMessages: number;
  /** Budget for compressed message summaries */
  compressedMessages: number;
  /** Budget for session summary */
  sessionSummary: number;
  /** Reserved for system prompt, user facts, etc. */
  reserved: number;
}

/**
 * Default context budget configuration
 * Based on ~16K context window with room for response
 */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  total: 12000,
  fullMessages: 6000,      // ~50% for recent full messages
  compressedMessages: 3000, // ~25% for compressed older messages
  sessionSummary: 1500,    // ~12.5% for session summary
  reserved: 1500,          // ~12.5% for system prompt, user facts, etc.
};

/**
 * Smaller budget for fast/quick mode
 */
export const FAST_CONTEXT_BUDGET: ContextBudget = {
  total: 4000,
  fullMessages: 2500,
  compressedMessages: 500,
  sessionSummary: 500,
  reserved: 500,
};

/**
 * Larger budget for deep/research mode
 */
export const DEEP_CONTEXT_BUDGET: ContextBudget = {
  total: 24000,
  fullMessages: 10000,
  compressedMessages: 8000,
  sessionSummary: 3000,
  reserved: 3000,
};

/**
 * Get appropriate budget based on chat mode
 */
export function getBudgetForMode(mode: string): ContextBudget {
  switch (mode) {
    case 'quick':
      return FAST_CONTEXT_BUDGET;
    case 'deep':
    case 'research':
      return DEEP_CONTEXT_BUDGET;
    default:
      return DEFAULT_CONTEXT_BUDGET;
  }
}

/**
 * Check if content fits within a token budget
 */
export function fitsInBudget(content: string, budget: number): boolean {
  return countTokens(content) <= budget;
}

/**
 * Truncate text to fit within a token budget
 */
export function truncateToFit(text: string, maxTokens: number): string {
  if (!text) return '';
  
  const tokens = encode(text);
  if (tokens.length <= maxTokens) {
    return text;
  }
  
  // Binary search for the right truncation point
  let low = 0;
  let high = text.length;
  
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const truncated = text.substring(0, mid);
    if (countTokens(truncated) <= maxTokens) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  
  // Add ellipsis if truncated
  if (low < text.length) {
    return text.substring(0, Math.max(0, low - 3)) + '...';
  }
  
  return text;
}

/**
 * Clear the token count cache
 */
export function clearTokenCache(): void {
  tokenCountCache.clear();
}
