/**
 * Memory System - MemGPT-Style Multi-Tier Memory
 * 
 * A comprehensive memory system for AI assistants providing:
 * - 4-tier memory architecture (Working, Session, Long-term, Context Graph)
 * - Progressive summarization with sliding window compression
 * - Automatic memory extraction using LLM
 * - Semantic search with embeddings
 * - Memory consolidation and compression
 * - Self-editing memory operations
 * - Context Graph linking user context to domain knowledge
 */

// Types
export * from './types';

// Token counting and budget management
export {
  countTokens,
  countChatTokens,
  estimateTokens,
  truncateToFit,
  fitsInBudget,
  clearTokenCache,
  getBudgetForMode,
  DEFAULT_CONTEXT_BUDGET,
  FAST_CONTEXT_BUDGET,
  DEEP_CONTEXT_BUDGET,
} from './token-counter';
export type { ContextBudget } from './token-counter';

// Compression Service (progressive summarization)
export {
  CompressionService,
  createCompressionService,
  formatCompressedContext,
} from './compression-service';
export type { CompressedMessage, CompressedContext } from './compression-service';

// Embeddings utility
export { 
  getEmbedding, 
  getEmbeddings, 
  cosineSimilarity, 
  findMostSimilar,
  clearEmbeddingCache,
  getEmbeddingCacheStats
} from './embeddings';

// Main Memory Service
export { 
  MemoryService, 
  createMemoryService,
  formatMemoryContext 
} from './memory-service';

// Memory Controller (for advanced operations)
export { 
  MemoryController, 
  createMemoryController 
} from './memory-controller';

// Context Graph Service (bridge layer to domain KG)
export {
  ContextGraphService,
  createContextGraphService,
} from './context-graph-service';
