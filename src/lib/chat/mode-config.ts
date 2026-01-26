/**
 * Mode Configuration
 * 
 * Defines default configurations for each chat mode and provides
 * utilities for merging user overrides with defaults.
 * 
 * All modes use GraphRAG-lite for domain agent selection - the hop count
 * determines how deeply to traverse relationships.
 */

import type { ChatMode } from './types';

// Memory tiers available
export type MemoryTier = 'tier1' | 'tier2' | 'tier3';

// Configuration for a single mode
export interface ModeConfig {
  // Retrieval settings
  maxResults: number;           // Max chunks/rows to retrieve
  useGraph: boolean;            // Use GraphRAG-lite for domain detection
  graphHops: number;            // 0=entity match only, 1-3=relationship expansion
  webResultsIfEnabled: number;  // Web results when toggle is on
  
  // Memory settings
  memoryTiers: MemoryTier[];    // Which memory tiers to use
  
  // Pipeline settings
  enableReflection: boolean;    // Run reflection agent
  enableClarification: boolean; // Run clarification (research mode)
  
  // Model settings (role names from model_configs table)
  composerRole: string;         // Which model role for composition
  
  // Display settings
  showEvaluationByDefault: boolean; // Show evaluation card in UI
}

// Default configurations for each mode
export const DEFAULT_MODE_CONFIGS: Record<Exclude<ChatMode, 'auto'>, ModeConfig> = {
  quick: {
    maxResults: 5,
    useGraph: true,
    graphHops: 0,               // Direct entity match only - fast
    webResultsIfEnabled: 3,
    memoryTiers: ['tier1'],     // Working context only
    enableReflection: false,
    enableClarification: false,
    composerRole: 'composer_fast',
    showEvaluationByDefault: false,
  },
  think: {
    maxResults: 15,
    useGraph: true,
    graphHops: 1,               // 1-hop expansion for related entities
    webResultsIfEnabled: 5,
    memoryTiers: ['tier1', 'tier2'],  // Working + session memory
    enableReflection: true,
    enableClarification: false,
    composerRole: 'composer',
    showEvaluationByDefault: true,
  },
  deep: {
    maxResults: 30,
    useGraph: true,
    graphHops: 2,               // 2-hop for deeper relationships
    webResultsIfEnabled: 10,
    memoryTiers: ['tier1', 'tier2', 'tier3'],  // All tiers
    enableReflection: true,
    enableClarification: false,
    composerRole: 'composer',
    showEvaluationByDefault: true,
  },
  research: {
    maxResults: 50,
    useGraph: true,
    graphHops: 3,               // Full graph traversal
    webResultsIfEnabled: 15,
    memoryTiers: ['tier1', 'tier2', 'tier3'],  // All tiers
    enableReflection: true,
    enableClarification: true,  // Ask clarifying questions
    composerRole: 'research',   // Uses o3-deep-research for long-form analysis
    showEvaluationByDefault: true,
  },
};

// Partial override type for user settings
export type ModeConfigOverride = Partial<ModeConfig>;

// User-configurable settings stored in database
export interface ModeSettingsOverrides {
  quick?: ModeConfigOverride;
  think?: ModeConfigOverride;
  deep?: ModeConfigOverride;
  research?: ModeConfigOverride;
}

// Memory tier configuration
export interface MemoryTierConfig {
  tier1WorkingContext: boolean;   // Always enabled
  tier2SessionMemory: boolean;    // Default: true for think/deep/research
  tier3LongTermMemory: boolean;   // Default: true for deep/research
}

// Pipeline configuration
export interface PipelineConfig {
  enableReflection: boolean;      // Default: true for think/deep/research
  enableClarification: boolean;   // Default: true for research only
  showEvaluationInChat: boolean;  // Default: true for think/deep/research
  autoModeDefault: Exclude<ChatMode, 'auto'>;  // Default: 'think'
}

