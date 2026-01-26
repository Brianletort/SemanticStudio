/**
 * Embeddings Utility for Memory System
 * 
 * Provides embedding generation using the configured embeddings model.
 * Uses OpenAI text-embedding-3-large by default with fallback support.
 */

import { embed } from '@/lib/llm';
import { EmbeddingConfig, DEFAULT_EMBEDDING_CONFIG } from './types';

// Embedding cache to avoid redundant API calls
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate embedding for a single text string
 */
export async function getEmbedding(
  text: string,
  config: EmbeddingConfig = DEFAULT_EMBEDDING_CONFIG
): Promise<number[]> {
  // Handle non-string content (e.g., vision format arrays)
  let textContent: string;
  if (typeof text === 'string') {
    textContent = text;
  } else if (Array.isArray(text)) {
    // Extract text from vision format
    const textPart = (text as unknown[]).find((p: unknown) => 
      typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'text'
    );
    textContent = (textPart as { text?: string } | undefined)?.text || '';
  } else {
    textContent = String(text || '');
  }
  
  if (!textContent || textContent.trim().length === 0) {
    throw new Error('Empty text for embedding');
  }
  
  // Truncate to max input length
  const truncatedText = textContent.substring(0, config.maxInputLength);
  
  // Check cache
  const cacheKey = `${config.model}:${truncatedText}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.embedding;
  }
  
  try {
    // Use the LLM module's embed function which handles provider selection
    const embeddings = await embed(truncatedText);
    const embedding = embeddings[0];
    
    // Cache the result
    embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
    
    // Clean old cache entries periodically
    if (embeddingCache.size > 1000) {
      cleanEmbeddingCache();
    }
    
    return embedding;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Embeddings] Generation failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function getEmbeddings(
  texts: string[],
  config: EmbeddingConfig = DEFAULT_EMBEDDING_CONFIG
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  
  // Process texts
  const processedTexts = texts.map(text => {
    if (typeof text !== 'string') {
      return String(text || '');
    }
    return text.substring(0, config.maxInputLength);
  }).filter(t => t.trim().length > 0);
  
  if (processedTexts.length === 0) {
    return [];
  }
  
  try {
    // Use batch embed
    return await embed(processedTexts);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Embeddings] Batch generation failed: ${errorMessage}`);
    
    // Fall back to individual embedding calls
    console.log('[Embeddings] Falling back to individual embedding calls');
    const results: number[][] = [];
    for (const text of processedTexts) {
      try {
        const embedding = await getEmbedding(text, config);
        results.push(embedding);
      } catch {
        // Skip failed embeddings
        console.warn(`[Embeddings] Failed to embed text: ${text.substring(0, 50)}...`);
      }
    }
    return results;
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

/**
 * Find most similar items by embedding
 */
export function findMostSimilar<T extends { embedding?: number[] }>(
  queryEmbedding: number[],
  items: T[],
  options: {
    limit?: number;
    threshold?: number;
  } = {}
): Array<T & { similarity: number }> {
  const { limit = 5, threshold = 0.7 } = options;
  
  const scored = items
    .filter(item => item.embedding && item.embedding.length > 0)
    .map(item => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding!),
    }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
  
  return scored.slice(0, limit);
}

/**
 * Clean expired entries from the embedding cache
 */
function cleanEmbeddingCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  embeddingCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL_MS) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => embeddingCache.delete(key));
  
  console.log(`[Embeddings] Cache cleaned: removed ${keysToDelete.length} entries, ${embeddingCache.size} remaining`);
}

/**
 * Clear the embedding cache (for testing or memory management)
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Get cache statistics
 */
export function getEmbeddingCacheStats(): { size: number; oldestEntry: number | null } {
  let oldestTimestamp: number | null = null;
  
  embeddingCache.forEach(value => {
    if (oldestTimestamp === null || value.timestamp < oldestTimestamp) {
      oldestTimestamp = value.timestamp;
    }
  });
  
  return {
    size: embeddingCache.size,
    oldestEntry: oldestTimestamp,
  };
}
