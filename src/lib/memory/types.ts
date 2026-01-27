/**
 * Memory System Types - MemGPT-Style Multi-Tier Memory
 * 
 * Four-tier memory architecture:
 * - Tier 1: Working Context (recent turns + session summary)
 * - Tier 2: Session Memory (relevant past turns + session facts)
 * - Tier 3: Long-term Memory (user profile facts across sessions)
 * - Tier 4: Context Graph (entity links to domain knowledge graph)
 */

// ============================================================================
// Chat Message Types
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

// ============================================================================
// Memory Context (returned by getContext)
// ============================================================================

export interface MemoryContext {
  // Tier 1: Working context
  summary: string;
  recentTurns: ChatMessage[];
  
  // Tier 2: Session memory
  relevantPastTurns: ChatMessage[];
  sessionFacts: MemoryFact[];
  
  // Tier 3: Long-term memory
  userProfileFacts: MemoryFact[];
}

// ============================================================================
// Memory Facts
// ============================================================================

export type MemoryFactType = 
  | 'preference'   // User preferences (format, style, etc.)
  | 'constraint'   // Temporary constraints (e.g., "looking at Texas")
  | 'context'      // Contextual information
  | 'topic'        // Topics being discussed
  | 'expertise'    // User's areas of expertise
  | 'goal';        // User's goals or objectives

export interface MemoryFact {
  id?: string;
  type: MemoryFactType;
  key: string;
  value: string;
  importance?: number; // 0-1 scale
  source?: string;
}

// ============================================================================
// Memory Writer Output (from LLM extraction)
// ============================================================================

export interface MemoryWriterOutput {
  sessionFacts: MemoryFact[];
  userFacts: MemoryFact[];
  summary?: string;
}

// ============================================================================
// Memory Configuration (from user settings)
// ============================================================================

export type MemoryExtractionMode = 'conservative' | 'balanced' | 'aggressive';

export interface MemoryConfig {
  /** Master toggle - when false, skip all memory operations */
  memoryEnabled: boolean;
  
  /** Include ChatGPT-style user_memories in context */
  referenceSavedMemories: boolean;
  
  /** Enable semantic search of past turns and session facts */
  referenceChatHistory: boolean;
  
  /** Enable automatic memory extraction after each turn */
  autoSaveMemories: boolean;
  
  /** Control extraction aggressiveness (importance threshold) */
  memoryExtractionMode: MemoryExtractionMode;
  
  /** Limit total memories returned in context */
  maxMemoriesInContext: number;
  
  /** Include session summary_text in context */
  includeSessionSummaries: boolean;
}

/** Default memory configuration */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  memoryEnabled: true,
  referenceSavedMemories: true,
  referenceChatHistory: true,
  autoSaveMemories: false,
  memoryExtractionMode: 'balanced',
  maxMemoriesInContext: 10,
  includeSessionSummaries: false,
};

// ============================================================================
// Memory Service Input Types
// ============================================================================

export interface GetContextInput {
  sessionId: string;
  userId?: string;
  messages: ChatMessage[];
  config: MemoryConfig;
}

export interface UpdateAfterTurnInput {
  sessionId: string;
  userId?: string;
  messages: ChatMessage[];
  answer: string;
  config: MemoryConfig;
}

// ============================================================================
// Memory Controller Types
// ============================================================================

export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural';

export interface MemoryItem {
  id: string;
  type: MemoryType;
  content: string;
  key?: string;
  importance: number;  // 1-10 scale
  entities: string[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  embedding?: number[];
  source?: 'extraction' | 'consolidation' | 'user' | 'system';
}

export interface MemorySearchOptions {
  memoryType?: MemoryType;
  limit?: number;
  minImportance?: number;
  includeEntities?: boolean;
}

export interface MemorySearchResult {
  items: MemoryItem[];
  relevanceScores: Map<string, number>;
  searchTimeMs: number;
}

export interface ConsolidationOptions {
  memoryIds?: string[];
  olderThan?: Date;
  forceLevel?: number;
}

export interface ConsolidationResult {
  originalCount: number;
  consolidatedCount: number;
  summary: string;
  compressionRatio: number;
}

// ============================================================================
// Embedding Configuration
// ============================================================================

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  maxInputLength: number;
  fallbackModel?: string;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-3-large',
  dimensions: 1536,
  maxInputLength: 8000,
  fallbackModel: 'text-embedding-3-small',
};

// ============================================================================
// Importance Thresholds by Extraction Mode
// ============================================================================

export const EXTRACTION_THRESHOLDS: Record<MemoryExtractionMode, number> = {
  conservative: 0.8,  // Only highly confident, explicit facts
  balanced: 0.5,      // Clear facts with moderate confidence
  aggressive: 0.3,    // All potential facts including implicit ones
};
