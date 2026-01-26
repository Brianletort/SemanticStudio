/**
 * Chat system types for auto mode, events, and evaluation
 */

// Chat modes
export type ChatMode = 'auto' | 'quick' | 'think' | 'deep' | 'research';

// Mode classification result
export interface ModeClassification {
  recommendedMode: Exclude<ChatMode, 'auto'>;
  confidence: number;
  reasoning: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDomains: string[];
}

// ============================================
// AGENT EVENT TYPES (15+ comprehensive events)
// ============================================

export type AgentEventType = 
  // Core agent lifecycle
  | 'agent_started'
  | 'agent_progress'
  | 'agent_finished'
  // Mode and orchestration
  | 'mode_classified'
  | 'mode_selected'
  | 'pipeline_started'
  | 'pipeline_complete'
  // Retrieval and domain agents
  | 'retrieval_started'
  | 'retrieval_complete'
  | 'domain_agent_started'
  | 'domain_agent_complete'
  // Graph traversal
  | 'graph_traversal_started'
  | 'graph_traversal_complete'
  // Web search
  | 'web_search_started'
  | 'web_search_complete'
  // Memory operations
  | 'memory_retrieved'
  | 'memory_saved'
  // Research mode specific
  | 'clarification_requested'
  | 'clarification_answered'
  | 'research_job_created'
  | 'research_progress'
  | 'research_source_found'
  | 'research_complete'
  // Content generation
  | 'image_generated'
  | 'image_edited'
  | 'document_processed'
  // Quality and evaluation
  | 'reflection_started'
  | 'reflection_complete'
  | 'judge_evaluation'
  // Sources and context
  | 'source_used'
  | 'context_built'
  // General logging
  | 'log'
  // Task agent orchestration
  | 'task_requested'
  | 'task_routed'
  | 'task_pending_approval'
  | 'task_approved'
  | 'task_rejected'
  | 'task_executing'
  | 'task_result'
  | 'task_failed';

// Base agent event
interface BaseAgentEvent {
  runId: string;
  sessionId?: string;  // Optional session ID for historical trace retrieval
  turnId?: string;     // Links events to specific response for per-turn trace retrieval
  timestamp?: number;
}

// ============================================
// CORE AGENT LIFECYCLE EVENTS
// ============================================

export interface AgentStartedEvent extends BaseAgentEvent {
  type: 'agent_started';
  agentId: string;
  label?: string;
}

