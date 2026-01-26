/**
 * Chat system exports
 * 
 * Auto mode detection, event tracking, and response evaluation
 */

// Types
export * from './types';

// Mode configuration
export {
  DEFAULT_MODE_CONFIGS,
  DEFAULT_MEMORY_TIER_CONFIG,
  DEFAULT_PIPELINE_CONFIG,
  getModeConfig,
  getResolvedModeConfig,
  validateModeConfig,
  getModeDescription,
  type ModeConfig,
  type ModeConfigOverride,
  type ModeSettingsOverrides,
  type MemoryTier,
  type MemoryTierConfig,
  type PipelineConfig,
} from './mode-config';

// Mode classification
export { 
  classifyQueryMode, 
  quickClassify,
  isAutoModeEnabled 
} from './mode-classifier';

// Event bus
export { 
  AgentEventBus, 
  createEventBus 
} from './event-bus';

// Evaluation
export { 
  calculateDeterministicMetrics,
  calculateCitationCoverage,
  calculateContextUtilization,
  calculateChunkSimilarity,
  calculateContextDiversity,
  extractCitations,
  calculateTokenMetrics
} from './deterministic-eval';

export { 
  evaluateWithLLMJudge,
  calculateQualityScore 
} from './llm-judge';

export { 
  evaluateAndSaveResponse 
} from './evaluation-service';

// Image detection
export {
  detectImageRequest,
  extractImagePrompt
} from './image-detection';

// Orchestrator
export {
  OrchestratorAgent,
  createOrchestrator,
  type OrchestratorInput,
  type OrchestratorOutput,
  type PipelineStep,
  type PipelineContext,
} from './orchestrator';

// Clarification agent
export {
  ClarificationAgent,
  createClarificationAgent,
  type ClarificationQuestion,
  type ClarificationResult,
} from './clarification-agent';
