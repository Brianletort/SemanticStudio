"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  Minimize2,
  Maximize2,
  Globe,
  Database,
  Search,
  Network,
  Zap,
  FileText,
  CheckCircle,
  AlertCircle,
  Image,
  MessageSquare,
  BarChart,
} from "lucide-react";
import type { AgentEvent, ModeClassification } from "@/lib/chat/types";

// Event category for grouping
type EventCategory = 'mode' | 'retrieval' | 'web' | 'graph' | 'memory' | 'generation' | 'evaluation' | 'general';

interface ReasoningLine {
  id: string;
  text: string;
  timestamp: number;
  type: 'thinking' | 'progress' | 'result' | 'reasoning' | 'mode' | 'web' | 'graph' | 'memory' | 'evaluation' | 'error';
  agent?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  category?: EventCategory;
  icon?: React.ReactNode;
}

// Get icon for event type
function getEventIcon(event: AgentEvent): React.ReactNode {
  switch (event.type) {
    case 'web_search_started':
    case 'web_search_complete':
      return <Globe className="w-3 h-3" />;
    case 'graph_traversal_started':
    case 'graph_traversal_complete':
      return <Network className="w-3 h-3" />;
    case 'domain_agent_started':
    case 'domain_agent_complete':
      return <Database className="w-3 h-3" />;
    case 'retrieval_started':
    case 'retrieval_complete':
      return <Search className="w-3 h-3" />;
    case 'memory_retrieved':
    case 'memory_saved':
      return <Brain className="w-3 h-3" />;
    case 'judge_evaluation':
      return <BarChart className="w-3 h-3" />;
    case 'image_generated':
    case 'image_edited':
      return <Image className="w-3 h-3" />;
    case 'document_processed':
      return <FileText className="w-3 h-3" />;
    case 'clarification_requested':
    case 'clarification_answered':
      return <MessageSquare className="w-3 h-3" />;
    case 'agent_finished':
      return <CheckCircle className="w-3 h-3" />;
    case 'log':
      return event.level === 'error' ? <AlertCircle className="w-3 h-3" /> : <Zap className="w-3 h-3" />;
    default:
      return <Zap className="w-3 h-3" />;
  }
}

// Get category for event
function getEventCategory(event: AgentEvent): EventCategory {
  switch (event.type) {
    case 'mode_classified':
    case 'mode_selected':
    case 'pipeline_started':
    case 'pipeline_complete':
      return 'mode';
    case 'retrieval_started':
    case 'retrieval_complete':
    case 'domain_agent_started':
    case 'domain_agent_complete':
      return 'retrieval';
    case 'web_search_started':
    case 'web_search_complete':
      return 'web';
    case 'graph_traversal_started':
    case 'graph_traversal_complete':
      return 'graph';
    case 'memory_retrieved':
    case 'memory_saved':
      return 'memory';
    case 'image_generated':
    case 'image_edited':
    case 'document_processed':
      return 'generation';
    case 'judge_evaluation':
    case 'reflection_started':
    case 'reflection_complete':
      return 'evaluation';
    default:
      return 'general';
  }
}

interface ReasoningPaneProps {
  isVisible: boolean;
  isProcessing: boolean;
  isMinimized?: boolean;
  onToggleMinimized?: () => void;
  agentEvents?: AgentEvent[];
  modeClassification?: ModeClassification | null;
}