export interface AgentProgressEvent extends BaseAgentEvent {
  type: 'agent_progress';
  agentId: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface AgentFinishedEvent extends BaseAgentEvent {
  type: 'agent_finished';
  agentId: string;
  summary?: string;
  data?: Record<string, unknown>;
}

// ============================================
// MODE AND ORCHESTRATION EVENTS
// ============================================

export interface ModeClassifiedEvent extends BaseAgentEvent {
  type: 'mode_classified';
  classification: ModeClassification;
}

export interface ModeSelectedEvent extends BaseAgentEvent {
  type: 'mode_selected';
  mode: Exclude<ChatMode, 'auto'>;
  source: 'user' | 'auto' | 'default';
}

export interface PipelineStartedEvent extends BaseAgentEvent {
  type: 'pipeline_started';
  mode: Exclude<ChatMode, 'auto'>;
  steps: string[];
}

export interface PipelineCompleteEvent extends BaseAgentEvent {
  type: 'pipeline_complete';
  mode: Exclude<ChatMode, 'auto'>;
  durationMs: number;
  stepsCompleted: number;
}

// ============================================
// RETRIEVAL AND DOMAIN AGENT EVENTS
// ============================================

export interface RetrievalStartedEvent extends BaseAgentEvent {
  type: 'retrieval_started';
  domains: string[];
}

export interface RetrievalCompleteEvent extends BaseAgentEvent {
  type: 'retrieval_complete';
  domains: string[];
  resultsCount: number;
  durationMs: number;
}

export interface DomainAgentStartedEvent extends BaseAgentEvent {
  type: 'domain_agent_started';
  agentId: string;
  domain: string;
  query?: string;
}

export interface DomainAgentCompleteEvent extends BaseAgentEvent {
  type: 'domain_agent_complete';
  agentId: string;
  domain: string;
  resultsCount: number;
  durationMs: number;
}

// ============================================
// GRAPH TRAVERSAL EVENTS
// ============================================

export interface GraphTraversalStartedEvent extends BaseAgentEvent {
  type: 'graph_traversal_started';
  hops: number;
  startEntities: string[];
}

export interface GraphTraversalCompleteEvent extends BaseAgentEvent {
  type: 'graph_traversal_complete';
  hops: number;
  nodesVisited: number;
  relationshipsFound: number;
  durationMs: number;
}

// ============================================
// WEB SEARCH EVENTS
// ============================================

export interface WebSearchStartedEvent extends BaseAgentEvent {
  type: 'web_search_started';
  query: string;
  maxResults: number;
}

export interface WebSearchCompleteEvent extends BaseAgentEvent {
  type: 'web_search_complete';
  resultsCount: number;
  urls?: string[];
  durationMs: number;
}

// ============================================
// MEMORY EVENTS
// ============================================

export interface MemoryRetrievedEvent extends BaseAgentEvent {
  type: 'memory_retrieved';
  tiersUsed: string[];
  factsCount: number;
  hasSummary: boolean;
}

export interface MemorySavedEvent extends BaseAgentEvent {
  type: 'memory_saved';
  sessionFactsCount: number;
  userFactsCount: number;
  summaryUpdated: boolean;
}

// ============================================
// RESEARCH MODE EVENTS
// ============================================

export interface ClarificationRequestedEvent extends BaseAgentEvent {
  type: 'clarification_requested';
  questionCount: number;
  originalQuery: string;
}

export interface ClarificationAnsweredEvent extends BaseAgentEvent {
  type: 'clarification_answered';
  answersCount: number;
}

export interface ResearchJobCreatedEvent extends BaseAgentEvent {
  type: 'research_job_created';
  jobId: string;
  estimatedDuration?: string;
}

export interface ResearchProgressEvent extends BaseAgentEvent {
  type: 'research_progress';
  jobId: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  message: string;
  searchesCompleted?: number;
  sourcesFound?: number;
  progressPercent?: number;
}

export interface ResearchSourceFoundEvent extends BaseAgentEvent {
  type: 'research_source_found';
  jobId: string;
  url: string;
  title?: string;
  snippet?: string;
}

export interface ResearchCompleteEvent extends BaseAgentEvent {
  type: 'research_complete';
  jobId: string;
  totalSources: number;
  totalSearches: number;
  durationMs: number;
  reportLength: number;
}

// ============================================
// CONTENT GENERATION EVENTS
// ============================================

export interface ImageGeneratedEvent extends BaseAgentEvent {
  type: 'image_generated';
  prompt: string;
  revisedPrompt?: string;
  durationMs: number;
}

export interface ImageEditedEvent extends BaseAgentEvent {
  type: 'image_edited';
  editType: string;
  durationMs: number;
}

export interface DocumentProcessedEvent extends BaseAgentEvent {
  type: 'document_processed';
  fileName: string;
  fileType: string;
  contentLength: number;
}

// ============================================
// QUALITY AND EVALUATION EVENTS
// ============================================

export interface ReflectionStartedEvent extends BaseAgentEvent {
  type: 'reflection_started';
  targetLength: number;
}

export interface ReflectionCompleteEvent extends BaseAgentEvent {
  type: 'reflection_complete';
  improvementsMade: boolean;
  durationMs: number;
}

export interface JudgeEvaluationEvent extends BaseAgentEvent {
  type: 'judge_evaluation';
  qualityScore: number;
  relevance: number;
  groundedness: number;
  coherence: number;
  completeness: number;
  durationMs?: number;
}

// ============================================
// SOURCES AND CONTEXT EVENTS
// ============================================

export interface SourceUsedEvent extends BaseAgentEvent {
  type: 'source_used';
  sourceType: 'database' | 'web' | 'document' | 'memory' | 'graph';
  sourceName: string;
  chunksUsed: number;
}

export interface ContextBuiltEvent extends BaseAgentEvent {
  type: 'context_built';
  totalTokens: number;
  sources: { type: string; count: number }[];
}

// ============================================
// LOGGING EVENT
// ============================================

export interface LogEvent extends BaseAgentEvent {
  type: 'log';
  agentId?: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  payload?: Record<string, unknown>;
}

// ============================================
// TASK AGENT ORCHESTRATION EVENTS
// ============================================

/** Execution mode for task agents */
export type TaskExecutionMode = 'human_in_loop' | 'human_out_of_loop';

export interface TaskRequestedEvent extends BaseAgentEvent {
  type: 'task_requested';
  taskId: string;
  taskType: string;
  agentId?: string;
  params: Record<string, unknown>;
  requiresApproval: boolean;
}

export interface TaskRoutedEvent extends BaseAgentEvent {
  type: 'task_routed';
  taskId: string;
  taskType: string;
  agentId: string;
  agentName: string;
  executionMode: TaskExecutionMode;
}

export interface TaskPendingApprovalEvent extends BaseAgentEvent {
  type: 'task_pending_approval';
  taskId: string;
  agentId: string;
  description: string;
  params: Record<string, unknown>;
  warnings?: string[];
}

export interface TaskApprovedEvent extends BaseAgentEvent {
  type: 'task_approved';
  taskId: string;
  agentId: string;
  approvedBy?: string;
}

export interface TaskRejectedEvent extends BaseAgentEvent {
  type: 'task_rejected';
  taskId: string;
  agentId: string;
  rejectedBy?: string;
  reason?: string;
}

export interface TaskExecutingEvent extends BaseAgentEvent {
  type: 'task_executing';
  taskId: string;
  agentId: string;
  estimatedDuration?: string;
}

export interface TaskResultEvent extends BaseAgentEvent {
  type: 'task_result';
  taskId: string;
  agentId: string;
  success: boolean;
  data?: unknown;
  durationMs: number;
}

export interface TaskFailedEvent extends BaseAgentEvent {
  type: 'task_failed';
  taskId: string;
  agentId: string;
  error: string;
  retriable: boolean;
  durationMs: number;
}

// ============================================
// UNION OF ALL EVENT TYPES
// ============================================

export type AgentEvent = 
  // Core lifecycle
  | AgentStartedEvent
  | AgentProgressEvent
  | AgentFinishedEvent
  // Mode and orchestration
  | ModeClassifiedEvent
  | ModeSelectedEvent
  | PipelineStartedEvent
  | PipelineCompleteEvent
  // Retrieval and domain
  | RetrievalStartedEvent
  | RetrievalCompleteEvent
  | DomainAgentStartedEvent
  | DomainAgentCompleteEvent
  // Graph
  | GraphTraversalStartedEvent
  | GraphTraversalCompleteEvent
  // Web search
  | WebSearchStartedEvent
  | WebSearchCompleteEvent
  // Memory
  | MemoryRetrievedEvent
  | MemorySavedEvent
  // Research mode
  | ClarificationRequestedEvent
  | ClarificationAnsweredEvent
  | ResearchJobCreatedEvent
  | ResearchProgressEvent
  | ResearchSourceFoundEvent
  | ResearchCompleteEvent
  // Content generation
  | ImageGeneratedEvent
  | ImageEditedEvent
  | DocumentProcessedEvent
  // Quality
  | ReflectionStartedEvent
  | ReflectionCompleteEvent
  | JudgeEvaluationEvent
  // Sources
  | SourceUsedEvent
  | ContextBuiltEvent
  // Logging
  | LogEvent
  // Task agent orchestration
  | TaskRequestedEvent
  | TaskRoutedEvent
  | TaskPendingApprovalEvent
  | TaskApprovedEvent
  | TaskRejectedEvent
  | TaskExecutingEvent
  | TaskResultEvent
  | TaskFailedEvent;

// Evaluation result from LLM judge
export interface LLMJudgeResult {
  relevanceScore: number;
  groundednessScore: number;
  coherenceScore: number;
  completenessScore: number;
  hallucinationDetected: boolean;
  unsupportedClaims: string[];
  reasoning: string;
  tokensUsed: number;
  costUsd: number;
}

// Deterministic metrics
export interface DeterministicMetrics {
  citationCoverage: number;
  citationCount: number;
  contextUtilization: number;
  answerSentences: number;
  sentencesWithContext: number;
  avgChunkSimilarity: number;
  maxChunkSimilarity: number;
  contextDiversityScore: number;
  tokensPerSentence: number;
}

// Combined evaluation result
export interface EvaluationResult extends DeterministicMetrics, LLMJudgeResult {
  qualityScore: number; // Composite score
}

// SSE event format for streaming to frontend
export interface SSEContentEvent {
  type: 'content';
  content: string;
}

export interface SSEAgentEvent {
  type: 'agent';
  event: AgentEvent;
}

export interface SSEModeEvent {
  type: 'mode';
  classification: ModeClassification;
}

export interface SSEEvaluationEvent {
  type: 'evaluation';
  turnId: string;
}

export type SSEEvent = SSEContentEvent | SSEAgentEvent | SSEModeEvent | SSEEvaluationEvent;
