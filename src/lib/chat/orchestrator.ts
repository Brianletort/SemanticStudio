/**
 * OrchestratorAgent - Main workflow coordinator for chat system
 * 
 * Coordinates the chat pipeline based on mode configuration:
 * - quick: Memory (T1) → GraphRAG → Web (if toggled) → Compose → Judge
 * - think: Memory (T1+T2) → GraphRAG (1-hop) → Web → Compose → Reflect → Judge
 * - deep: Memory (all) → GraphRAG (2-hop) → Web → Compose → Reflect → Judge
 * - research: Clarification → Rewrite → GraphRAG (3-hop) → Web → Compose → Judge
 */

import { v4 as uuidv4 } from 'uuid';
import type { ChatMode, AgentEvent, ModeClassification } from './types';
import type { ModeConfig, PipelineConfig } from './mode-config';
import { getModeConfig, getResolvedModeConfig, DEFAULT_PIPELINE_CONFIG } from './mode-config';
import { AgentEventBus, createEventBus } from './event-bus';
import { classifyQueryMode } from './mode-classifier';

// Pipeline step definition
export interface PipelineStep {
  id: string;
  name: string;
  execute: () => Promise<StepResult>;
  condition?: () => boolean;  // Optional condition to skip step
}

export interface StepResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

// Orchestrator input
export interface OrchestratorInput {
  message: string;
  sessionId?: string;
  userId: string;
  requestedMode: ChatMode;
  webEnabled: boolean;
  /** @deprecated Trace is now always enabled */
  enableTrace?: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    extractedContent?: string;
  }>;
  // User settings for overrides
  modeConfigOverrides?: Record<string, Partial<ModeConfig>>;
  pipelineConfig?: Partial<PipelineConfig>;
}

// Orchestrator output
export interface OrchestratorOutput {
  runId: string;
  mode: Exclude<ChatMode, 'auto'>;
  modeClassification?: ModeClassification;
  response: string;
  evaluation?: {
    qualityScore: number;
    relevance: number;
    groundedness: number;
    coherence: number;
    completeness: number;
  };
  stepsCompleted: string[];
  totalDurationMs: number;
  eventBus?: AgentEventBus;
}

// Pipeline context passed between steps
export interface PipelineContext {
  runId: string;
  turnId: string;
  mode: Exclude<ChatMode, 'auto'>;
  modeConfig: ModeConfig;
  message: string;
  sessionId?: string;
  userId: string;
  webEnabled: boolean;
  attachments: OrchestratorInput['attachments'];
  
  // Accumulated context
  memoryContext?: {
    summary: string;
    sessionFacts: Array<{ key: string; value: string }>;
    userProfileFacts: Array<{ key: string; value: string }>;
  };
  retrievalContext?: string;
  webSearchContext?: string;
  fileContext?: string;
  
  // Results
  response?: string;
  evaluation?: OrchestratorOutput['evaluation'];
  
  // Clarification (research mode)
  clarificationQuestions?: string[];
  clarificationAnswers?: Record<string, string>;
  isAnswerToClarification?: boolean;
}

/**
 * OrchestratorAgent coordinates the chat pipeline
 */
export class OrchestratorAgent {
  private eventBus: AgentEventBus | null = null;
  