export function ReasoningPane({ 
  isVisible, 
  isProcessing,
  isMinimized = false,
  onToggleMinimized,
  agentEvents = [],
  modeClassification,
}: ReasoningPaneProps) {
  const [reasoningLines, setReasoningLines] = useState<ReasoningLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Convert agent events to reasoning lines
  useEffect(() => {
    const newLines: ReasoningLine[] = [];
    
    // Add mode classification if present
    if (modeClassification) {
      newLines.push({
        id: 'mode-classification',
        text: `Mode: ${modeClassification.recommendedMode} (${Math.round(modeClassification.confidence * 100)}% confidence)`,
        timestamp: Date.now(),
        type: 'mode',
        agent: 'classifier',
        tags: ['mode', modeClassification.recommendedMode],
        category: 'mode',
        metadata: { 
          reasoning: modeClassification.reasoning,
          domains: modeClassification.estimatedDomains,
        }
      });
    }

    agentEvents.forEach((event, index) => {
      const category = getEventCategory(event);
      const icon = getEventIcon(event);
      
      // Core lifecycle events
      if (event.type === 'agent_started') {
        newLines.push({
          id: `line-${index}-start`,
          text: event.label || `Starting ${event.agentId}`,
          timestamp: event.timestamp || Date.now(),
          type: 'thinking',
          agent: event.agentId,
          tags: ['start'],
          category,
          icon,
        });
      } 
      
      else if (event.type === 'agent_progress') {
        newLines.push({
          id: `line-${index}-progress`,
          text: event.message,
          timestamp: event.timestamp || Date.now(),
          type: 'progress',
          agent: event.agentId,
          tags: ['progress'],
          category,
          icon,
          metadata: event.data
        });
      } 
      
      else if (event.type === 'agent_finished') {
        newLines.push({
          id: `line-${index}-finish`,
          text: event.summary || `${event.agentId} completed`,
          timestamp: event.timestamp || Date.now(),
          type: 'result',
          agent: event.agentId,
          tags: ['complete'],
          category,
          icon,
        });
      }
      
      // Mode events
      else if (event.type === 'mode_selected') {
        newLines.push({
          id: `line-${index}-mode-selected`,
          text: `Mode: ${event.mode} (${event.source})`,
          timestamp: event.timestamp || Date.now(),
          type: 'mode',
          agent: 'orchestrator',
          tags: ['mode', event.mode],
          category: 'mode',
        });
      }
      
      else if (event.type === 'pipeline_started') {
        newLines.push({
          id: `line-${index}-pipeline-start`,
          text: `Pipeline started: ${event.steps.join(' → ')}`,
          timestamp: event.timestamp || Date.now(),
          type: 'mode',
          agent: 'orchestrator',
          tags: ['pipeline'],
          category: 'mode',
        });
      }
      
      else if (event.type === 'pipeline_complete') {
        newLines.push({
          id: `line-${index}-pipeline-complete`,
          text: `Pipeline complete: ${event.stepsCompleted} steps in ${event.durationMs}ms`,
          timestamp: event.timestamp || Date.now(),
          type: 'result',
          agent: 'orchestrator',
          tags: ['pipeline', 'complete'],
          category: 'mode',
        });
      }
      
      // Retrieval events
      else if (event.type === 'retrieval_started') {
        newLines.push({
          id: `line-${index}-retrieval-start`,
          text: `Searching ${event.domains.join(', ')} domains`,
          timestamp: event.timestamp || Date.now(),
          type: 'thinking',
          agent: 'retrieval',
          tags: ['retrieval'],
          category: 'retrieval',
          icon,
        });
      }
      
      else if (event.type === 'retrieval_complete') {
        newLines.push({
          id: `line-${index}-retrieval-complete`,
          text: `Found ${event.resultsCount} results in ${event.durationMs}ms`,
          timestamp: event.timestamp || Date.now(),
          type: 'result',
          agent: 'retrieval',
          tags: ['retrieval', 'complete'],
          category: 'retrieval',
          icon,
        });
      }
      
      // Domain agent events
      else if (event.type === 'domain_agent_started') {
        newLines.push({
          id: `line-${index}-domain-start`,
          text: `Querying ${event.domain} domain`,
          timestamp: event.timestamp || Date.now(),
          type: 'thinking',
          agent: event.agentId,
          tags: ['domain', event.domain],
          category: 'retrieval',
          icon,
        });
      }
      
      else if (event.type === 'domain_agent_complete') {
        newLines.push({
          id: `line-${index}-domain-complete`,
          text: `${event.domain}: ${event.resultsCount} results (${event.durationMs}ms)`,
          timestamp: event.timestamp || Date.now(),
          type: 'result',
          agent: event.agentId,
          tags: ['domain', event.domain],
          category: 'retrieval',
          icon,
        });
      }
      
      // Graph traversal events
      else if (event.type === 'graph_traversal_started') {
        newLines.push({
          id: `line-${index}-graph-start`,
          text: `Graph traversal: ${event.hops} hops from ${event.startEntities.length} entities`,
          timestamp: event.timestamp || Date.now(),
          type: 'thinking',
          agent: 'graphrag',
          tags: ['graph', `${event.hops}-hops`],
          category: 'graph',
          icon,
        });
      }
      
      else if (event.type === 'graph_traversal_complete') {
        newLines.push({
          id: `line-${index}-graph-complete`,
          text: `Graph: ${event.nodesVisited} nodes, ${event.relationshipsFound} relationships (${event.durationMs}ms)`,
          timestamp: event.timestamp || Date.now(),
          type: 'result',
          agent: 'graphrag',
          tags: ['graph', 'complete'],
          category: 'graph',
          icon,
        });
      }
      
      // Web search events
      else if (event.type === 'web_search_started') {
        newLines.push({
          id: `line-${index}-web-start`,
          text: `Web search: "${event.query.substring(0, 50)}${event.query.length > 50 ? '...' : ''}"`,
          timestamp: event.timestamp || Date.now(),
          type: 'web',
          agent: 'web_search',
          tags: ['web', `max ${event.maxResults}`],
          category: 'web',
          icon,
        });
      }
      
      else if (event.type === 'web_search_complete') {
        newLines.push({
          id: `line-${index}-web-complete`,
          text: `Web: ${event.resultsCount} results (${event.durationMs}ms)`,
          timestamp: event.timestamp || Date.now(),
          type: 'result',
          agent: 'web_search',
          tags: ['web', 'complete'],
          category: 'web',
          icon,
          metadata: { urls: event.urls },
        });
      }
      
      // Memory events
      else if (event.type === 'memory_retrieved') {
        newLines.push({
          id: `line-${index}-memory-retrieved`,
          text: `Memory: ${event.factsCount} facts from ${event.tiersUsed.join(', ')}`,
          timestamp: event.timestamp || Date.now(),
          type: 'memory',
          agent: 'memory',
          tags: ['memory', ...event.tiersUsed],
          category: 'memory',
          icon,
        });
      }
      
      else if (event.type === 'memory_saved') {
        newLines.push({
          id: `line-${index}-memory-saved`,
          text: `Memory saved: ${event.sessionFactsCount} session, ${event.userFactsCount} user facts`,
          timestamp: event.timestamp || Date.now(),
          type: 'result',
          agent: 'memory',
          tags: ['memory', 'saved'],
          category: 'memory',
          icon,
        });
      }
      
      // Judge evaluation
      else if (event.type === 'judge_evaluation') {
        newLines.push({
          id: `line-${index}-judge`,
          text: `Quality: ${(event.qualityScore * 100).toFixed(0)}% (rel: ${(event.relevance * 100).toFixed(0)}%, ground: ${(event.groundedness * 100).toFixed(0)}%)`,
          timestamp: event.timestamp || Date.now(),
          type: 'evaluation',
          agent: 'judge',
          tags: ['evaluation', `${(event.qualityScore * 100).toFixed(0)}%`],
          category: 'evaluation',
          icon,
          metadata: {
            relevance: event.relevance,
            groundedness: event.groundedness,
            coherence: event.coherence,
            completeness: event.completeness,
          },
        });
      }
      
      // Clarification events
      else if (event.type === 'clarification_requested') {
        newLines.push({
          id: `line-${index}-clarify-request`,
          text: `Asking ${event.questionCount} clarifying question(s)`,
          timestamp: event.timestamp || Date.now(),
          type: 'progress',
          agent: 'clarification',
          tags: ['clarification', 'questions'],
          category: 'general',
          icon,
        });
      }
      
      // Image generation
      else if (event.type === 'image_generated') {
        newLines.push({
          id: `line-${index}-image`,
          text: `Image generated (${event.durationMs}ms)`,
          timestamp: event.timestamp || Date.now(),
          type: 'result',
          agent: 'image_generator',
          tags: ['image'],
          category: 'generation',
          icon,
        });
      }
      
      // Document processing
      else if (event.type === 'document_processed') {
        newLines.push({
          id: `line-${index}-doc`,
          text: `Processed: ${event.fileName} (${event.contentLength} chars)`,
          timestamp: event.timestamp || Date.now(),
          type: 'result',
          agent: 'document_processor',
          tags: ['document', event.fileType],
          category: 'generation',
          icon,
        });
      }
      
      else if (event.type === 'mode_classified') {
        // Already handled above with modeClassification prop
      }
      
      else if (event.type === 'log') {
        newLines.push({
          id: `line-${index}-log`,
          text: event.message,
          timestamp: event.timestamp || Date.now(),
          type: event.level === 'error' ? 'error' : 'progress',
          agent: event.agentId,
          tags: ['log', event.level],
          category: 'general',
          icon,
        });
      }
    });

    setReasoningLines(newLines);
  }, [agentEvents, modeClassification]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reasoningLines]);

  if (!isVisible) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden border-l bg-background">
      {/* Header */}
      <div className="border-b p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Brain className="w-4 h-4 flex-shrink-0 text-primary" />
            {!isMinimized && (
              <h3 className="font-semibold text-sm truncate">Agent Trace</h3>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onToggleMinimized && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleMinimized}
                className="h-7 w-7 p-0"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isMinimized ? (
        <div className="flex-1 flex flex-col items-center justify-center p-2">
          {isProcessing && (
            <div className="animate-pulse">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                <Brain className="w-3 h-3 text-primary" />
              </div>
            </div>
          )}
          {reasoningLines.length > 0 && (
            <div className="mt-2 text-center">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                <span className="text-xs font-medium text-primary">{reasoningLines.length}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1" ref={scrollRef}>
            {reasoningLines.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Agent trace will appear here
                </p>
              </div>
            ) : (
              reasoningLines.map((line, index) => (
                <div 
                  key={line.id}
                  className={`animate-in fade-in duration-300 text-xs leading-relaxed py-2 px-2 rounded transition-colors ${
                    line.type === 'thinking' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500' :
                    line.type === 'progress' ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border-l-2 border-yellow-500' :
                    line.type === 'mode' ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border-l-2 border-purple-500' :
                    line.type === 'web' ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 border-l-2 border-cyan-500' :
                    line.type === 'graph' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border-l-2 border-indigo-500' :
                    line.type === 'memory' ? 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/30 border-l-2 border-pink-500' :
                    line.type === 'evaluation' ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-l-2 border-orange-500' :
                    line.type === 'error' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-l-2 border-red-500' :
                    'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-l-2 border-green-500'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="space-y-1">
                    {/* Header with icon, agent and tags */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {line.icon && (
                          <span className="flex-shrink-0 opacity-80">
                            {line.icon}
                          </span>
                        )}
                        {line.agent && (
                          <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                            {line.agent}
                          </span>
                        )}
                        {line.tags && line.tags.length > 0 && (
                          <div className="flex gap-1">
                            {line.tags.slice(0, 2).map((tag, tagIdx) => (
                              <span 
                                key={tagIdx} 
                                className="text-xs px-1.5 py-0.5 rounded-full bg-background/50 opacity-70"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-xs text-muted-foreground">
                        {new Date(line.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    {/* Main content */}
                    <div className="break-words leading-relaxed">
                      {line.text}
                    </div>
                    
                    {/* Metadata if available */}
                    {line.metadata && line.type === 'mode' && (
                      <div className="text-xs opacity-70 mt-1">
                        <span className="font-medium">Reasoning:</span> {(line.metadata as { reasoning?: string }).reasoning}
                        {(line.metadata as { domains?: string[] }).domains && (line.metadata as { domains?: string[] }).domains!.length > 0 && (
                          <div className="mt-0.5">
                            <span className="font-medium">Domains:</span> {(line.metadata as { domains?: string[] }).domains!.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Web URLs if available */}
                    {line.metadata && line.category === 'web' && (line.metadata as { urls?: string[] }).urls && (
                      <div className="text-xs opacity-70 mt-1">
                        <span className="font-medium">Sources:</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(line.metadata as { urls: string[] }).urls.slice(0, 3).map((url, i) => (
                            <span key={i} className="truncate max-w-[150px]" title={url}>
                              {new URL(url).hostname}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Evaluation details */}
                    {line.metadata && line.type === 'evaluation' && (
                      <div className="text-xs opacity-70 mt-1 grid grid-cols-2 gap-1">
                        <span>Coherence: {((line.metadata as { coherence?: number }).coherence || 0) * 100}%</span>
                        <span>Complete: {((line.metadata as { completeness?: number }).completeness || 0) * 100}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {isProcessing && (
              <div className="text-xs py-2 px-2 animate-pulse">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 py-2 px-2 rounded border-l-2 border-blue-500">
                  <div className="relative">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 w-2 h-2 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <span className="font-medium">Processing...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Footer */}
      {!isMinimized && (
        <div className="border-t p-2 flex-shrink-0">
          <div className="text-xs text-muted-foreground text-center space-y-1">
            {reasoningLines.length > 0 && (
              <div className="flex items-center justify-center gap-3">
                <span>{reasoningLines.length} events</span>
                <span className="text-muted-foreground/50">|</span>
                <span>{new Set(reasoningLines.map(l => l.agent).filter(Boolean)).size} agents</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
