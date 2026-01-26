/**
 * AgentEventBus - Event logging and broadcasting for chat system
 * 
 * Responsibilities:
 * - Log agent events to database
 * - Emit events for UI consumption via SSE
 * - Track event sequence per run
 */

import { db } from '@/lib/db';
import { chatAgentEvents } from '@/lib/db/schema';
import type { AgentEvent } from './types';

export class AgentEventBus {
  private eventIndex: Map<string, number> = new Map();
  private eventQueue: Array<{ event: AgentEvent; idx: number }> = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;
  private listeners: Map<string, Array<(event: AgentEvent) => void>> = new Map();

  constructor() {
    // Flush events every 500ms
    this.flushInterval = setInterval(() => this.flush(), 500);
  }

  /**
   * Add event listener
   */
  on(eventType: string, callback: (event: AgentEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: string, callback: (event: AgentEvent) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify listeners
   */
  private notifyListeners(event: AgentEvent): void {
    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*') || [];
    wildcardListeners.forEach(listener => listener(event));

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(event.type) || [];
    typeListeners.forEach(listener => listener(event));
  }

  /**
   * Emit an event (queued for batch write)
   */
  async emit(event: AgentEvent): Promise<void> {
    if (this.isShuttingDown) {
      console.warn('[EventBus] Cannot emit during shutdown');
      return;
    }

    const runId = event.runId;
    
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    
    // Get or initialize event index for this run
    const currentIdx = this.eventIndex.get(runId) || 0;
    const nextIdx = currentIdx + 1;
    this.eventIndex.set(runId, nextIdx);

    // Queue for batch write
    this.eventQueue.push({ event, idx: nextIdx });

    // Log to console for development
    this.logToConsole(event);

    // Notify listeners immediately
    this.notifyListeners(event);

    // If queue is large, flush immediately
    if (this.eventQueue.length >= 10) {
      await this.flush();
    }
  }

  /**
   * Flush queued events to database
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToWrite = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const records = eventsToWrite.map(({ event, idx }) => 
        this.eventToDbRecord(event, idx)
      );

      await db.insert(chatAgentEvents).values(records);
    } catch (e) {
      console.error('[EventBus] Flush error:', e);
      // Re-queue on failure (but don't retry indefinitely)
      if (eventsToWrite.length < 100) {
        this.eventQueue.unshift(...eventsToWrite);
      }
    }
  }

  /**
   * Force flush and cleanup
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    await this.flush();
  }

  /**
   * Convert AgentEvent to database record
   */
  private eventToDbRecord(event: AgentEvent, idx: number): typeof chatAgentEvents.$inferInsert {
    const base = {
      runId: event.runId,
      sessionId: event.sessionId || null,  // Include sessionId for historical trace retrieval
      idx,
      eventType: event.type,
      createdAt: new Date(event.timestamp || Date.now()),
    };

    switch (event.type) {
      // Core lifecycle events
      case 'agent_started':
        return {
          ...base,
          agentId: event.agentId,
          label: event.label,
        };
      
      case 'agent_progress':
        return {
          ...base,
          agentId: event.agentId,
          message: event.message,
          payloadJson: event.data,
        };
      
      case 'agent_finished':
        return {
          ...base,
          agentId: event.agentId,
          message: event.summary,
          payloadJson: event.data,
        };
      
      // Mode and orchestration events
      case 'mode_classified':
        return {
          ...base,
          agentId: 'mode_classifier',
          payloadJson: event.classification as unknown as Record<string, unknown>,
        };
      
      case 'mode_selected':
        return {
          ...base,
          agentId: 'orchestrator',
          payloadJson: { mode: event.mode, source: event.source },
        };
      
      case 'pipeline_started':
        return {
          ...base,
          agentId: 'orchestrator',
          payloadJson: { mode: event.mode, steps: event.steps },
        };
      
      case 'pipeline_complete':
        return {
          ...base,
          agentId: 'orchestrator',
          payloadJson: { mode: event.mode, durationMs: event.durationMs, stepsCompleted: event.stepsCompleted },
        };
      
      // Retrieval events
      case 'retrieval_started':
        return {
          ...base,
          agentId: 'retrieval',
          label: 'retrieval_started',
          payloadJson: { domains: event.domains },
        };
      
      case 'retrieval_complete':
        return {
          ...base,
          agentId: 'retrieval',
          label: 'retrieval_complete',
          payloadJson: { 
            domains: event.domains, 
            resultsCount: event.resultsCount,
            durationMs: event.durationMs,
          },
        };
      
      // Domain agent events
      case 'domain_agent_started':
        return {
          ...base,
          agentId: event.agentId,
          label: `domain_${event.domain}`,
          payloadJson: { domain: event.domain, query: event.query },
        };
      
      case 'domain_agent_complete':
        return {
          ...base,
          agentId: event.agentId,
          label: `domain_${event.domain}`,
          payloadJson: { domain: event.domain, resultsCount: event.resultsCount, durationMs: event.durationMs },
        };
      
      // Graph traversal events
      case 'graph_traversal_started':
        return {
          ...base,
          agentId: 'graphrag',
          payloadJson: { hops: event.hops, startEntities: event.startEntities },
        };
      
      case 'graph_traversal_complete':
        return {
          ...base,
          agentId: 'graphrag',
          payloadJson: { 
            hops: event.hops, 
            nodesVisited: event.nodesVisited, 
            relationshipsFound: event.relationshipsFound,
            durationMs: event.durationMs,
          },
        };
      
      // Web search events
      case 'web_search_started':
        return {
          ...base,
          agentId: 'web_search',
          payloadJson: { query: event.query, maxResults: event.maxResults },
        };
      
      case 'web_search_complete':
        return {
          ...base,
          agentId: 'web_search',
          payloadJson: { resultsCount: event.resultsCount, urls: event.urls, durationMs: event.durationMs },
        };
      
      // Memory events
      case 'memory_retrieved':
        return {
          ...base,
          agentId: 'memory',
          payloadJson: { tiersUsed: event.tiersUsed, factsCount: event.factsCount, hasSummary: event.hasSummary },
        };
      
      case 'memory_saved':
        return {
          ...base,
          agentId: 'memory',
          payloadJson: { 
            sessionFactsCount: event.sessionFactsCount, 
            userFactsCount: event.userFactsCount, 
            summaryUpdated: event.summaryUpdated,
          },
        };
      
      // Research mode events
      case 'clarification_requested':
        return {
          ...base,
          agentId: 'clarification',
          payloadJson: { questionCount: event.questionCount, originalQuery: event.originalQuery },
        };
      
      case 'clarification_answered':
        return {
          ...base,
          agentId: 'clarification',
          payloadJson: { answersCount: event.answersCount },
        };
      
      case 'research_job_created':
        return {
          ...base,
          agentId: 'research',
          payloadJson: { jobId: event.jobId, estimatedDuration: event.estimatedDuration },
        };
      
      // Content generation events
      case 'image_generated':
        return {
          ...base,
          agentId: 'image_generator',
          payloadJson: { prompt: event.prompt, revisedPrompt: event.revisedPrompt, durationMs: event.durationMs },
        };
      
      case 'image_edited':
        return {
          ...base,
          agentId: 'image_editor',
          payloadJson: { editType: event.editType, durationMs: event.durationMs },
        };
      
      case 'document_processed':
        return {
          ...base,
          agentId: 'document_processor',
          payloadJson: { fileName: event.fileName, fileType: event.fileType, contentLength: event.contentLength },
        };
      
      // Quality events
      case 'reflection_started':
        return {
          ...base,
          agentId: 'reflection',
          payloadJson: { targetLength: event.targetLength },
        };
      
      case 'reflection_complete':
        return {
          ...base,
          agentId: 'reflection',
          payloadJson: { improvementsMade: event.improvementsMade, durationMs: event.durationMs },
        };
      
      case 'judge_evaluation':
        return {
          ...base,
          agentId: 'judge',
          payloadJson: { 
            qualityScore: event.qualityScore,
            relevance: event.relevance,
            groundedness: event.groundedness,
            coherence: event.coherence,
            completeness: event.completeness,
            durationMs: event.durationMs,
          },
        };
      
      // Source events
      case 'source_used':
        return {
          ...base,
          agentId: 'context',
          payloadJson: { sourceType: event.sourceType, sourceName: event.sourceName, chunksUsed: event.chunksUsed },
        };
      
      case 'context_built':
        return {
          ...base,
          agentId: 'context',
          payloadJson: { totalTokens: event.totalTokens, sources: event.sources },
        };
      
      // Logging
      case 'log':
        return {
          ...base,
          agentId: event.agentId,
          level: event.level,
          message: event.message,
          payloadJson: event.payload,
        };
      
      default:
        return base;
    }
  }

  /**
   * Log event to console for development
   */
  private logToConsole(event: AgentEvent): void {
    const prefix = `[Agent:${event.runId.slice(0, 8)}]`;

    switch (event.type) {
      // Core lifecycle
      case 'agent_started':
        console.log(`${prefix} 🚀 ${event.agentId} started ${event.label ? `(${event.label})` : ''}`);
        break;
      
      case 'agent_progress':
        console.log(`${prefix} ⚙️  ${event.agentId}: ${event.message}`);
        break;
      
      case 'agent_finished':
        console.log(`${prefix} ✅ ${event.agentId} finished ${event.summary ? `- ${event.summary}` : ''}`);
        break;
      
      // Mode and orchestration
      case 'mode_classified':
        console.log(`${prefix} 🎯 Mode classified: ${event.classification.recommendedMode} (${event.classification.confidence})`);
        break;
      
      case 'mode_selected':
        console.log(`${prefix} 🎯 Mode selected: ${event.mode} (${event.source})`);
        break;
      
      case 'pipeline_started':
        console.log(`${prefix} 🔄 Pipeline started: ${event.mode} mode [${event.steps.join(' → ')}]`);
        break;
      
      case 'pipeline_complete':
        console.log(`${prefix} ✅ Pipeline complete: ${event.stepsCompleted} steps in ${event.durationMs}ms`);
        break;
      
      // Retrieval
      case 'retrieval_started':
        console.log(`${prefix} 🔍 Retrieval started for domains: ${event.domains.join(', ')}`);
        break;
      
      case 'retrieval_complete':
        console.log(`${prefix} 📚 Retrieval complete: ${event.resultsCount} results in ${event.durationMs}ms`);
        break;
      
      // Domain agents
      case 'domain_agent_started':
        console.log(`${prefix} 🏢 Domain agent ${event.domain} started`);
        break;
      
      case 'domain_agent_complete':
        console.log(`${prefix} 🏢 Domain agent ${event.domain} complete: ${event.resultsCount} results in ${event.durationMs}ms`);
        break;
      
      // Graph traversal
      case 'graph_traversal_started':
        console.log(`${prefix} 🕸️  Graph traversal started: ${event.hops} hops from ${event.startEntities.length} entities`);
        break;
      
      case 'graph_traversal_complete':
        console.log(`${prefix} 🕸️  Graph traversal complete: ${event.nodesVisited} nodes, ${event.relationshipsFound} relationships in ${event.durationMs}ms`);
        break;
      
      // Web search
      case 'web_search_started':
        console.log(`${prefix} 🌐 Web search started: "${event.query.substring(0, 50)}..." (max ${event.maxResults})`);
        break;
      
      case 'web_search_complete':
        console.log(`${prefix} 🌐 Web search complete: ${event.resultsCount} results in ${event.durationMs}ms`);
        break;
      
      // Memory
      case 'memory_retrieved':
        console.log(`${prefix} 🧠 Memory retrieved: ${event.factsCount} facts from tiers [${event.tiersUsed.join(', ')}]`);
        break;
      
      case 'memory_saved':
        console.log(`${prefix} 🧠 Memory saved: ${event.sessionFactsCount} session, ${event.userFactsCount} user facts`);
        break;
      
      // Research mode
      case 'clarification_requested':
        console.log(`${prefix} ❓ Clarification requested: ${event.questionCount} questions`);
        break;
      
      case 'clarification_answered':
        console.log(`${prefix} ❓ Clarification answered: ${event.answersCount} answers`);
        break;
      
      case 'research_job_created':
        console.log(`${prefix} 📊 Research job created: ${event.jobId.slice(0, 8)} (est: ${event.estimatedDuration})`);
        break;
      
      // Content generation
      case 'image_generated':
        console.log(`${prefix} 🖼️  Image generated in ${event.durationMs}ms`);
        break;
      
      case 'image_edited':
        console.log(`${prefix} 🖼️  Image edited (${event.editType}) in ${event.durationMs}ms`);
        break;
      
      case 'document_processed':
        console.log(`${prefix} 📄 Document processed: ${event.fileName} (${event.fileType}, ${event.contentLength} chars)`);
        break;
      
      // Quality
      case 'reflection_started':
        console.log(`${prefix} 🤔 Reflection started`);
        break;
      
      case 'reflection_complete':
        console.log(`${prefix} 🤔 Reflection complete: ${event.improvementsMade ? 'improvements made' : 'no changes'} in ${event.durationMs}ms`);
        break;
      
      case 'judge_evaluation':
        console.log(`${prefix} ⚖️  Judge evaluation: quality=${event.qualityScore.toFixed(2)}, relevance=${event.relevance.toFixed(2)}`);
        break;
      
      // Sources
      case 'source_used':
        console.log(`${prefix} 📖 Source used: ${event.sourceName} (${event.sourceType}, ${event.chunksUsed} chunks)`);
        break;
      
      case 'context_built':
        console.log(`${prefix} 📖 Context built: ${event.totalTokens} tokens from ${event.sources.length} sources`);
        break;
      
      // Logging
      case 'log':
        const emoji = event.level === 'error' ? '❌' : event.level === 'warn' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} ${emoji} ${event.message}`);
        break;
    }
  }
}

/**
 * Create a new event bus instance
 */
export function createEventBus(): AgentEventBus {
  return new AgentEventBus();
}
