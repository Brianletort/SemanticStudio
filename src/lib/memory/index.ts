/**
 * Memory System - MemGPT-Style Multi-Tier Memory
 * 
 * A comprehensive memory system for AI assistants providing:
 * - 3-tier memory architecture (Working, Session, Long-term)
 * - Automatic memory extraction using LLM
 * - Semantic search with embeddings
 * - Memory consolidation and compression
 * - Self-editing memory operations
 */

// Types
export * from './types';

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