  /**
   * Run the orchestrated pipeline
   */
  async run(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const startTime = Date.now();
    const runId = uuidv4();
    const turnId = uuidv4();
    
    // Always create event bus for trace visibility
    this.eventBus = createEventBus();
    
    // Determine mode
    let mode: Exclude<ChatMode, 'auto'>;
    let modeClassification: ModeClassification | undefined;
    
    if (input.requestedMode === 'auto') {
      await this.emitEvent({
        runId,
        type: 'agent_started',
        agentId: 'mode_classifier',
        label: 'Analyzing query complexity',
      });
      
      try {
        modeClassification = await classifyQueryMode(input.message);
        mode = modeClassification.recommendedMode;
        
        await this.emitEvent({
          runId,
          type: 'mode_classified',
          classification: modeClassification,
        });
      } catch {
        // Default to pipeline config default or 'think'
        mode = input.pipelineConfig?.autoModeDefault ?? DEFAULT_PIPELINE_CONFIG.autoModeDefault;
      }
    } else {
      mode = input.requestedMode;
    }
    
    // Get mode configuration with overrides
    const modeConfig = getResolvedModeConfig(
      mode,
      input.modeConfigOverrides as Record<string, Partial<ModeConfig>> | undefined,
      undefined,
      input.pipelineConfig
    );
    
    // Emit mode selected event
    await this.emitEvent({
      runId,
      type: 'mode_selected',
      mode,
      source: input.requestedMode === 'auto' ? 'auto' : 'user',
    });
    
    // Build pipeline context
    const context: PipelineContext = {
      runId,
      turnId,
      mode,
      modeConfig,
      message: input.message,
      sessionId: input.sessionId,
      userId: input.userId,
      webEnabled: input.webEnabled,
      attachments: input.attachments,
    };
    
    // Get pipeline steps for this mode
    const steps = this.getPipelineSteps(context);
    
    // Emit pipeline started event
    await this.emitEvent({
      runId,
      type: 'pipeline_started',
      mode,
      steps: steps.map(s => s.id),
    });
    
    // Execute pipeline
    const completedSteps: string[] = [];
    
    for (const step of steps) {
      // Check condition
      if (step.condition && !step.condition()) {
        console.log(`[Orchestrator] Skipping step: ${step.id}`);
        continue;
      }
      
      await this.emitEvent({
        runId,
        type: 'agent_started',
        agentId: step.id,
        label: step.name,
      });
      
      try {
        const result = await step.execute();
        
        if (result.success) {
          completedSteps.push(step.id);
          
          await this.emitEvent({
            runId,
            type: 'agent_finished',
            agentId: step.id,
            summary: `Completed in ${result.durationMs}ms`,
            data: result.data,
          });
        } else {
          await this.emitEvent({
            runId,
            type: 'log',
            level: 'error',
            agentId: step.id,
            message: result.error || 'Step failed',
          });
        }
      } catch (error) {
        await this.emitEvent({
          runId,
          type: 'log',
          level: 'error',
          agentId: step.id,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    const totalDurationMs = Date.now() - startTime;
    
    // Emit pipeline complete event
    await this.emitEvent({
      runId,
      type: 'pipeline_complete',
      mode,
      durationMs: totalDurationMs,
      stepsCompleted: completedSteps.length,
    });
    
    return {
      runId,
      mode,
      modeClassification,
      response: context.response || '',
      evaluation: context.evaluation,
      stepsCompleted: completedSteps,
      totalDurationMs,
      eventBus: this.eventBus || undefined,
    };
  }
  
  /**
   * Get pipeline steps based on mode
   */
  private getPipelineSteps(context: PipelineContext): PipelineStep[] {
    const steps: PipelineStep[] = [];
    
    // Memory retrieval (all modes, tiers depend on config)
    steps.push({
      id: 'memory',
      name: `Retrieving memory (tiers: ${context.modeConfig.memoryTiers.join(', ')})`,
      execute: async () => this.executeMemoryRetrieval(context),
    });
    
    // Research mode: Clarification step
    if (context.mode === 'research' && context.modeConfig.enableClarification) {
      steps.push({
        id: 'clarification',
        name: 'Analyzing for clarification questions',
        execute: async () => this.executeClarification(context),
        condition: () => !context.isAnswerToClarification,
      });
    }
    
    // GraphRAG retrieval (all modes use this for domain agent selection)
    steps.push({
      id: 'graphrag',
      name: `GraphRAG retrieval (${context.modeConfig.graphHops} hops)`,
      execute: async () => this.executeGraphRAGRetrieval(context),
    });
    
    // Web search (if enabled - works for all modes)
    steps.push({
      id: 'web_search',
      name: 'Web search',
      execute: async () => this.executeWebSearch(context),
      condition: () => context.webEnabled,
    });
    
    // File processing (if attachments)
    steps.push({
      id: 'file_processing',
      name: 'Processing attachments',
      execute: async () => this.executeFileProcessing(context),
      condition: () => !!(context.attachments && context.attachments.length > 0),
    });
    
    // Composition
    steps.push({
      id: 'composer',
      name: `Generating ${context.mode} response`,
      execute: async () => this.executeComposition(context),
    });
    
    // Reflection (think, deep, research modes)
    if (context.modeConfig.enableReflection) {
      steps.push({
        id: 'reflection',
        name: 'Reflecting on response',
        execute: async () => this.executeReflection(context),
      });
    }
    
    // Judge evaluation (all modes)
    steps.push({
      id: 'judge',
      name: 'Evaluating response quality',
      execute: async () => this.executeJudgeEvaluation(context),
    });
    
    // Memory update (think, deep, research modes)
    if (context.modeConfig.memoryTiers.includes('tier2')) {
      steps.push({
        id: 'memory_update',
        name: 'Updating memory',
        execute: async () => this.executeMemoryUpdate(context),
      });
    }
    
    return steps;
  }
  
  // ============================================
  // STEP IMPLEMENTATIONS
  // ============================================
  
  private async executeMemoryRetrieval(context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();
    
    // TODO: Integrate with MemoryService
    // For now, return placeholder
    context.memoryContext = {
      summary: '',
      sessionFacts: [],
      userProfileFacts: [],
    };
    
    return {
      success: true,
      durationMs: Date.now() - startTime,
      data: {
        tiersUsed: context.modeConfig.memoryTiers,
        factsCount: 0,
      },
    };
  }
  
  private async executeClarification(context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();
    
    // TODO: Integrate with ClarificationAgent
    // For now, skip clarification
    
    return {
      success: true,
      durationMs: Date.now() - startTime,
      data: { skipped: true },
    };
  }
  
  private async executeGraphRAGRetrieval(context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();
    
    // TODO: Integrate with DomainRetriever and GraphRAG-lite
    // For now, return placeholder
    context.retrievalContext = '';
    
    return {
      success: true,
      durationMs: Date.now() - startTime,
      data: {
        hops: context.modeConfig.graphHops,
        maxResults: context.modeConfig.maxResults,
      },
    };
  }
  
  private async executeWebSearch(context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();
    
    // TODO: Integrate with Brave Search
    // For now, return placeholder
    context.webSearchContext = '';
    
    return {
      success: true,
      durationMs: Date.now() - startTime,
      data: {
        resultsCount: 0,
      },
    };
  }
  
  private async executeFileProcessing(context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();
    
    // Build file context from attachments
    if (context.attachments && context.attachments.length > 0) {
      const parts = context.attachments
        .filter(a => a.extractedContent)
        .map(a => `=== FILE: ${a.name} (${a.type}) ===\n${a.extractedContent}\n=== END FILE ===`);
      context.fileContext = parts.join('\n\n');
    }
    
    return {
      success: true,
      durationMs: Date.now() - startTime,
      data: {
        filesProcessed: context.attachments?.length || 0,
      },
    };
  }
  
  private async executeComposition(context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();
    
    // TODO: Integrate with LLM streaming
    // For now, return placeholder
    context.response = 'Response placeholder - integrate with streamChat';
    
    return {
      success: true,
      durationMs: Date.now() - startTime,
      data: {
        responseLength: context.response.length,
      },
    };
  }
  
  private async executeReflection(context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();
    
    // TODO: Integrate with ReflectionAgent
    // For now, skip reflection
    
    return {
      success: true,
      durationMs: Date.now() - startTime,
      data: { improvementsMade: false },
    };
  }
  
  private async executeJudgeEvaluation(context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();
    
    // TODO: Integrate with evaluateAndSaveResponse
    // For now, return placeholder evaluation
    context.evaluation = {
      qualityScore: 0.8,
      relevance: 0.8,
      groundedness: 0.8,
      coherence: 0.8,
      completeness: 0.8,
    };
    
    return {
      success: true,
      durationMs: Date.now() - startTime,
      data: context.evaluation,
    };
  }
  
  private async executeMemoryUpdate(context: PipelineContext): Promise<StepResult> {
    const startTime = Date.now();
    
    // TODO: Integrate with MemoryService.updateAfterTurn
    // For now, skip memory update
    
    return {
      success: true,
      durationMs: Date.now() - startTime,
      data: {
        sessionFactsSaved: 0,
        userFactsSaved: 0,
      },
    };
  }
  
  // ============================================
  // HELPERS
  // ============================================
  
  private async emitEvent(event: AgentEvent): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.emit(event);
    }
  }
  
  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.shutdown();
    }
  }
}

/**
 * Create a new orchestrator instance
 */
export function createOrchestrator(): OrchestratorAgent {
  return new OrchestratorAgent();
}