// Default memory tier config
export const DEFAULT_MEMORY_TIER_CONFIG: MemoryTierConfig = {
  tier1WorkingContext: true,
  tier2SessionMemory: true,
  tier3LongTermMemory: true,
};

// Default pipeline config
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  enableReflection: true,
  enableClarification: true,
  showEvaluationInChat: true,
  autoModeDefault: 'think',
};

/**
 * Get mode configuration with user overrides merged
 * 
 * @param mode - The chat mode
 * @param userOverrides - Optional user overrides for this mode
 * @returns Complete mode configuration
 */
export function getModeConfig(
  mode: Exclude<ChatMode, 'auto'>,
  userOverrides?: ModeConfigOverride
): ModeConfig {
  const defaults = DEFAULT_MODE_CONFIGS[mode];
  
  if (!userOverrides) {
    return { ...defaults };
  }
  
  // Merge user overrides with defaults
  return {
    ...defaults,
    ...userOverrides,
    // Arrays need special handling - override completely if provided
    memoryTiers: userOverrides.memoryTiers ?? defaults.memoryTiers,
  };
}

/**
 * Get resolved mode configuration from user settings
 * 
 * @param mode - The chat mode
 * @param modeOverrides - All mode overrides from user settings
 * @param memoryConfig - Memory tier configuration
 * @param pipelineConfig - Pipeline configuration
 * @returns Complete mode configuration
 */
export function getResolvedModeConfig(
  mode: Exclude<ChatMode, 'auto'>,
  modeOverrides?: ModeSettingsOverrides,
  memoryConfig?: Partial<MemoryTierConfig>,
  pipelineConfig?: Partial<PipelineConfig>
): ModeConfig {
  // Start with mode-specific config
  let config = getModeConfig(mode, modeOverrides?.[mode]);
  
  // Apply memory tier config if provided
  if (memoryConfig) {
    const tiers: MemoryTier[] = [];
    if (memoryConfig.tier1WorkingContext !== false) tiers.push('tier1');
    if (memoryConfig.tier2SessionMemory !== false) tiers.push('tier2');
    if (memoryConfig.tier3LongTermMemory !== false) tiers.push('tier3');
    config = { ...config, memoryTiers: tiers };
  }
  
  // Apply pipeline config if provided
  if (pipelineConfig) {
    if (pipelineConfig.enableReflection !== undefined) {
      config = { ...config, enableReflection: pipelineConfig.enableReflection };
    }
    if (pipelineConfig.enableClarification !== undefined) {
      config = { ...config, enableClarification: pipelineConfig.enableClarification };
    }
    if (pipelineConfig.showEvaluationInChat !== undefined) {
      config = { ...config, showEvaluationByDefault: pipelineConfig.showEvaluationInChat };
    }
  }
  
  return config;
}

/**
 * Validate mode config values are within acceptable ranges
 */
export function validateModeConfig(config: ModeConfigOverride): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.maxResults !== undefined) {
    if (config.maxResults < 1 || config.maxResults > 100) {
      errors.push('maxResults must be between 1 and 100');
    }
  }
  
  if (config.graphHops !== undefined) {
    if (config.graphHops < 0 || config.graphHops > 5) {
      errors.push('graphHops must be between 0 and 5');
    }
  }
  
  if (config.webResultsIfEnabled !== undefined) {
    if (config.webResultsIfEnabled < 1 || config.webResultsIfEnabled > 20) {
      errors.push('webResultsIfEnabled must be between 1 and 20');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Get description of what a mode does (for UI)
 */
export function getModeDescription(mode: Exclude<ChatMode, 'auto'>): string {
  const descriptions: Record<Exclude<ChatMode, 'auto'>, string> = {
    quick: 'Fast, concise answers. Best for simple questions.',
    think: 'Balanced analysis with retrieval and reflection.',
    deep: 'Comprehensive analysis with full knowledge graph traversal.',
    research: 'In-depth research with clarifying questions and detailed reports.',
  };
  return descriptions[mode];
}
