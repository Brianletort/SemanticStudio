"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
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
  Loader2,
} from "lucide-react";

// Event category for grouping
type EventCategory = 'mode' | 'retrieval' | 'web' | 'graph' | 'memory' | 'generation' | 'evaluation' | 'general';

// DB event record structure
interface DbAgentEvent {
  id: string;
  runId: string;
  sessionId: string | null;
  turnId: string | null;
  idx: number;
  eventType: string;
  agentId: string | null;
  message: string | null;
  label: string | null;
  level: string | null;
  payloadJson: Record<string, unknown> | null;
  createdAt: string;
}

interface TraceLineItem {
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
function getEventIcon(eventType: string, level?: string | null): React.ReactNode {
  switch (eventType) {
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
      return level === 'error' ? <AlertCircle className="w-3 h-3" /> : <Zap className="w-3 h-3" />;
    default:
      return <Zap className="w-3 h-3" />;
  }
}

// Get category for event
function getEventCategory(eventType: string): EventCategory {
  switch (eventType) {
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

// Get line type based on event type
function getLineType(eventType: string, level?: string | null): TraceLineItem['type'] {
  if (eventType === 'log' && level === 'error') return 'error';
  if (eventType.includes('_started')) return 'thinking';
  if (eventType.includes('_complete') || eventType.includes('_finished')) return 'result';
  if (eventType === 'mode_classified' || eventType === 'mode_selected') return 'mode';
  if (eventType.includes('web')) return 'web';
  if (eventType.includes('graph')) return 'graph';
  if (eventType.includes('memory')) return 'memory';
  if (eventType === 'judge_evaluation') return 'evaluation';
  return 'progress';
}

// Convert DB event to display line
function dbEventToTraceLine(event: DbAgentEvent, index: number): TraceLineItem {
  const category = getEventCategory(event.eventType);
  const icon = getEventIcon(event.eventType, event.level);
  const lineType = getLineType(event.eventType, event.level);
  const payload = event.payloadJson || {};
  
  let text = '';
  let tags: string[] = [];
  
  switch (event.eventType) {
    case 'agent_started':
      text = event.label || `Starting ${event.agentId}`;
      tags = ['start'];
      break;
    case 'agent_progress':
      text = event.message || 'Processing...';
      tags = ['progress'];
      break;
    case 'agent_finished':
      text = event.message || `${event.agentId} completed`;
      tags = ['complete'];
      break;
    case 'mode_classified':
      const classification = payload as { recommendedMode?: string; confidence?: number };
      text = `Mode: ${classification.recommendedMode} (${Math.round((classification.confidence || 0) * 100)}% confidence)`;
      tags = ['mode', classification.recommendedMode || ''];
      break;
    case 'mode_selected':
      text = `Mode: ${payload.mode} (${payload.source})`;
      tags = ['mode', String(payload.mode)];
      break;
    case 'pipeline_started':
      text = `Pipeline started: ${Array.isArray(payload.steps) ? payload.steps.join(' → ') : ''}`;
      tags = ['pipeline'];
      break;
    case 'pipeline_complete':
      text = `Pipeline complete: ${payload.stepsCompleted} steps in ${payload.durationMs}ms`;
      tags = ['pipeline', 'complete'];
      break;
    case 'retrieval_started':
      text = `Searching ${Array.isArray(payload.domains) ? payload.domains.join(', ') : ''} domains`;
      tags = ['retrieval'];
      break;
    case 'retrieval_complete':
      text = `Found ${payload.resultsCount} results in ${payload.durationMs}ms`;
      tags = ['retrieval', 'complete'];
      break;
    case 'domain_agent_started':
      text = `Querying ${payload.domain} domain`;
      tags = ['domain', String(payload.domain)];
      break;
    case 'domain_agent_complete':
      text = `${payload.domain}: ${payload.resultsCount} results (${payload.durationMs}ms)`;
      tags = ['domain', String(payload.domain)];
      break;
    case 'graph_traversal_started':
      text = `Graph traversal: ${payload.hops} hops from ${Array.isArray(payload.startEntities) ? payload.startEntities.length : 0} entities`;
      tags = ['graph', `${payload.hops}-hops`];
      break;
    case 'graph_traversal_complete':
      text = `Graph: ${payload.nodesVisited} nodes, ${payload.relationshipsFound} relationships (${payload.durationMs}ms)`;
      tags = ['graph', 'complete'];
      break;
    case 'web_search_started':
      const query = String(payload.query || '');
      text = `Web search: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`;
      tags = ['web', `max ${payload.maxResults}`];
      break;
    case 'web_search_complete':
      text = `Web: ${payload.resultsCount} results (${payload.durationMs}ms)`;
      tags = ['web', 'complete'];
      break;
    case 'memory_retrieved':
      text = `Memory: ${payload.factsCount} facts from ${Array.isArray(payload.tiersUsed) ? payload.tiersUsed.join(', ') : ''}`;
      tags = ['memory', ...(Array.isArray(payload.tiersUsed) ? payload.tiersUsed : [])];
      break;
    case 'memory_saved':
      text = `Memory saved: ${payload.sessionFactsCount} session, ${payload.userFactsCount} user facts`;
      tags = ['memory', 'saved'];
      break;
    case 'judge_evaluation':
      text = `Quality: ${((payload.qualityScore as number) * 100).toFixed(0)}% (rel: ${((payload.relevance as number) * 100).toFixed(0)}%, ground: ${((payload.groundedness as number) * 100).toFixed(0)}%)`;
      tags = ['evaluation', `${((payload.qualityScore as number) * 100).toFixed(0)}%`];
      break;
    case 'clarification_requested':
      text = `Asking ${payload.questionCount} clarifying question(s)`;
      tags = ['clarification', 'questions'];
      break;
    case 'image_generated':
      text = `Image generated (${payload.durationMs}ms)`;
      tags = ['image'];
      break;
    case 'document_processed':
      text = `Processed: ${payload.fileName} (${payload.contentLength} chars)`;
      tags = ['document', String(payload.fileType)];
      break;
    case 'log':
      text = event.message || '';
      tags = ['log', event.level || 'info'];
      break;
    default:
      text = event.message || event.label || event.eventType;
      tags = [event.eventType];
  }

  return {
    id: `line-${index}`,
    text,
    timestamp: new Date(event.createdAt).getTime(),
    type: lineType,
    agent: event.agentId || undefined,
    tags,
    metadata: payload,
    category,
    icon,
  };
}

interface TraceModalProps {
  turnId: string | null;
  open: boolean;
  onClose: () => void;
}

export function TraceModal({ turnId, open, onClose }: TraceModalProps) {
  const [events, setEvents] = useState<DbAgentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch events when modal opens
  useEffect(() => {
    if (!open || !turnId) {
      setEvents([]);
      setError(null);
      return;
    }

    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/trace/${turnId}`);
        const data = await response.json();
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('No trace events found for this response.');
          } else {
            setError(data.error || 'Failed to fetch trace events');
          }
          setEvents([]);
          return;
        }
        
        setEvents(data.events || []);
      } catch (err) {
        console.error('Error fetching trace:', err);
        setError('Failed to fetch trace events');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [open, turnId]);

  const traceLines = events.map((event, index) => dbEventToTraceLine(event, index));

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Agent Trace
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1 py-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Loading trace events...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : traceLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Brain className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No trace events available</p>
              </div>
            ) : (
              traceLines.map((line, index) => (
                <div 
                  key={line.id}
                  className={`text-xs leading-relaxed py-2 px-2 rounded transition-colors ${
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
                    
                    {/* Metadata for mode events */}
                    {line.metadata && line.type === 'mode' && (line.metadata as { reasoning?: string }).reasoning && (
                      <div className="text-xs opacity-70 mt-1">
                        <span className="font-medium">Reasoning:</span> {(line.metadata as { reasoning?: string }).reasoning}
                        {(line.metadata as { estimatedDomains?: string[] }).estimatedDomains && (line.metadata as { estimatedDomains?: string[] }).estimatedDomains!.length > 0 && (
                          <div className="mt-0.5">
                            <span className="font-medium">Domains:</span> {(line.metadata as { estimatedDomains?: string[] }).estimatedDomains!.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Web URLs if available */}
                    {line.metadata && line.category === 'web' && (line.metadata as { urls?: string[] }).urls && (
                      <div className="text-xs opacity-70 mt-1">
                        <span className="font-medium">Sources:</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(line.metadata as { urls: string[] }).urls.slice(0, 3).map((url, i) => {
                            try {
                              return (
                                <span key={i} className="truncate max-w-[150px]" title={url}>
                                  {new URL(url).hostname}
                                </span>
                              );
                            } catch {
                              return <span key={i}>{url}</span>;
                            }
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Evaluation details */}
                    {line.metadata && line.type === 'evaluation' && (
                      <div className="text-xs opacity-70 mt-1 grid grid-cols-2 gap-1">
                        <span>Coherence: {(((line.metadata as { coherence?: number }).coherence || 0) * 100).toFixed(0)}%</span>
                        <span>Complete: {(((line.metadata as { completeness?: number }).completeness || 0) * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        {!loading && !error && traceLines.length > 0 && (
          <div className="border-t pt-3 mt-2">
            <div className="text-xs text-muted-foreground text-center">
              <div className="flex items-center justify-center gap-3">
                <span>{traceLines.length} events</span>
                <span className="text-muted-foreground/50">|</span>
                <span>{new Set(traceLines.map(l => l.agent).filter(Boolean)).size} agents</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
